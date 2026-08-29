import { describe, expect, test, vi } from "vitest";
import { TwoPay, TwoPayError } from "./client.js";

function clientWith(response: Response) {
  const fetchImpl = vi.fn(async () => response) as unknown as typeof fetch;
  const client = new TwoPay({ baseUrl: "https://api.2pay.gg/", apiKey: "sk_live_x", fetchImpl });
  return { client, calls: (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls };
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

describe("TwoPay", () => {
  test("authenticates with the api key and strips a trailing slash from the base url", async () => {
    const { client, calls } = clientWith(ok({ object: "list", data: [] }));
    await client.products.list();

    const [url, init] = calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://api.2pay.gg/v1/products");
    expect(init.headers.authorization).toBe("Bearer sk_live_x");
  });

  test("sends an idempotency key on the calls that move money", async () => {
    // Without this header, retrying a failed checkout is how one purchase becomes two charges.
    for (const [name, call] of [
      ["checkouts", (c: TwoPay) => c.checkouts.create({ items: [{ product: "prod_1" }] } as never, { idempotencyKey: "key_1" })],
      ["payouts", (c: TwoPay) => c.payouts.create({ amount: 100 } as never, { idempotencyKey: "key_1" })],
      ["refunds", (c: TwoPay) => c.refunds.create({ order: "order_1" } as never, { idempotencyKey: "key_1" })],
    ] as const) {
      const { client, calls } = clientWith(ok({ id: "x" }));
      await call(client);
      const init = calls[0]![1] as RequestInit & { headers: Record<string, string> };
      expect(init.headers["idempotency-key"], name).toBe("key_1");
    }
  });

  test("omits the header when no key is given, rather than inventing one", async () => {
    // Generating a key per call would be worse than none: every retry would get a fresh key
    // and the request would be replayed for real.
    const { client, calls } = clientWith(ok({ id: "x" }));
    await client.checkouts.create({ items: [{ product: "prod_1" }] } as never);
    const init = calls[0]![1] as RequestInit & { headers: Record<string, string> };
    expect(init.headers["idempotency-key"]).toBeUndefined();
  });

  test("surfaces an API error with its status and body", async () => {
    const body = { error: { type: "invalid_request_error", code: "resource_missing" } };
    // A fresh Response per call: a body can only be read once, so reusing one across two
    // requests would make the second read come back empty.
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(body), { status: 404 })) as unknown as typeof fetch;
    const client = new TwoPay({ baseUrl: "https://api.2pay.gg", apiKey: "sk_live_x", fetchImpl });

    const error = await client.products.retrieve("prod_missing").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TwoPayError);
    expect(error).toMatchObject({ status: 404, body });
  });
});
