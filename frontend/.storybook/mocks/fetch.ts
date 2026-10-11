/**
 * A fetch replacement for Storybook. Stories never reach a backend: every
 * request a component makes is answered here from fixture data.
 *
 * - Requests matching a route (story overrides first, then the defaults below)
 *   get a fixture response.
 * - Any other cross-origin request is refused, so a missed route shows up as a
 *   console warning rather than a silent call to production.
 * - Same-origin requests that match nothing (Storybook's own files) pass through.
 *
 * A story can add or override routes:
 *
 *   parameters: {
 *     mockApi: [{ match: /\/content\b/, status: 500, body: { detail: "Villa" } }],
 *   }
 */
import {
  programs,
  tags,
  users,
  userMember,
  userModerator,
  userAdmin,
  workspace,
} from "@/stories/fixtures";
import type { User } from "@/services/users.service";
import type { AuthorStanding } from "@/services/suspensions.service";

export type MockRoute = {
  /** Matched against `pathname + search` of the request URL. */
  match: RegExp | string;
  method?: string;
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  /** Milliseconds before responding. Use `Infinity` to hold a loading state. */
  delay?: number;
};

export type AuthMode = "anonymous" | "member" | "moderator" | "admin" | "loading";

const AUTH_USERS: Record<Exclude<AuthMode, "anonymous" | "loading">, User> = {
  member: userMember,
  moderator: userModerator,
  admin: userAdmin,
};

let authMode: AuthMode = "member";
let storyRoutes: MockRoute[] = [];

export function setMockAuthMode(mode: AuthMode) {
  authMode = mode;
}

export function getMockAuthMode(): AuthMode {
  return authMode;
}

export function setStoryRoutes(routes: MockRoute[] | undefined) {
  storyRoutes = routes ?? [];
}

export function currentMockUser(): User | null {
  if (authMode === "anonymous" || authMode === "loading") return null;
  return AUTH_USERS[authMode];
}

function defaultRoutes(): MockRoute[] {
  const user = currentMockUser();
  return [
    // Auth0 session and token routes (Next route handlers in the app).
    {
      match: /^\/auth\/profile/,
      status: user ? 200 : 204,
      body: user ? { sub: user.auth0_id, name: user.name, email: user.email } : undefined,
    },
    { match: /^\/api\/auth\/token/, status: user ? 200 : 401, body: { accessToken: "sb-token" } },

    // Users
    { match: /\/users\/me\/workspaces/, body: [workspace] },
    { match: /\/users\/me\/suspension/, status: 204 },
    { match: /\/users\/me$/, status: user ? 200 : 401, body: user },
    {
      match: /\/users\/admin\/list/,
      body: { items: users, total: users.length },
      headers: { "X-Total-Count": String(users.length) },
    },

    // Content
    { match: /\/content\/[^/]+\/likes/, status: 204 },
    { match: /\/content\/[^/]+\/comments/, body: programs[0].comments ?? [] },
    { match: /\/content\/facets/, body: facets() },
    {
      match: /\/content(\?|$)/,
      body: programs,
      headers: { "X-Total-Count": String(programs.length) },
    },
    {
      match: /\/(content|programs)\/([^/?]+)/,
      body: (url: URL) => programs.find((p) => url.pathname.endsWith(`/${p.id}`)) ?? programs[0],
    },

    // Workspaces
    { match: /\/workspaces\/[^/]+\/my-role/, body: { role: "editor" } },
    { match: /\/workspaces\/[^/]+\/members/, body: [] },

    // Tags
    { match: /\/tags/, body: tags },

    // Favourites (FavoritesContext talks to a Next route that does not exist yet)
    { match: /^\/api\/users\/me\/favorites/, status: 204 },

    // Moderation
    {
      match: /\/moderation\/queue/,
      body: programs.slice(0, 3),
      headers: { "X-Total-Count": "3" },
    },
    { match: /\/moderation\/authors\/[^/]+\/standing/, body: standing() },
    { match: /\/moderation\/reports/, body: [], headers: { "X-Total-Count": "0" } },

    // Leikir
    { match: /\/heidursordla/, status: 404, body: { detail: "Ekkert orð í dag" } },
    { match: /\/(scores|leaderboard)/, body: [] },

    // Emails
    { match: /\/emails\/templates/, body: [] },
    { match: /\/emails\/drafts/, body: [] },

    // Health
    { match: /\/health/, body: { status: "ok" } },
  ];
}

function facets() {
  return {
    locations: Array.from(new Set(programs.map((p) => p.location).filter(Boolean))),
    equipment: Array.from(new Set(programs.flatMap((p) => p.equipment ?? []))),
    authors: Array.from(new Set(programs.map((p) => p.author_name))),
    tags: tags.map((t) => t.name),
  };
}

function standing(): AuthorStanding {
  return {
    author_id: userMember.id,
    reports_received: 0,
    strikes: 0,
    suspensions: [],
    active_suspension: null,
  };
}

function matches(route: MockRoute, url: URL, method: string) {
  if (route.method && route.method.toUpperCase() !== method) return false;
  const target = url.pathname + url.search;
  return typeof route.match === "string" ? target.includes(route.match) : route.match.test(target);
}

type BodyFn = (url: URL) => unknown;

async function respond(route: MockRoute, url: URL): Promise<Response> {
  if (route.delay) {
    await new Promise((resolve) => {
      if (Number.isFinite(route.delay)) setTimeout(resolve, route.delay);
    });
  }
  const status = route.status ?? 200;
  const body = typeof route.body === "function" ? (route.body as BodyFn)(url) : route.body;
  if (status === 204 || body === undefined) {
    return new Response(null, { status: status === 200 ? 204 : status, headers: route.headers });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...route.headers },
  });
}

let installed = false;

export function installMockFetch() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = input instanceof Request ? input.url : String(input);
    const url = new URL(raw, window.location.href);
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();

    // In-memory URLs never leave the browser; their origin is "null".
    if (url.protocol === "data:" || url.protocol === "blob:") return realFetch(input, init);

    const route = [...storyRoutes, ...defaultRoutes()].find((r) => matches(r, url, method));
    if (route) return respond(route, url);

    if (url.origin !== window.location.origin) {
      console.warn(`[storybook mock fetch] blocked ${method} ${url.href} — add a mockApi route`);
      return new Response(JSON.stringify({ detail: "Blocked by Storybook mock" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(input, init);
  };
}
