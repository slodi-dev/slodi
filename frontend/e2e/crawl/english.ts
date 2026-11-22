/**
 * Leftover English in the UI.
 *
 * Slóði's UI is Icelandic. An English button label or loading text is almost
 * always a string someone forgot to translate. This check is deliberately
 * conservative: a short denylist of words that are common UI chrome in English
 * and are not Icelandic words, matched case-sensitively as whole words.
 *
 * Where it looks:
 * - visible text, except inside `code`, `pre`, `kbd`, `samp`, `script`, `style`,
 *   `svg`, `textarea`, `[contenteditable]` and anything marked
 *   `translate="no"` or `data-user-content` (user-written text, brand names);
 * - `aria-label`, `title`, `placeholder` and `alt` attributes, which a screen
 *   reader or a tooltip shows even when the text isn't on screen.
 *
 * What it doesn't catch: English sentences without a denylisted word. The
 * list is tuned for no false positives, not for recall; add a word when a
 * real leftover slips through, and exempt a place with `translate="no"`.
 */
import type { Page } from "@playwright/test";

/** Common English UI words that are not also Icelandic. Capitalised: UI labels are. */
export const ENGLISH_UI_WORDS = [
  "Loading",
  "Save",
  "Cancel",
  "Delete",
  "Edit",
  "Submit",
  "Error",
  "Sign in",
  "Sign up",
  "Sign out",
  "Log in",
  "Log out",
  "Logout",
  "Login",
  "Like",
  "Unlike",
  "Share",
  "Search",
  "Close",
  "Settings",
  "Profile",
  "Retry",
  "Try again",
  "Something went wrong",
  "Not found",
  "Untitled",
  "Unknown",
  "Previous",
  "Show more",
  "Read more",
  "Required",
  "Upload",
  "Download",
  "Confirm",
  "Remove",
] as const;

export async function findEnglish(page: Page): Promise<string[]> {
  return page.evaluate(
    (words) => {
      const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      // Whole word, not part of a longer word, identifier or file name:
      // "Save" matches, "Saved", "save_as" and "Next.js" don't.
      const re = new RegExp(
        `(?<![\\p{L}\\p{N}_.\\-/])(${escaped.join("|")})(?![\\p{L}\\p{N}_\\-/]|\\.\\p{L})`,
        "u"
      );
      const SKIP =
        'code, pre, kbd, samp, script, style, noscript, svg, textarea, [contenteditable=""], [contenteditable="true"], [translate="no"], [data-user-content]';
      const hits = new Set<string>();
      const describe = (el: Element) => {
        const role = el.getAttribute("role");
        return `<${el.tagName.toLowerCase()}${role ? ` role=${role}` : ""}>`;
      };

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.trim();
        const el = node.parentElement;
        if (!text || !el || el.closest(SKIP)) continue;
        if (!el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true })) continue;
        const m = text.match(re);
        if (m) hits.add(`"${m[1]}" in text ${describe(el)}: "${text.slice(0, 80)}"`);
      }

      for (const attr of ["aria-label", "title", "placeholder", "alt"]) {
        for (const el of Array.from(document.body.querySelectorAll(`[${attr}]`))) {
          if (el.closest(SKIP)) continue;
          const value = el.getAttribute(attr) ?? "";
          const m = value.match(re);
          if (m) hits.add(`"${m[1]}" in ${attr} of ${describe(el)}: "${value.slice(0, 80)}"`);
        }
      }
      // The tab title, too.
      const t = document.title.match(re);
      if (t) hits.add(`"${t[1]}" in <title>: "${document.title}"`);
      return [...hits];
    },
    ENGLISH_UI_WORDS as readonly string[]
  );
}
