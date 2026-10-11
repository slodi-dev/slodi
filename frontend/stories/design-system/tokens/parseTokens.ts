/**
 * Reads `app/slodi-tokens.css` and works out what every `--sl-*` token
 * resolves to under each theme, the way the browser's cascade would on <html>.
 *
 * The Tokens docs page is built from this, so it can never drift from the CSS:
 * add a token to the file and it appears on the page.
 *
 * Deliberately small. It understands exactly the selectors the token file uses
 * (`:root`, `:root.dark`, `[data-theme="…"]`, comma lists of those) and skips
 * `@media` blocks — those follow the OS, not the in-app theme toggle.
 */

export const THEMES = ["light", "dark", "forest-night", "campfire", "northern-lights"] as const;
export type ThemeName = (typeof THEMES)[number];

export type Declaration = { name: string; value: string; order: number };
type Rule = { selectors: string[]; decls: Declaration[]; media: string | null };

export type ResolvedToken = {
  name: string;
  /** Value as written in the CSS for this theme, before `var()` is resolved. */
  declared: string;
  /** Fully resolved value, or null if a `var()` points at an undeclared token. */
  resolved: string | null;
  /** Undeclared names this token depends on, if any. */
  missing: string[];
};

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Split a stylesheet into rules, tracking one level of `@media` nesting. */
export function parseRules(css: string): Rule[] {
  const src = stripComments(css);
  const rules: Rule[] = [];
  let order = 0;

  function walk(text: string, media: string | null) {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf("{", i);
      if (open === -1) break;
      const prelude = text.slice(i, open).trim();
      // Find the matching close brace.
      let depth = 1;
      let j = open + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}") depth--;
        j++;
      }
      const body = text.slice(open + 1, j - 1);
      if (prelude.startsWith("@media")) {
        walk(body, prelude.replace(/^@media\s*/, ""));
      } else if (!prelude.startsWith("@")) {
        const decls: Declaration[] = [];
        // Declarations: split on `;` outside parentheses.
        let depthP = 0;
        let start = 0;
        const parts: string[] = [];
        for (let k = 0; k < body.length; k++) {
          const c = body[k];
          if (c === "(") depthP++;
          else if (c === ")") depthP--;
          else if (c === ";" && depthP === 0) {
            parts.push(body.slice(start, k));
            start = k + 1;
          }
        }
        parts.push(body.slice(start));
        for (const part of parts) {
          const m = part.match(/^\s*(--[\w-]+)\s*:\s*([\s\S]*?)\s*$/);
          if (m) decls.push({ name: m[1], value: m[2].replace(/\s+/g, " "), order: order++ });
        }
        rules.push({
          selectors: prelude.split(",").map((s) => s.trim()),
          decls,
          media,
        });
      }
      i = j;
    }
  }

  walk(src, null);
  return rules;
}

/**
 * Specificity of a selector part when it matches <html> in the given theme, or
 * null when it does not match. Mirrors what ThemeProvider sets: `class="dark"`
 * for dark, `data-theme="…"` for the named themes, nothing for light.
 */
