import { loadStripe } from "@stripe/stripe-js";

export async function mountPayment(args: {
  publishableKey: string;
  clientSecret: string;
  element: HTMLElement;
}): Promise<{ unmount: () => void }> {
  const stripe = await loadStripe(args.publishableKey);
  if (!stripe) throw new Error("Stripe.js failed to load");
  const checkout = await stripe.initEmbeddedCheckout({
    clientSecret: args.clientSecret,
  });
  checkout.mount(args.element);
  return { unmount: () => checkout.destroy() };
}
