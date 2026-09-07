import { buildApiUrl } from "@/lib/api-utils";
import { type Page, fetchPageWithAuth, fetchWithAuth } from "@/lib/api";
import type { ContentReport, ReportReason } from "@/services/reports.service";

/**
 * Yfirferð — what Dagskrárstjórnarteymið reads and acts on.
 *
 * Two queues, because they answer different questions. **Óyfirfarið** is
 * everything nobody has looked at yet; **Tilkynningar** is what someone has
 * objected to. An item can be in both.
 */

export type ReviewState = "unreviewed" | "approved" | "rejected";
export type ContentType = "program" | "event" | "task";

export type ReviewQueueItem = {
  id: string;
  content_type: ContentType;
  name: string;
  description: string | null;
  instructions: string | null;
  author_id: string;
  author_name: string;
  created_at: string;
  review_state: ReviewState;
  hidden_at: string | null;
  review_note: string | null;
  /** How many people have objected — the reason a row may be urgent. */
  open_report_count: number;
  /** *Why* they objected, so a reviewer need not open the other tab to find out. */
  open_report_reasons: ReportReason[];
  /** How much of this author's work has already been acted against. */
  author_strikes: number;
  /** Who decided, and when. Absent while it is still unreviewed. */
  reviewed_by_name: string | null;
  reviewed_at: string | null;
};

/** The whole item, for the reading pane. Fetched per selection — instructions
 * run to thousands of characters and a hundred of them would make the list slow
 * to load in order to fill a pane showing one. */
export type ReviewDetail = ReviewQueueItem & {
  equipment: string[] | null;
  duration_min: number | null;
  duration_max: number | null;
  prep_time_min: number | null;
  prep_time_max: number | null;
  count_min: number | null;
  count_max: number | null;
  price: number | null;
  location: string | null;
  age: string[] | null;
  image: string | null;
  tags: string[];
  workspace_id: string;
  reports: { id: string; reason: ReportReason; note: string | null; created_at: string }[];
};

/** What the board is looking at. Default is the unreviewed queue — the working
 * view. The others are the record of what was done. */
export const ALL_STATES = "all";

export type ReviewFilters = {
  review_state?: ReviewState | typeof ALL_STATES;
  hidden?: boolean;
  content_type?: ContentType;
  reported?: boolean;
  search?: string;
  author?: string;
  /** ISO dates. A range over whichever date the current view is ordered by —
   * submitted in the unreviewed queue, decided everywhere else. */
  date_from?: string;
  date_to?: string;
};

export const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  unreviewed: "Óyfirfarið",
  approved: "Samþykkt",
  rejected: "Hafnað",
};

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  task: "Verkefni",
  event: "Viðburður",
  program: "Dagskrá",
};

type GetToken = () => Promise<string | null>;

/** A page at a time. At ten thousand items the board must not try to hold them
 * all: the request is slow, the DOM is slower, and nobody reads past the top. */
export const PAGE_SIZE = 50;

export async function fetchReviewQueue(
  filters: ReviewFilters,
  getToken: GetToken,
  offset = 0
): Promise<Page<ReviewQueueItem>> {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  // `all` for every state, spelled out. An empty `review_state=` is ambiguous
  // between "every state" and "the caller forgot", and the API answers 422 to
  // it. Omitting it entirely gets the unreviewed default, which is not the
  // same thing either.
  params.set("review_state", filters.review_state ?? "unreviewed");
  if (filters.hidden !== undefined) params.set("hidden", String(filters.hidden));
  if (filters.content_type) params.set("content_type", filters.content_type);
  if (filters.reported) params.set("reported", "true");
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.author?.trim()) params.set("author", filters.author.trim());
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  return fetchPageWithAuth<ReviewQueueItem>(
    buildApiUrl(`/moderation/queue?${params}`),
    {},
    getToken
  );
}

export async function fetchReviewDetail(
  contentId: string,
  getToken: GetToken
): Promise<ReviewDetail> {
  return fetchWithAuth<ReviewDetail>(buildApiUrl(`/moderation/content/${contentId}`), {}, getToken);
}

/**
 * A report as the board shows it — with the name and author of what it is
 * about. Without those a reviewer reads a complaint with no subject.
 */
export type ReportQueueItem = ContentReport & {
  content_name: string;
  content_author_name: string;
};

export async function fetchOpenReports(
  getToken: GetToken,
  offset = 0
): Promise<Page<ReportQueueItem>> {
  return fetchPageWithAuth<ReportQueueItem>(
    buildApiUrl(`/moderation/reports?limit=${PAGE_SIZE}&offset=${offset}`),
    {},
    getToken
  );
}

export async function reviewContent(
  contentId: string,
  /** `unreviewed` puts it back in the queue — that is how undo works. */
  reviewState: ReviewState,
  note: string | undefined,
  getToken: GetToken
): Promise<ReviewQueueItem> {
  return fetchWithAuth<ReviewQueueItem>(
    buildApiUrl(`/moderation/content/${contentId}/review`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review_state: reviewState, note: note?.trim() || null }),
    },
    getToken
  );
}

export async function setContentHidden(
  contentId: string,
  hidden: boolean,
  note: string | undefined,
  getToken: GetToken
): Promise<ReviewQueueItem> {
  return fetchWithAuth<ReviewQueueItem>(
    buildApiUrl(`/moderation/content/${contentId}/hidden`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden, note: note?.trim() || null }),
    },
    getToken
  );
}

export async function fetchAuthorStrikes(authorId: string, getToken: GetToken): Promise<number> {
  const r = await fetchWithAuth<{ strikes: number }>(
    buildApiUrl(`/moderation/authors/${authorId}/strikes`),
    {},
    getToken
  );
  return r.strikes;
}

export async function resolveReport(
  reportId: string,
  status: "resolved" | "dismissed",
  note: string | undefined,
  getToken: GetToken
): Promise<ContentReport> {
  return fetchWithAuth<ContentReport>(
    buildApiUrl(`/moderation/reports/${reportId}`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolution_note: note?.trim() || null }),
    },
    getToken
  );
}

export type { ContentReport, ReportReason };
