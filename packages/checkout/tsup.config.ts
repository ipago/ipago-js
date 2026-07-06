import { defineConfig } from "tsup";

export default defineConfig([
  { entry: { index: "src/index.ts" }, format: ["esm"], dts: true, clean: true },
  {
    entry: { checkout: "src/global.ts" },
    format: ["iife"],
    globalName: "TwoPayCheckout",
    clean: false,
    outExtension: () => ({ js: ".global.js" }),
  },
]);
