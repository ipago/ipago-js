import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  constructWebhookEvent,
  parseSignatureHeader,
  verifyWebhookSignature,
  WebhookVerificationError,
} from "./webhooks.js";

const SECRET = "whsec_test_secret";
const NOW = 1_800_000_000;
const now = () => NOW;

/**
 * Sign exactly the way the iPago API signs deliveries, using node:crypto rather than the
 * module under test. A helper that reused the SDK's own HMAC could agree with it while both
 * were wrong.
 */
function sign(body: string, opts: { secret?: string; timestamp?: number; extraSecrets?: string[] } = {}): string {
  const t = opts.timestamp ?? NOW;
  const secrets = [opts.secret ?? SECRET, ...(opts.extraSecrets ?? [])];
  const digests = secrets.map((s) => createHmac("sha256", s).update(`${t}.${body}`).digest("hex"));
  return [`t=${t}`, ...digests.map((d) => `v1=${d}`)].join(",");
}

const BODY = JSON.stringify({ id: "evt_1", type: "order.paid", data: { amount: 1000 } });

describe("parseSignatureHeader", () => {
  test("reads the timestamp and every digest", () => {
    const parsed = parseSignatureHeader("t=123,v1=aaa,v1=bbb");
    expect(parsed).toEqual({ timestamp: 123, digests: ["aaa", "bbb"] });
  });

  test("ignores unknown fields, so a future scheme addition is not a breaking change", () => {
    const parsed = parseSignatureHeader("t=123,v0=legacy,v1=aaa,note=hello");
    expect(parsed).toEqual({ timestamp: 123, digests: ["aaa"] });
  });

  test("rejects a header with no timestamp", () => {
    expect(() => parseSignatureHeader("v1=aaa")).toThrow(WebhookVerificationError);
  });

  test("rejects a header with no digest", () => {
    expect(() => parseSignatureHeader("t=123")).toThrow(WebhookVerificationError);
  });
});

describe("verifyWebhookSignature", () => {
  test("accepts a delivery signed with the endpoint's secret", async () => {
    const result = await verifyWebhookSignature({ payload: BODY, signature: sign(BODY), secret: SECRET, now });
    expect(result.timestamp).toBe(NOW);
  });

  test("rejects a tampered payload", async () => {
    const signature = sign(BODY);
    const tampered = JSON.stringify({ id: "evt_1", type: "order.paid", data: { amount: 999_999 } });
    await expect(
      verifyWebhookSignature({ payload: tampered, signature, secret: SECRET, now }),
    ).rejects.toThrow(/does not match/);
  });

  test("rejects the wrong secret", async () => {
    await expect(
      verifyWebhookSignature({ payload: BODY, signature: sign(BODY), secret: "whsec_someone_elses", now }),
    ).rejects.toThrow(/does not match/);
  });

  test("rejects a replay of an old delivery", async () => {
    const old = sign(BODY, { timestamp: NOW - 3_600 });
    await expect(
      verifyWebhookSignature({ payload: BODY, signature: old, secret: SECRET, now }),
    ).rejects.toThrow(/replay/);
  });

  test("rejects a delivery timestamped in the future", async () => {
    // A far-future timestamp is not a harmless clock skew: accepting it would let a captured
    // delivery be replayed for as long as the attacker chose.
    const ahead = sign(BODY, { timestamp: NOW + 3_600 });
    await expect(
      verifyWebhookSignature({ payload: BODY, signature: ahead, secret: SECRET, now }),
    ).rejects.toThrow(/tolerance/);
  });

  test("accepts a delivery inside the tolerance window", async () => {
    const slightlyOld = sign(BODY, { timestamp: NOW - 120 });
    await expect(
      verifyWebhookSignature({ payload: BODY, signature: slightlyOld, secret: SECRET, now }),
    ).resolves.toBeDefined();
  });

  test("honours a custom tolerance", async () => {
    const old = sign(BODY, { timestamp: NOW - 3_600 });
    await expect(
      verifyWebhookSignature({ payload: BODY, signature: old, secret: SECRET, now, toleranceSeconds: 7_200 }),
    ).resolves.toBeDefined();
  });

  test("accepts either secret while one is being rotated", async () => {
    // During a rotation the delivery carries a digest per secret. A receiver still holding the
    // previous one must keep working until it is redeployed, otherwise rotating a secret means
    // dropping events.
    const previous = "whsec_previous_secret";
    const signature = sign(BODY, { secret: previous, extraSecrets: [SECRET] });

    await expect(verifyWebhookSignature({ payload: BODY, signature, secret: previous, now })).resolves.toBeDefined();
    await expect(verifyWebhookSignature({ payload: BODY, signature, secret: SECRET, now })).resolves.toBeDefined();
    await expect(
      verifyWebhookSignature({ payload: BODY, signature, secret: "whsec_neither", now }),
    ).rejects.toThrow(/does not match/);
  });

  test("verifies the exact bytes received, not a re-serialised body", async () => {
    // The commonest integration bug: parsing the body, then verifying JSON.stringify of the
    // result. Key order and whitespace change, so the digest cannot match. The test exists to
    // pin that this is a real failure and not something the SDK quietly tolerates.
    const reserialised = JSON.stringify(JSON.parse(BODY.replace('{"id"', '{ "id"')));
    const spacedBody = BODY.replace('{"id"', '{ "id"');
    expect(spacedBody).not.toBe(reserialised);
    await expect(
      verifyWebhookSignature({ payload: reserialised, signature: sign(spacedBody), secret: SECRET, now }),
    ).rejects.toThrow(/does not match/);
  });
});

describe("constructWebhookEvent", () => {
  test("returns the parsed event once the signature checks out", async () => {
    const event = await constructWebhookEvent<{ id: string; type: string }>({
      payload: BODY,
      signature: sign(BODY),
      secret: SECRET,
      now,
    });
    expect(event).toMatchObject({ id: "evt_1", type: "order.paid" });
  });

  test("never parses a payload it could not verify", async () => {
    await expect(
      constructWebhookEvent({ payload: BODY, signature: sign(BODY, { secret: "whsec_wrong" }), secret: SECRET, now }),
    ).rejects.toThrow(WebhookVerificationError);
  });
});
