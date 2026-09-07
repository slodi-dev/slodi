import { buildApiUrl } from "@/lib/api-utils";
import { fetchWithAuth } from "@/lib/api";
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
};

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  task: "Verkefni",
  event: "Viðburður",
  program: "Dagskrá",
};

type GetToken = () => Promise<string | null>;

export async function fetchReviewQueue(getToken: GetToken): Promise<ReviewQueueItem[]> {
  return fetchWithAuth<ReviewQueueItem[]>(buildApiUrl("/moderation/queue?limit=100"), {}, getToken);
}

/**
 * A report as the board shows it — with the name and author of what it is
 * about. Without those a reviewer reads a complaint with no subject.
 */
export type ReportQueueItem = ContentReport & {
  content_name: string;
  content_author_name: string;
};

export async function fetchOpenReports(getToken: GetToken): Promise<ReportQueueItem[]> {
  return fetchWithAuth<ReportQueueItem[]>(
    buildApiUrl("/moderation/reports?limit=100"),
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
