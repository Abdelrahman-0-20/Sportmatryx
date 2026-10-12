import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Flat ESLint config using Next.js 16's native flat presets.
 * Ignores cover generated/vendored/infra directories.
 */
const config = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".tools/**",
      ".pgdata/**",
      ".pnpm-store/**",
      ".npm_cache/**",
      ".tmpdocx/**",
      "coverage/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default config;
