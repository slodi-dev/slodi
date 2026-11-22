#!/usr/bin/env node
/**
 * Every component has stories.
 *
 * Stories are where a component is tested in all four forms (light/dark ×
 * phone/desktop, see vitest.config.ts), so a component without one is never
 * rendered by CI at all. The rule: every `.tsx` under `components/` and `app/`
 * must be imported by at least one `*.stories.tsx`, unless it is a Next.js
 * route file (covered by the route crawler instead) or listed in ALLOWED below
 * with a reason.
 *
 * Usage:  node scripts/check-stories.mjs
 * Design: docs/ui-quality-pipeline.md (layer 1).
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SCAN = ["components", "app"];

/** Files that need no story of their own. Each entry says why. */
const ALLOWED = {
  "components/ThemeKeyboardShortcuts.tsx": "renders nothing; a keyboard listener",
  "components/ThemeProvider/index.tsx": "every story renders inside it (.storybook/preview.tsx)",
  "components/leikir/arnor-clicker/icons.tsx":
    "icon set, rendered by the ArnorClickerGame and OrbitField stories",
};

/** Next.js App Router special files: routes, not components. */
const ROUTE_FILE =
  /\/(page|layout|loading|error|not-found|template|default|global-error|route)\.tsx$/;

const SKIP_DIRS = new Set(["node_modules", "__tests__", "__mocks__", ".next"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Resolve an import specifier from `fromFile` to a .tsx file, if it is one. */
function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null;
  for (const candidate of [base, `${base}.tsx`, join(base, "index.tsx")]) {
    if (candidate.endsWith(".tsx") && existsSync(candidate)) return candidate;
  }
  return null;
}

const files = SCAN.flatMap((d) => walk(join(ROOT, d)));
const stories = files.filter((f) => f.endsWith(".stories.tsx"));

const covered = new Set();
for (const story of stories) {
  const src = readFileSync(story, "utf8");
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
    const target = resolveImport(story, m[1]);
    if (target) covered.add(target);
  }
}

const components = files.filter(
  (f) => !f.endsWith(".stories.tsx") && !f.endsWith(".test.tsx") && !ROUTE_FILE.test(f)
);
const missing = components
  .map((f) => relative(ROOT, f))
  .filter((f) => !covered.has(join(ROOT, f)) && !(f in ALLOWED));

const stale = Object.keys(ALLOWED).filter((f) => !existsSync(join(ROOT, f)));

if (missing.length) {
  console.log(`\nComponents that no story imports (${missing.length}):`);
  for (const f of missing) console.log(`  ${f}`);
  console.log(
    "\nAdd a <Name>.stories.tsx next to it, or, if it renders nothing a story could show," +
      "\nadd it to ALLOWED in scripts/check-stories.mjs with the reason."
  );
}
if (stale.length) {
  console.log(`\nALLOWED lists files that no longer exist: ${stale.join(", ")}`);
}
console.log(
  `\n${components.length} component files · ${stories.length} story files · ${missing.length} without stories`
);
process.exit(missing.length || stale.length ? 1 : 0);
