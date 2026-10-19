/**
 * Pure helpers for the devlog (Verkbók) list and post views. No `fs` here: the list's client
 * component imports this, and `lib/devlogs.ts` reads the file system.
 */
import type { DevlogMeta } from "@/lib/devlogs";

/** Where the list lives. */
export const DEVLOG_PATH = "/dev";

/** The list's tag filter in the URL: `/dev?merki=leikir`. */
export const TAG_PARAM = "merki";

/** On a post, the list URL the reader came from: `/dev/slug?fra=%2Fdev%3Fmerki%3Dleikir`. */
export const FROM_PARAM = "fra";

/** A post is "Nýtt" for this many days after its date. */
export const NEW_FOR_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today as `YYYY-MM-DD`. The server computes it once and passes it down, so hydration agrees. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** True when `date` is from `today` or up to `NEW_FOR_DAYS` days before it. */
export function isNewPost(date: string, today: string): boolean {
  const age = (Date.parse(today) - Date.parse(date)) / DAY_MS;
  return age >= 0 && age < NEW_FOR_DAYS;
}

/** The fallback cover tints, by token family. */
export const COVER_TINTS = ["primary", "accent", "info", "warning"] as const;
export type CoverTint = (typeof COVER_TINTS)[number];

/** The same post always gets the same fallback cover tint: a hash of its slug. */
export function coverTintOf(slug: string): CoverTint {
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COVER_TINTS[hash % COVER_TINTS.length];
}

/** Every tag in use, most used first; ties keep the order they first appear in (newest first). */
export function tagsByUse(posts: DevlogMeta[]): string[] {
  const counts = new Map<string, number>();
  for (const post of posts)
    for (const tag of post.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
}

/** The list URL for a tag filter, or the bare list. */
export function listHrefFor(tag: string | null): string {
  return tag ? `${DEVLOG_PATH}?${TAG_PARAM}=${encodeURIComponent(tag)}` : DEVLOG_PATH;
}

/** A post's URL. From a filtered list it carries that list's URL, so "back" can return to it. */
export function postHref(slug: string, listHref: string = DEVLOG_PATH): string {
  const href = `${DEVLOG_PATH}/${slug}`;
  return listHref === DEVLOG_PATH ? href : `${href}?${FROM_PARAM}=${encodeURIComponent(listHref)}`;
}

/** Only the devlog list itself: `/dev` or `/dev?…`. Anything else could send the reader off-site. */
export function isDevlogListHref(href: string | null | undefined): href is string {
  return !!href && /^\/dev(\?|$)/.test(href);
}

/**
 * Where "Aftur í Verkbók" goes: the `fra` list URL if there is one, else the referrer when it is
 * the list on this site, else the bare list.
 */
export function backToListHref(
  from: string | null | undefined,
  referrer: string | null | undefined,
  origin: string | null | undefined
): string {
  if (isDevlogListHref(from)) return from;
  if (referrer && origin) {
    try {
      const url = new URL(referrer);
      const path = `${url.pathname}${url.search}`;
      if (url.origin === origin && isDevlogListHref(path)) return path;
    } catch {
      // Not a URL: fall through to the bare list.
    }
  }
  return DEVLOG_PATH;
}
