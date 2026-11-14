/**
 * Mock data and API routes for the tag-management stories. Story-only.
 */
import type { MockRoute } from "@/.storybook/mocks/fetch";
import type { Tag } from "@/services/tags.service";

/** The bank's tags with how many items carry each. */
export const SAMPLE_USAGE: [Tag, number][] = [
  [{ id: "t-1", name: "Útilíf" }, 23],
  [{ id: "t-2", name: "Ratleikni" }, 11],
  [{ id: "t-3", name: "Hnútar" }, 8],
  [{ id: "t-4", name: "Kvöldvaka" }, 21],
  [{ id: "t-5", name: "Hefðir" }, 5],
  [{ id: "t-6", name: "Umhyggja" }, 3],
  [{ id: "t-7", name: "Söngur" }, 14],
  [{ id: "t-8", name: "Eldamennska" }, 6],
  [{ id: "t-9", name: "Skyndihjálp" }, 9],
  [{ id: "t-10", name: "Áttaviti" }, 4],
  [{ id: "t-11", name: "Þrautir" }, 1],
  [{ id: "t-13", name: "Föndur" }, 0],
  [{ id: "t-14", name: "Umhverfisvernd og samfélagsverkefni í nærumhverfi" }, 2],
  [{ id: "t-15", name: "Útivistarleiðtogaþjálfunarnámskeiðsundirbúningur" }, 1],
  [{ id: "t-16", name: "Drekaskátar" }, 12],
];

export const SAMPLE_TAGS: Tag[] = SAMPLE_USAGE.map(([tag]) => tag);

const MORE_NAMES = [
  "Sund",
  "Fjallganga",
  "Útilega",
  "Vetrarstarf",
  "Alþjóðastarf",
  "Leiðtogaþjálfun",
  "Ratleikir",
  "Tjaldbúðir",
  "Varðeldur",
  "Kortalestur",
  "Súrrun",
  "Sjóskátar",
  "Fálkaskátar",
  "Dróttskátar",
  "Rekkaskátar",
  "Róverskátar",
  "Vígsla",
  "Sumardagurinn fyrsti",
  "Skátaheitið",
  "Fjáröflun",
  "Hjálparsveit",
  "Fyrsta hjálp",
  "Næturleikur",
  "Gönguferð",
  "Vatnaleikir",
  "Vetrarútilega",
  "Útieldun",
  "Klifur",
  "Bátar",
  "Leikir",
];

/** Enough tags for three pages. */
export const MANY_TAGS: Tag[] = [
  ...SAMPLE_TAGS,
  ...MORE_NAMES.map((name, i) => ({ id: `t-x${i}`, name })),
];

/** `GET /tags`, with the total header the page reads to know it has them all. */
export function listRoute(tags: Tag[], extra: Partial<MockRoute> = {}): MockRoute {
  return {
    method: "GET",
    match: /\/tags\?/,
    body: tags,
    headers: { "X-Total-Count": String(tags.length) },
    ...extra,
  };
}

/** `GET /tags/{id}/content?limit=1` for each tag, answering its count in `X-Total-Count`. */
export function usageRoutes(usage: [Tag, number][] = SAMPLE_USAGE): MockRoute[] {
  return usage.map(([tag, count]) => ({
    method: "GET",
    match: new RegExp(`/tags/${tag.id}/content`),
    body: [],
    headers: { "X-Total-Count": String(count) },
  }));
}

export function createdRoute(tag: Tag): MockRoute {
  return { method: "POST", match: /\/tags$/, status: 201, body: tag };
}

export function renamedRoute(tag: Tag): MockRoute {
  return { method: "PATCH", match: new RegExp(`/tags/${tag.id}$`), body: tag };
}

export const deletedRoute: MockRoute = {
  method: "DELETE",
  match: /\/tags\/[^/?]+$/,
  status: 204,
};

/** The page's usual answers: the sample tags, their counts, and every write succeeding. */
export const pageRoutes: MockRoute[] = [listRoute(SAMPLE_TAGS), ...usageRoutes(), deletedRoute];
