import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "packages/sdk/src/schema.d.ts"],
  },
  ...tseslint.configs.recommended,
);
