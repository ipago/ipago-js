import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./payment.js", () => ({
  mountPayment: vi.fn(async () => ({ unmount: vi.fn() })),
}));

import { mountPayment } from "./payment.js";
import { mount } from "./checkout.js";

const mockedMountPayment = mountPayment as ReturnType<typeof vi.fn>;

describe("mount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="app"></div>';
  });

  it("renders the form into the resolved element", () => {
    const createSession = vi.fn(async () => ({ clientSecret: "cs_test_1" }));
    mount({
      element: "#app",
      fields: [
        { key: "player_name", label: "User", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
      ],
      createSession,
      publishableKey: "pk_test",
    });

    const app = document.getElementById("app")!;
    expect(app.querySelector("form.twopay-form")).toBeTruthy();
  });

  it("calls createSession with field values and then mountPayment on submit", async () => {
    const createSession = vi.fn(async () => ({ clientSecret: "cs_test_1" }));
    mount({
      element: "#app",
      fields: [
        { key: "player_name", label: "User", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
      ],
      createSession,
      publishableKey: "pk_test",
    });

    const app = document.getElementById("app")!;
    (app.querySelector("input[name='player_name']") as HTMLInputElement).value = "Alice";
    (app.querySelector("input[name='email']") as HTMLInputElement).value = "alice@example.com";

    app.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(mockedMountPayment).toHaveBeenCalled());

    expect(createSession).toHaveBeenCalledOnce();
    expect(createSession).toHaveBeenCalledWith({
      player_name: "Alice",
      email: "alice@example.com",
    });
    expect(mockedMountPayment).toHaveBeenCalledWith({
      publishableKey: "pk_test",
      clientSecret: "cs_test_1",
      element: app,
    });
  });

  it("calls onError and does not mount payment when createSession rejects", async () => {
    const createSession = vi.fn(async () => { throw new Error("session failed"); });
    const onError = vi.fn();
    mount({
      element: "#app",
      fields: [
        { key: "player_name", label: "User", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
      ],
      createSession,
      publishableKey: "pk_test",
      onError,
    });

    const app = document.getElementById("app")!;
    (app.querySelector("input[name='player_name']") as HTMLInputElement).value = "Bob";
    (app.querySelector("input[name='email']") as HTMLInputElement).value = "bob@example.com";

    app.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(mockedMountPayment).not.toHaveBeenCalled();
  });

  it("throws synchronously when the element selector is not found", () => {
    expect(() =>
      mount({
        element: "#nope",
        fields: [],
        createSession: vi.fn(async () => ({ clientSecret: "cs" })),
        publishableKey: "pk_test",
      })
    ).toThrow("2Pay Checkout: element not found: #nope");
  });

  it("calls onError and does not call mountPayment when createSession returns no clientSecret", async () => {
    const createSession = vi.fn(async () => ({} as { clientSecret: string }));
    const onError = vi.fn();
    mount({
      element: "#app",
      fields: [
        { key: "player_name", label: "User", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
      ],
      createSession,
      publishableKey: "pk_test",
      onError,
    });

    const app = document.getElementById("app")!;
    (app.querySelector("input[name='player_name']") as HTMLInputElement).value = "Alice";
    (app.querySelector("input[name='email']") as HTMLInputElement).value = "alice@example.com";

    app.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(mockedMountPayment).not.toHaveBeenCalled();
    expect(app.querySelector("form.twopay-form")).toBeTruthy();
  });

  it("keeps the form in the DOM when mountPayment rejects", async () => {
    mockedMountPayment.mockRejectedValueOnce(new Error("stripe load failed"));
    const createSession = vi.fn(async () => ({ clientSecret: "cs_test_1" }));
    const onError = vi.fn();
    mount({
      element: "#app",
      fields: [
        { key: "player_name", label: "User", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
      ],
      createSession,
      publishableKey: "pk_test",
      onError,
    });

    const app = document.getElementById("app")!;
    (app.querySelector("input[name='player_name']") as HTMLInputElement).value = "Dave";
    (app.querySelector("input[name='email']") as HTMLInputElement).value = "dave@example.com";

    app.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(app.querySelector("form.twopay-form")).toBeTruthy();
    expect(app.querySelector("input[name='player_name']")).toBeTruthy();
  });

  it("logs to console.error when onError is not provided and createSession rejects", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const createSession = vi.fn(async () => { throw new Error("session error"); });
    mount({
      element: "#app",
      fields: [
        { key: "player_name", label: "User", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
      ],
      createSession,
      publishableKey: "pk_test",
    });

    const app = document.getElementById("app")!;
    (app.querySelector("input[name='player_name']") as HTMLInputElement).value = "Eve";
    (app.querySelector("input[name='email']") as HTMLInputElement).value = "eve@example.com";

    app.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(consoleSpy).toHaveBeenCalled());

    expect(consoleSpy).toHaveBeenCalledWith("[2Pay Checkout] Unhandled error:", expect.any(Error));
    consoleSpy.mockRestore();
  });

  it("unmount tears down the form and payment", async () => {
    const createSession = vi.fn(async () => ({ clientSecret: "cs_test_1" }));
    const { unmount } = mount({
      element: "#app",
      fields: [
        { key: "player_name", label: "User", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
      ],
      createSession,
      publishableKey: "pk_test",
    });

    const app = document.getElementById("app")!;
    (app.querySelector("input[name='player_name']") as HTMLInputElement).value = "Carol";
    (app.querySelector("input[name='email']") as HTMLInputElement).value = "carol@example.com";
    app.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(mockedMountPayment).toHaveBeenCalled());

    const paymentResult = await mockedMountPayment.mock.results[0].value as { unmount: ReturnType<typeof vi.fn> };
    unmount();
    expect(paymentResult.unmount).toHaveBeenCalled();
  });
});
