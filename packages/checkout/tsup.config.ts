import { defineConfig } from "tsup";

export default defineConfig([
  { entry: { index: "src/index.ts" }, format: ["esm"], dts: true, clean: true },
  {
    entry: { checkout: "src/global.ts" },
    format: ["iife"],
    globalName: "IPagoCheckout",
    clean: false,
    // dist/checkout.global.js is deployed to the CDN as https://js.ipago.io/v1/checkout.js (the deploy step renames it)
    outExtension: () => ({ js: ".global.js" }),
  },
]);
