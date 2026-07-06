import { renderForm } from "./form.js";
import { mountPayment } from "./payment.js";
import type { MountOptions } from "./types.js";

export function mount(options: MountOptions): { unmount: () => void } {
  // onComplete is reserved for the no-redirect completion mode. The primary completion
  // path is the session return_url set server-side. It is kept in MountOptions so the
  // type contract is stable; this slice does not call it.
  void options.onComplete;

  let el: HTMLElement;

  if (typeof options.element === "string") {
    const found = document.querySelector(options.element);
    if (!(found instanceof HTMLElement)) {
      throw new Error("2Pay Checkout: element not found: " + options.element);
    }
    el = found;
  } else {
    el = options.element;
  }

  let form: { destroy: () => void } | undefined;
  let payment: { unmount: () => void } | undefined;

  form = renderForm(el, options.fields, async (values) => {
    try {
      const session = await options.createSession(values);
      if (!session || !session.clientSecret) {
        throw new Error("createSession did not return a clientSecret");
      }
      form?.destroy();
      form = undefined;
      payment = await mountPayment({
        publishableKey: options.publishableKey,
        clientSecret: session.clientSecret,
        element: el,
      });
    } catch (err) {
      options.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  });

  return {
    unmount() {
      form?.destroy();
      payment?.unmount();
    },
  };
}
