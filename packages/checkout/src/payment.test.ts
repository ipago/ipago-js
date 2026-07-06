import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCheckout, mockStripe, loadStripe } = vi.hoisted(() => {
  const mockCheckout = { mount: vi.fn(), destroy: vi.fn() };
  const mockStripe = { initEmbeddedCheckout: vi.fn(async () => mockCheckout) };
  const loadStripe = vi.fn(async () => mockStripe as unknown);
  return { mockCheckout, mockStripe, loadStripe };
});

vi.mock("@stripe/stripe-js", () => ({ loadStripe }));

import { mountPayment } from "./payment.js";

describe("mountPayment", () => {
  let element: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    element = document.createElement("div");
  });

  it("calls loadStripe with publishableKey, initEmbeddedCheckout with clientSecret, and mounts to element", async () => {
    const result = await mountPayment({
      publishableKey: "pk_test",
      clientSecret: "cs_test_secret",
      element,
    });

    expect(loadStripe).toHaveBeenCalledWith("pk_test");
    expect(mockStripe.initEmbeddedCheckout).toHaveBeenCalledWith({
      clientSecret: "cs_test_secret",
    });
    expect(mockCheckout.mount).toHaveBeenCalledWith(element);
    expect(result).toHaveProperty("unmount");
  });

  it("returned unmount() calls checkout.destroy()", async () => {
    const { unmount } = await mountPayment({
      publishableKey: "pk_test",
      clientSecret: "cs_test_secret",
      element,
    });

    unmount();
    expect(mockCheckout.destroy).toHaveBeenCalledOnce();
  });

  it("rejects with a clear error when loadStripe resolves null", async () => {
    loadStripe.mockResolvedValueOnce(null);

    await expect(
      mountPayment({ publishableKey: "pk_test", clientSecret: "cs_test_secret", element })
    ).rejects.toThrow("Stripe.js failed to load");
  });
});
