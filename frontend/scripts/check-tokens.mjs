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

const DEFINITION = /(--sl-[a-z0-9-]+)\s*:/g;

/**
 * The global vocabulary: the token file plus the two sheets that legitimately
 * extend it. `globals.css` carries the legacy shadcn bridge and
 * `slodi-utilities.css` the `sl-*` helpers.
 */
const GLOBAL_SHEETS = [
  TOKENS_FILE,
  join(ROOT, "app/globals.css"),
  join(ROOT, "app/slodi-utilities.css"),
];

const DEFINED = new Set();
for (const sheet of GLOBAL_SHEETS) {
  let css;
  try {
    css = readFileSync(sheet, "utf8");
  } catch {
    continue;
  }
  for (const m of css.matchAll(DEFINITION)) DEFINED.add(m[1]);
}
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

/**
 * Second pass of the vocabulary: properties declared by components.
 *
 * `--sl-medal-gold` is declared on the hub and consumed by the podium beneath
 * it — a perfectly ordinary cascade, and file scope is too narrow to see it.
 * A property declared anywhere in the app resolves at runtime, so the rule
 * that matters is "declared nowhere", not "declared somewhere else".
 */
for (const file of files) {
  const src = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of src.matchAll(DEFINITION)) DEFINED.add(m[1]);
}

const findings = [];
const add = (file, line, level, rule, detail) =>
  findings.push({ file: relative(ROOT, file), line, level, rule, detail });

for (const file of files) {
  const isTokenFile = file === TOKENS_FILE;
  const src = readFileSync(file, "utf8");
  const clean = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));

  /** Properties this file declares for itself. */
  const localTokens = new Set([...clean.matchAll(DEFINITION)].map((m) => m[1]));

  const srcLines = src.split("\n");

  /* Whole-file opt-out, for files where no line could use a token — a canvas
     2D context reads no CSS at all. */
  if (src.includes("token-check-ignore-file")) continue;

  clean.split("\n").forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim()) return;

    /*
     * An opt-out, because a few places legitimately cannot use a token:
     * canvas drawing reads no CSS, and a documentation page prints token
     * names as prose. Silence has to be declared and justified in the source
     * rather than assumed by the rule, so the marker carries a reason.
     */
    const own = srcLines[i] ?? "";
    const prev = srcLines[i - 1] ?? "";
    if (own.includes("token-check-ignore") || prev.includes("token-check-ignore")) return;
    const isDefinition = /^\s*--/.test(raw);

    for (const m of raw.matchAll(/var\((--sl-[a-z0-9-]+)/g)) {
      const token = m[1];
      // A token built by interpolation — `var(--sl-color-patrol-${key})` — is
      // only ever a truncated prefix here. Checking it would report every
      // dynamic token as both missing and unwrapped.
      if (raw.slice(m.index + m[0].length).startsWith("${")) continue;
      // A component may define its own `--sl-*` property — `--sl-medal-gold`
      // in LeikirHub, `--ef-accent` on the item page. Those are file-scoped,
      // not missing, and reporting them taught the reader to ignore the rule.
      if (!DEFINED.has(token) && !localTokens.has(token)) {
        add(file, line, "error", "unknown-token", `${token} is not defined`);
      }
      // Assigning a token to a custom property — in CSS or from JS — is an
      // alias, and an alias must stay a bare triplet: the consumer wraps it,
      // and `hsl(hsl(...))` is invalid. Covers `--x: var(--sl-color-y)`,
      // `{"--x": \`var(--sl-color-y)\`}` and `setProperty("--x", ...)`.
      const isAlias =
        isDefinition || /(["']--[a-z0-9-]+["']\s*[:,]|setProperty\(\s*["']--)/.test(raw);
      if (NEEDS_HSL.test(token) && !isAlias) {
        const before = raw.slice(0, m.index);
        const lastHsl = before.lastIndexOf("hsl");
        const wrapped = lastHsl !== -1 && !before.slice(lastHsl).includes(")");
        if (!wrapped) {
          add(file, line, "error", "unwrapped-color-token", `use hsl(var(${token}))`);
        }
      }
    }

    if (isTokenFile) return;

    // `&#8594;` is a right arrow, not a colour. Require the # to be preceded
    // by something other than `&`, and to be a valid hex length.
    const hex = raw.match(/(?<![&\w])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/);
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
      add(
        file,
        line,
        "warn",
        "legacy-token",
        `${legacy[0]} — the --sl-* set is the source of truth`
      );
    }
  });
}

const errors = findings.filter((f) => f.level === "error");
const warns = findings.filter((f) => f.level === "warn");
const byRule = {};
for (const f of findings) (byRule[f.rule] ??= []).push(f);

for (const [rule, list] of Object.entries(byRule).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${list[0].level.toUpperCase()}  ${rule}  (${list.length})`);
  // Twenty lines is enough to notice a problem and not enough to fix one, so
  // `--all` prints the lot.
  const limit = process.argv.includes("--all") ? list.length : 20;
  for (const f of list.slice(0, limit)) console.log(`  ${f.file}:${f.line}  ${f.detail}`);
  if (list.length > limit) console.log(`  … and ${list.length - limit} more (run with --all)`);
}
console.log(
  `\n${DEFINED.size} tokens defined · ${files.length} files scanned · ${errors.length} error(s), ${warns.length} warning(s)`
);
process.exit(errors.length || (strict && warns.length) ? 1 : 0);
