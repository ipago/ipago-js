/**
 * Verifying that a webhook really came from iPago.
 *
 * This is the one piece of an integration that is genuinely dangerous to write by hand. The
 * usual mistakes are comparing digests with `===` (leaking the secret a byte at a time under
 * timing analysis), verifying a re-serialised body instead of the exact bytes received, and
 * skipping the timestamp so an attacker can replay a captured delivery forever. All three are
 * handled here.
 *
 * Built on WebCrypto rather than `node:crypto`, so the same code runs on Node, Bun, Deno,
 * Cloudflare Workers and Vercel Edge. That matters: merchants receive webhooks wherever their
 * site is deployed, which is very often not a plain Node server.
 */

/** Header iPago signs every delivery with. */
export const SIGNATURE_HEADER = "ipago-signature";

/** How far apart the delivery's timestamp and your clock may be. Five minutes, like the docs. */
export const DEFAULT_TOLERANCE_SECONDS = 300;

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

export type ParsedSignature = { timestamp: number; digests: string[] };

/**
 * Parse a `iPago-Signature` header: `t=<unix seconds>,v1=<hex>[,v1=<hex>]`.
 *
 * More than one `v1` appears while a signing secret is being rotated: the delivery is signed
 * with both the new and the previous secret so a receiver that has not been redeployed yet
 * keeps working. A receiver accepts the delivery if ANY digest matches its own secret.
 */
export function parseSignatureHeader(header: string): ParsedSignature {
  let timestamp: number | undefined;
  const digests: string[] = [];

  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) timestamp = parsed;
    } else if (key === "v1" && value) {
      digests.push(value);
    }
  }

  if (timestamp === undefined) throw new WebhookVerificationError("signature header has no timestamp");
  if (digests.length === 0) throw new WebhookVerificationError("signature header has no digest");
  return { timestamp, digests };
}

const encoder = new TextEncoder();

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compare two hex digests without leaking where they first differ.
 *
 * Length is compared up front, which is safe: the digest length is fixed and public. The bytes
 * themselves are then compared in full, every time, with no early exit.
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export type VerifyOptions = {
  /** The raw request body, EXACTLY as received. Never a re-serialised object. */
  payload: string;
  /** The `iPago-Signature` header value. */
  signature: string;
  /** The endpoint's signing secret, `whsec_...`. */
  secret: string;
  /** Maximum age of the delivery, in seconds. Defaults to five minutes. */
  toleranceSeconds?: number;
  /** Current time in unix seconds. For tests. */
  now?: () => number;
};

/**
 * Throw unless `payload` was signed by `secret` recently.
 *
 * Pass the raw body, not a parsed object: JSON.stringify of a parsed body reorders keys and
 * changes whitespace, and the digest is over the exact bytes iPago sent. In Express reach for
 * `express.raw({ type: 'application/json' })`; in a fetch-style handler use `await req.text()`
 * and parse afterwards.
 */
export async function verifyWebhookSignature(opts: VerifyOptions): Promise<ParsedSignature> {
  const { timestamp, digests } = parseSignatureHeader(opts.signature);

  const tolerance = opts.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = opts.now ? opts.now() : Math.floor(Date.now() / 1000);
  // Absolute difference, so a delivery timestamped in the future is rejected too. A clock that
  // has run away is a reason to investigate, not to trust the message.
  if (Math.abs(now - timestamp) > tolerance) {
    throw new WebhookVerificationError(
      `signature timestamp is outside the ${tolerance}s tolerance; this delivery may be a replay`,
    );
  }

  const expected = await hmacSha256Hex(opts.secret, `${timestamp}.${opts.payload}`);
  // Every candidate is compared, with no early exit, so a caller cannot learn which of the
  // rotation digests matched from how long verification took.
  let matched = false;
  for (const digest of digests) {
    if (timingSafeEqualHex(digest, expected)) matched = true;
  }
  if (!matched) throw new WebhookVerificationError("signature does not match the payload");

  return { timestamp, digests };
}

/**
 * Verify and parse in one step, the shape most handlers actually want.
 *
 * Returns the event body typed as `T`. Verification happens on the raw string first, so the
 * parse can never be what a forged payload exploits.
 */
export async function constructWebhookEvent<T = unknown>(opts: VerifyOptions): Promise<T> {
  await verifyWebhookSignature(opts);
  return JSON.parse(opts.payload) as T;
}
