import js from "@eslint/js";
import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: ["dist/**", "src/screens/**", "src/lib/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/publicImageCache.test.mjs"],
    languageOptions: { globals: { URL: "readonly" } },
  },
  {
    files: ["**/sharedPublicRequests.test.mjs"],
    languageOptions: { globals: { AbortController: "readonly" } },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
);
