# @2pay/checkout

A lightweight browser library that renders a merchant-configured pre-checkout form, collects the field values, passes them to the merchant's own server via a `createSession` callback, and then mounts Stripe Embedded Checkout using the `clientSecret` the server returns. The library never touches a secret key; all session creation happens server-side.

---

## Hosted script

Add the script tag to your page. On production, load it from the 2Pay CDN:

```html
<script src="https://js.2pay.io/v1/checkout.js"></script>
```

Then call `TwoPayCheckout.mount`:

```html
<div id="checkout"></div>

<script src="https://js.2pay.io/v1/checkout.js"></script>
<script>
  TwoPayCheckout.mount({
    element: "#checkout",
    fields: [
      { key: "player_name", label: "Minecraft username", type: "text", required: true },
      { key: "email",        label: "Email",             type: "email", required: true }
    ],
    publishableKey: "pk_live_your_2pay_publishable_key",
    createSession: async (values) => {
      const res = await fetch("/create-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values)
      });
      return await res.json(); // must return { clientSecret }
    },
    onError: (err) => console.error("checkout error", err)
  });
</script>
```

---

## npm

Install the package:

```bash
pnpm add @2pay/checkout
```

Import and call `mount` from your own bundled script:

```ts
import { TwoPayCheckout } from "@2pay/checkout";

TwoPayCheckout.mount({
  element: "#checkout",
  fields: [
    { key: "player_name", label: "Minecraft username", type: "text", required: true },
    { key: "email",        label: "Email",             type: "email", required: true }
  ],
  publishableKey: "pk_live_your_2pay_publishable_key",
  createSession: async (values) => {
    const res = await fetch("/create-checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values)
    });
    return await res.json();
  },
  onError: (err) => console.error("checkout error", err)
});
```

---

## Content Security Policy

If your page sets a `Content-Security-Policy` header, you must allow Stripe origins or the embedded checkout iframe will be silently blocked. Add the following directives:

```
frame-src https://*.stripe.com;
connect-src https://api.stripe.com https://*.stripe.com;
script-src https://js.stripe.com;
```

---

## Security model

Session creation always happens on the merchant's server, never in the browser:

1. The user fills in the pre-checkout form and submits it.
2. The library calls `createSession(values)`, which is a function **you** provide.
3. Your function calls your own server, which calls `POST /v1/checkouts` on the 2Pay API using your **secret key**. The secret key is never sent to the browser.
4. Your server returns `{ clientSecret }` to the browser.
5. The library passes that `clientSecret` to Stripe Embedded Checkout.

`publishableKey` is a public 2Pay Stripe publishable key. It is safe to embed in frontend code.

---

## Fields

`fields` is a merchant-defined array. The library renders each field as a form input, collects the submitted values, and passes them to `createSession` as a plain `Record<string, string>`. It does not interpret, validate against a schema, or transform the values.

Your server is responsible for mapping the values to the right `POST /v1/checkouts` parameters. For example:

| Field key       | Mapped to (server-side)  |
| --------------- | ------------------------ |
| `player_name`   | `delivery_target`        |
| `email`         | `customer_email`         |

---

## Options reference

### `MountOptions`

| Option          | Type                                                        | Required | Description                                                                 |
| --------------- | ----------------------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| `element`       | `string \| HTMLElement`                                     | Yes      | CSS selector or DOM element where the checkout will be rendered.            |
| `fields`        | `Field[]`                                                   | Yes      | Merchant-defined form fields shown before the payment step.                 |
| `createSession` | `(values: Record<string, string>) => Promise<{clientSecret: string}>` | Yes | Called after form submission; must return `{ clientSecret }` from your server. |
| `publishableKey`| `string`                                                    | Yes      | Your public 2Pay Stripe publishable key.                                    |
| `onComplete`    | `(result: { sessionId?: string }) => void`                  | No       | Called when the payment completes successfully.                             |
| `onError`       | `(error: Error) => void`                                    | No       | Called if an error occurs at any stage.                                     |

### `Field`

Text, email, or number input:

```ts
{
  key:         string;
  label:       string;
  type:        "text" | "email" | "number";
  required?:   boolean;
  placeholder?: string;
}
```

Select (dropdown):

```ts
{
  key:       string;
  label:     string;
  type:      "select";
  required?: boolean;
  options:   { value: string; label: string }[];
}
```
