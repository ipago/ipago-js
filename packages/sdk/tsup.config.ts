import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  // Both formats: merchants integrate from Next.js and from plain CommonJS servers alike, and
  // an ESM-only SDK is a support burden out of proportion to the size of this package.
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  // No bundled dependencies at all: the client is fetch and WebCrypto only, so nothing needs
  // to be inlined and nothing can drift out of date inside the artefact.
  external: [],
});
