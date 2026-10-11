/**
 * What the crawler should *not* fail on, declared per route and persona.
 *
 * Each entry names the route(s), the persona(s), exactly what is expected,
 * and why. An expected 403 or 404 is part of a page's contract for that
 * persona ("an editor opening someone else's hidden item gets 404"). An entry
 * that tolerates a bug instead carries its Shortcut id in `bug`, matches only
 * that bug's exact message, and is reported as a known bug, so the same page
 * breaking in a new way still fails.
 *
 * `route: "*"` is for the few things that are true of every page, and must
 * say why it can't be narrower.
 */
export const PERSONA_NAMES = ["anonymous", "member", "editor", "admin"] as const;
export type PersonaName = (typeof PERSONA_NAMES)[number];

export type Entry = {
  /** Route as written under app/ (`/programs/[id]`), one path, or "*". */
  route: string;
  personas: readonly PersonaName[] | "all";
  /** Responses with this status whose URL path matches are expected. */
  api?: { status: number; path: RegExp }[];
  /** console.error / uncaught error texts that are expected. */
  console?: RegExp[];
  /** Leftover-English hits (english.ts) that are not leftovers. */
  english?: RegExp[];
  overflow?: boolean;
  /** A signed-out visitor is sent to log in after the page loads. */
  redirectsToLogin?: boolean;
  /** Shortcut story, for an entry that tolerates a bug rather than a contract. */
  bug?: `sc-${number}`;
  why: string;
};

export const ENTRIES: Entry[] = [
  // ── Every page ──────────────────────────────────────────────────────────
  {
    route: "*",
    personas: "all",
    api: [{ status: 404, path: /^\/_vercel\/insights\/script\.js$/ }],
    bug: "sc-589",
    why:
      "<Analytics /> from @vercel/analytics loads /_vercel/insights/script.js, which only " +
      "Vercel serves; Slóði is not deployed there. It is in the root layout, so every page.",
  },
  {
    route: "*",
    personas: ["anonymous"],
    api: [{ status: 401, path: /^\/auth\/profile$/ }],
    why:
      "The Auth0 SDK's useUser() asks /auth/profile who is signed in; 401 is its answer for " +
      "nobody. Any page that renders the user menu asks.",
  },

  // ── Admin pages ─────────────────────────────────────────────────────────
  {
    route: "/admin",
    personas: ["member", "editor"],
    api: [
      { status: 403, path: /^\/users\/admin\/list$/ },
      { status: 403, path: /^\/workspaces\/[0-9a-f-]{36}\/members$/ },
    ],
    console: [/^\[API 403\]/],
    why: "Non-admins get 403 from the user list and see „Þú hefur ekki aðgang að þessari síðu.“",
  },
  {
    route: "/admin/emails",
    personas: ["member", "editor"],
    api: [
      { status: 403, path: /^\/emails\/drafts$/ },
      { status: 403, path: /^\/emails\/templates\/text$/ },
    ],
    console: [/^\[API 403\]/],
    why: "Non-admins get 403 from the email endpoints and see a no-access message.",
  },

  // ── Item pages ──────────────────────────────────────────────────────────
  {
    // Hidden by a moderator; its author (the member) and admins may open it.
    route: "/programs/00000000-0000-4000-8000-0000000000a6",
    personas: ["editor"],
    api: [{ status: 404, path: /^\/content\/00000000-0000-4000-8000-0000000000a6$/ }],
    console: [/^\[API 404\] Not found$/],
    why: "A hidden item is 404 for anyone but its author and moderators; the page says so.",
  },

  // ── Leikir ──────────────────────────────────────────────────────────────
  {
    route: "/leikir/heidursordla",
    personas: ["anonymous"],
    redirectsToLogin: true,
    api: [{ status: 401, path: /^\/api\/auth\/token$/ }],
    console: [/^\[heidursordla\] today failed Error: No authentication token available/],
    why:
      "/leikir is public, but Heiðursorðla keeps score per account: the page asks for a token, " +
      "gets none, and lib/api.ts sends the visitor to log in.",
  },
  {
    route: "/leikir/heidursordla/[puzzleId]",
    personas: ["anonymous"],
    redirectsToLogin: true,
    api: [{ status: 401, path: /^\/api\/auth\/token$/ }],
    console: [/^\[heidursordla\] puzzle state failed Error: No authentication token available/],
    why: "As /leikir/heidursordla: a round needs an account.",
  },
];

export type Expected = {
  redirectsToLogin: boolean;
  /** The entry that expects this, if any. */
  api: (status: number, pathname: string) => Entry | undefined;
  console: (text: string) => Entry | undefined;
  english: (hit: string) => Entry | undefined;
  overflow: () => Entry | undefined;
};

export function expectationsFor(route: string, path: string, persona: PersonaName): Expected {
  const entries = ENTRIES.filter(
    (e) =>
      (e.route === "*" || e.route === route || e.route === path) &&
      (e.personas === "all" || e.personas.includes(persona))
  );
  return {
    redirectsToLogin: entries.some((e) => e.redirectsToLogin),
    api: (status, pathname) =>
      entries.find((e) => e.api?.some((a) => a.status === status && a.path.test(pathname))),
    console: (text) => entries.find((e) => e.console?.some((re) => re.test(text))),
    english: (hit) => entries.find((e) => e.english?.some((re) => re.test(hit))),
    overflow: () => entries.find((e) => e.overflow),
  };
}
