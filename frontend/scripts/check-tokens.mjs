#!/usr/bin/env node
/**
 * Design-token audit for the Slóði frontend.
 *
 * Four classes of mistake, every one of which has actually shipped here:
 *
 *  1. `var(--sl-color-…)` without `hsl()`. The colour tokens hold bare HSL
 *     triplets ("142 50% 42%"), so an unwrapped reference is not a colour —
 *     the declaration is dropped and the element renders invisible or
 *     inherits. Completely silent: no build error, no lint error.
 *  2. A token that does not exist. `var()` on an undefined property makes the
 *     whole declaration invalid at computed-value time, so it falls back to
 *     inherited/initial rather than to anything sensible.
 *  3. Hard-coded colours — hex, rgb(), literal hsl(). They do not follow the
 *     theme, so they look right in whichever mode they were written in.
 *  4. The legacy shadcn set (`--background`, `--foreground`, …) in new code.
 *     It still works, but it is a second source of truth and the two sets do
 *     not agree on every shade.
 *
 * Usage:  node scripts/check-tokens.mjs [--strict] [path…]
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TOKENS_FILE = join(ROOT, "app/slodi-tokens.css");

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const roots = args.filter((a) => !a.startsWith("--"));

const tokensCss = readFileSync(TOKENS_FILE, "utf8");
const DEFINED = new Set([...tokensCss.matchAll(/^\s*(--sl-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));
/** Tokens whose value is a bare HSL triplet, so they must be wrapped. */
const NEEDS_HSL = /^--sl-(color|input-(background|border|text|placeholder))/;

const SKIP = new Set(["node_modules", ".next", "dist", "build", "coverage", ".git", "scripts"]);
const EXTS = new Set([".css", ".ts", ".tsx"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTS.has(extname(name))) out.push(full);
  }
  return out;
}

const files = (roots.length ? roots.map((r) => join(ROOT, r)) : [ROOT]).flatMap((p) =>
  statSync(p).isDirectory() ? walk(p) : [p]
);

const findings = [];
const add = (file, line, level, rule, detail) =>
  findings.push({ file: relative(ROOT, file), line, level, rule, detail });

for (const file of files) {
  const isTokenFile = file === TOKENS_FILE;
  const src = readFileSync(file, "utf8");
  const clean = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));

  clean.split("\n").forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim()) return;
    const isDefinition = /^\s*--/.test(raw);

    for (const m of raw.matchAll(/var\((--sl-[a-z0-9-]+)/g)) {
      const token = m[1];
      // A token built by interpolation — `var(--sl-color-patrol-${key})` — is
      // only ever a truncated prefix here. Checking it would report every
      // dynamic token as both missing and unwrapped.
      if (raw.slice(m.index + m[0].length).startsWith("${")) continue;
      if (!DEFINED.has(token)) {
        add(file, line, "error", "unknown-token", `${token} is not defined in slodi-tokens.css`);
      }
      if (NEEDS_HSL.test(token) && !isDefinition) {
        const before = raw.slice(0, m.index);
        const lastHsl = before.lastIndexOf("hsl");
        const wrapped =
          lastHsl !== -1 && !before.slice(lastHsl).includes(")");
        if (!wrapped) {
          add(file, line, "error", "unwrapped-color-token", `use hsl(var(${token}))`);
        }
      }
    }

    if (isTokenFile) return;

    const hex = raw.match(/#[0-9a-fA-F]{3,8}\b/);
    if (hex && !isDefinition) {
      add(file, line, "error", "hardcoded-color", `${hex[0]} — use a --sl-color-* token`);
    }
    const fn = raw.match(/\b(?:rgba?|hsla?)\(\s*\d/);
    if (fn && !/var\(--sl-/.test(raw)) {
      add(file, line, "warn", "literal-color-fn", `${fn[0]}…) — prefer a --sl-color-* token`);
    }
    const legacy = raw.match(
      /var\(--(background|foreground|primary|secondary|muted|accent|border|input|ring|card|popover|destructive)(-[a-z]+)?\)/
    );
    if (legacy) {
      add(file, line, "warn", "legacy-token", `${legacy[0]} — the --sl-* set is the source of truth`);
    }
  });
}

const errors = findings.filter((f) => f.level === "error");
const warns = findings.filter((f) => f.level === "warn");
const byRule = {};
for (const f of findings) (byRule[f.rule] ??= []).push(f);

for (const [rule, list] of Object.entries(byRule).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${list[0].level.toUpperCase()}  ${rule}  (${list.length})`);
  for (const f of list.slice(0, 20)) console.log(`  ${f.file}:${f.line}  ${f.detail}`);
  if (list.length > 20) console.log(`  … and ${list.length - 20} more`);
}
console.log(
  `\n${DEFINED.size} tokens defined · ${files.length} files scanned · ${errors.length} error(s), ${warns.length} warning(s)`
);
process.exit(errors.length || (strict && warns.length) ? 1 : 0);
