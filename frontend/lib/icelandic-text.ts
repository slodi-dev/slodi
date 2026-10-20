/**
 * Sorting and searching Icelandic text. `localeCompare("is")` can't be trusted:
 * Chrome ships no is-IS collation data, so á sorts after z there.
 */

const ALPHABET = "aábcdðeéfghiíjklmnoópqrstuúvwxyýzþæö";

/** Icelandic alphabetical order: á after a, ð after d, þ æ ö last. Ignores case. */
export function compareIs(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const ix = ALPHABET.indexOf(x[i]);
    const iy = ALPHABET.indexOf(y[i]);
    const dx = ix === -1 ? 100 + x.charCodeAt(i) : ix;
    const dy = iy === -1 ? 100 + y.charCodeAt(i) : iy;
    if (dx !== dy) return dx - dy;
  }
  return x.length - y.length;
}

/**
 * Lower case without accents, for searching: "jon" finds "Jón". ð, þ and æ are
 * letters of their own, not accented ones, so they stay as they are.
 */
export function foldIs(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}