function matchSpecificity(selector: string, theme: ThemeName): number | null {
  const s = selector.replace(/\s+/g, "");
  if (s === ":root") return 10;
  if (s === ":root.dark") return theme === "dark" ? 20 : null;
  const attr = s.match(/^(?::root)?\[data-theme=["']?([\w-]+)["']?\]$/);
  if (attr) {
    // `dark` never sets data-theme in the app; the block is matched by its
    // `:root.dark` sibling instead.
    if (attr[1] !== theme || theme === "dark" || theme === "light") return null;
    return s.startsWith(":root") ? 20 : 10;
  }
  return null;
}

/** Winning declaration per custom property for one theme, by specificity then order. */
export function cascade(rules: Rule[], theme: ThemeName): Map<string, Declaration> {
  const winners = new Map<string, { decl: Declaration; spec: number }>();
  for (const rule of rules) {
    if (rule.media) continue;
    const specs = rule.selectors
      .map((sel) => matchSpecificity(sel, theme))
      .filter((x): x is number => x !== null);
    if (specs.length === 0) continue;
    const spec = Math.max(...specs);
    for (const decl of rule.decls) {
      const prev = winners.get(decl.name);
      if (!prev || spec > prev.spec || (spec === prev.spec && decl.order > prev.decl.order)) {
        winners.set(decl.name, { decl, spec });
      }
    }
  }
  return new Map([...winners].map(([k, v]) => [k, v.decl]));
}

/** Replace every `var(--x[, fallback])` with its value, recursively. */
export function resolveValue(
  value: string,
  table: Map<string, Declaration>,
  missing: Set<string> = new Set(),
  seen: Set<string> = new Set()
): string | null {
  let out = "";
  let i = 0;
  while (i < value.length) {
    const at = value.indexOf("var(", i);
    if (at === -1) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, at);
    // Find matching paren.
    let depth = 1;
    let j = at + 4;
    while (j < value.length && depth > 0) {
      if (value[j] === "(") depth++;
      else if (value[j] === ")") depth--;
      j++;
    }
    const inner = value.slice(at + 4, j - 1);
    const comma = inner.indexOf(",");
    const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma === -1 ? null : inner.slice(comma + 1).trim();
    const decl = table.get(name);
    let replacement: string | null = null;
    if (decl && !seen.has(name)) {
      replacement = resolveValue(decl.value, table, missing, new Set([...seen, name]));
    } else if (fallback !== null) {
      replacement = resolveValue(fallback, table, missing, seen);
    } else {
      missing.add(name);
    }
    if (replacement === null) return null;
    out += replacement;
    i = j;
  }
  return out.replace(/\s+/g, " ").trim();
}

export type TokenSet = {
  names: string[];
  byTheme: Record<ThemeName, Map<string, ResolvedToken>>;
};

export function buildTokenSet(css: string): TokenSet {
  const rules = parseRules(css);
  const byTheme = {} as TokenSet["byTheme"];
  const all = new Set<string>();
  for (const theme of THEMES) {
    const table = cascade(rules, theme);
    const resolved = new Map<string, ResolvedToken>();
    for (const [name, decl] of table) {
      if (!name.startsWith("--sl-")) continue;
      const missing = new Set<string>();
      resolved.set(name, {
        name,
        declared: decl.value,
        resolved: resolveValue(decl.value, table, missing),
        missing: [...missing],
      });
      all.add(name);
    }
    byTheme[theme] = resolved;
  }
  return { names: [...all], byTheme };
}

/** A bare HSL triplet, optionally with alpha: `142 50% 42%` or `142 50% 42% / 0.3`. */
export function isHslTriplet(value: string | null): value is string {
  return !!value && /^-?[\d.]+(deg)?\s+[\d.]+%\s+[\d.]+%(\s*\/\s*[\d.]+%?)?$/.test(value.trim());
}

export type TokenGroup =
  | "patrol"
  | "primitive-color"
  | "semantic-color"
  | "component-color"
  | "spacing"
  | "radius"
  | "typography"
  | "shadow"
  | "z-index"
  | "other";

const PATROLS = ["drekar", "falkar", "drott", "rekkar", "rover", "adrir"];

export function groupOf(name: string, lightValue: string | null): TokenGroup {
  const isColor = isHslTriplet(lightValue);
  if (PATROLS.some((p) => name.includes(`-patrol-${p}`)) && isColor) return "patrol";
  if (/^--sl-(primitive-)?(z|z-index)-/.test(name)) return "z-index";
  if (/^--sl-(primitive-)?shadow-/.test(name)) return "shadow";
  if (/^--sl-(primitive-)?radius-/.test(name)) return "radius";
  if (/^--sl-(primitive-)?(spacing|space)-/.test(name)) return "spacing";
  if (/^--sl-(primitive-)?(text|font|line-height|letter-spacing)-/.test(name)) return "typography";
  if (isColor) {
    if (name.startsWith("--sl-primitive-")) return "primitive-color";
    if (name.startsWith("--sl-color-")) return "semantic-color";
    return "component-color";
  }
  return "other";
}
