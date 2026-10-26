# @ipago/sdk

Server-side client for the [iPago](https://ipago.io) Developer API.

iPago is the Merchant of Record: it takes the payment, computes and remits VAT, and pays you out.
This package is the typed client for the API behind that, plus the one piece of an integration
that is genuinely risky to write by hand, verifying that a webhook really came from us.

Requires Node 18 or newer, or any runtime with `fetch` and WebCrypto (Bun, Deno, Cloudflare
Workers, Vercel Edge). No dependencies.

## Install

```bash
npm install @ipago/sdk
```

## Authenticate

Create an API key in the merchant panel, under **Integration → API keys**. Keys are shown once.
A key is scoped to one store and one mode, and its prefix tells you which: `sk_live_...` moves
real money, `sk_test_...` does not.

```ts
import { IPago } from "@ipago/sdk";

const iPago = new IPago({
  baseUrl: "https://api.ipago.io",
  apiKey: process.env.IPAGO_SECRET_KEY!,
});
```

Keep the key on your server. It can create charges and move payouts, so anything it reaches
can spend your money.

## Create a checkout

```ts
const checkout = await iPago.checkouts.create(
  {
    items: [{ product: "prod_...", quantity: 1 }],
    customer_email: "buyer@example.com",
    delivery_target: "Steve",       // the game username, when you deliver to a game server
    country: "PL",                  // buyer country, used to compute VAT
    return_url: "https://your.site/thanks",
  },
  { idempotencyKey: crypto.randomUUID() },
);
```

**Pass an idempotency key on anything that moves money.** Generate it once per intent and reuse
it across retries: that is what makes a retried request replay the original response instead of
charging twice. It is supported on `checkouts.create`, `payouts.create` and `refunds.create`.

Amounts are always integers in the currency's minor unit: `1000` is 10.00 PLN.

## Verify a webhook

Every delivery carries a `iPago-Signature` header. Verify it before you trust anything in the
body, and verify the **raw bytes** you received, not a parsed and re-serialised object.

```ts
import { constructWebhookEvent, WebhookVerificationError } from "@ipago/sdk";

app.post("/webhooks/ipago", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const event = await constructWebhookEvent<{ type: string; data: unknown }>({
      payload: req.body.toString("utf8"),
      signature: req.header("iPago-Signature")!,
      secret: process.env.IPAGO_WEBHOOK_SECRET!,
    });

    if (event.type === "order.paid") {
      // deliver the purchase
    }

    res.sendStatus(200);
  } catch (err) {
    if (err instanceof WebhookVerificationError) return res.sendStatus(400);
    throw err;
  }
});
```

`constructWebhookEvent` verifies and parses. Use `verifyWebhookSignature` instead if you want to
parse the body yourself.

Three things it does that hand-rolled verification usually misses:

- Compares digests in constant time, so the signature cannot be brute-forced a byte at a time.
- Rejects deliveries older (or newer) than five minutes, so a captured delivery cannot be
  replayed forever. Override with `toleranceSeconds` if your clocks are far apart.
- Accepts **any** of the digests in the header. During a secret rotation a delivery is signed
  with both the new and the previous secret, so rotating never drops events.

Respond `2xx` quickly and do the work afterwards. A non-2xx is retried with backoff for about
36 hours, after which the endpoint is disabled.

## Errors

Anything that is not a 2xx throws `IPagoError`, carrying the status and the parsed body.

```ts
import { IPagoError } from "@ipago/sdk";

try {
  await iPago.orders.retrieve("order_nope");
} catch (err) {
  if (err instanceof IPagoError) {
    console.error(err.status, err.body); // 404, { error: { type, code, message, request_id } }
  }
}
```

`request_id` in the body is what to quote when asking us about a specific failure.

On `429`, back off exponentially with jitter and honour `Retry-After`. Reads are limited to 300
requests a minute per key and writes to 60, with tighter limits on payouts, refunds and key
management.

## What is covered

`products`, `categories`, `checkouts`, `orders`, `refunds`, `payouts`, `balance`, `ledger`,
`deliveries`, `disputes`, `events` and `webhookEndpoints`. The types are generated from the
OpenAPI document the API serves at `/openapi.json`, so they cannot drift from the real thing.

## Versioning

`0.x`: the surface may still change. Pin an exact version and read the changelog before
upgrading.
