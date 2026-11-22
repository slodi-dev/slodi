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
      "storybook-static/**",
      "next-env.d.ts",
      "e2e-results/**",
    ],
  },
  {
    // Chrome has no is-IS locale data, so toLocale*() and Intl silently print
    // English ("5,003", "September"). Icelandic dates, numbers and plurals go
    // through lib/format.ts (docs/ux-conventions.md, rule 2).
    files: ["**/*.{js,jsx,mjs,ts,tsx}"],
    ignores: ["lib/format.ts", "lib/format.test.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]",
          message:
            "Use formatIcelandicDate, formatIcelandicDateShort, formatIcelandicDateTime, formatIcelandicNumber or formatIcelandicDecimal from @/lib/format. Chrome falls back to English for is-IS.",
        },
        {
          selector: "MemberExpression[object.name='Intl']",
          message:
            "Use the helpers in @/lib/format instead of Intl. Chrome has no is-IS data and falls back to English.",
        },
      ],
    },
  },
  {
    // Playwright fixtures hand their value over with a callback named `use`,
    // which the React hooks rule mistakes for React's `use()`.
    files: ["e2e/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
];

export default eslintConfig;
