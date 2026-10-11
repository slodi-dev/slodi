import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    // `.next*` covers .next and any alternate distDir a `next build --distDir`
    // leaves behind. All of it is generated, and its route types use @ts-ignore,
    // which the ban-ts-comment rule would otherwise fail the whole run on.
    ignores: [
      "node_modules/**",
      ".next*/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "e2e-results/**",
    ],
  },
  {
    // Playwright fixtures hand their value over with a callback named `use`,
    // which the React hooks rule mistakes for React's `use()`.
    files: ["e2e/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
];

export default eslintConfig;
