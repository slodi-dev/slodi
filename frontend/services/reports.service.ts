import { buildApiUrl } from "@/lib/api-utils";
import { fetchWithAuth } from "@/lib/api";

/**
 * Reporting content that does not belong.
 *
 * Once anyone with an account can submit to the dagskrárbanki, anyone with an
 * account needs to be able to flag. One report per person per item — the
 * backend treats a second filing as the same report rather than an error, so
 * the UI never has to explain a duplicate away.
 */

/**
 * `unsafe` is deliberately separate from `inappropriate`. The first is a
 * safeguarding matter that is emailed to Dagskrárstjórnarteymið and reviewed
 * within the day; the second is a quality judgement that waits for the next
 * sweep of the board. Collapsing them would bury the one that cannot wait.
 */
export type ReportReason =
  | "inappropriate"
  | "unsafe"
  | "spam"
  | "duplicate"
  | "wrong_type"
  | "other";

export type ReportStatus = "open" | "resolved" | "dismissed";

export type ContentReport = {
  id: string;
  content_id: string;
  /** Set when the report is about a comment under the item, not the item. */
  comment_id?: string | null;
  reporter_id: string;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  created_at: string;
};

/** What each reason says to the person filing it. */
export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  inappropriate: "Á ekki heima í bankanum",
  unsafe: "Getur verið hættulegt",
  spam: "Auglýsing eða rusl",
  duplicate: "Til nú þegar",
  wrong_type: "Rangur flokkur",
  other: "Annað",
};

/**
 * The order they are offered in. `unsafe` sits second rather than last: it is
 * the one the team most needs to hear about, and a reason nobody scrolls to is
 * a reason nobody picks.
 */
export const REPORT_REASONS: ReportReason[] = [
  "inappropriate",
  "unsafe",
  "spam",
  "duplicate",
  "wrong_type",
  "other",
];

/**
 * What a comment can be reported for. `duplicate` and `wrong_type` describe an
 * item and the backend refuses them on a comment (`COMMENT_REPORT_REASONS`);
 * the other four keep their values, so escalation and the board are unchanged,
 * and only the wording moves.
 */
export type CommentReportReason = Extract<
  ReportReason,
  "inappropriate" | "unsafe" | "spam" | "other"
>;

export const COMMENT_REPORT_REASON_LABEL: Record<CommentReportReason, string> = {
  inappropriate: "Dónalegt eða særandi",
  unsafe: "Getur verið hættulegt",
  spam: "Auglýsing eða rusl",
  other: "Annað",
};

/** Same order rule as `REPORT_REASONS`: `unsafe` second. */
export const COMMENT_REPORT_REASONS: CommentReportReason[] = [
  "inappropriate",
  "unsafe",
  "spam",
  "other",
];

/** A reason as the reader of a report should see it, for an item or a comment. */
export function reportReasonLabel(report: Pick<ContentReport, "reason" | "comment_id">): string {
  if (report.comment_id && report.reason in COMMENT_REPORT_REASON_LABEL) {
    return COMMENT_REPORT_REASON_LABEL[report.reason as CommentReportReason];
  }
  return REPORT_REASON_LABEL[report.reason];
}

export const REPORT_NOTE_MAX = 500;

type GetToken = () => Promise<string | null>;

export async function reportContent(
  contentId: string,
  reason: ReportReason,
  note: string | undefined,
  getToken: GetToken
): Promise<ContentReport> {
  return fetchWithAuth<ContentReport>(
    buildApiUrl(`/content/${contentId}/reports`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, note: note?.trim() || null }),
    },
    getToken
  );
}

/**
 * Flag a comment.
 *
 * A separate target from the item it hangs under: the two are different
 * complaints, and reporting one must not be mistaken for the other.
 */
export async function reportComment(
  commentId: string,
  reason: CommentReportReason,
  note: string | undefined,
  getToken: GetToken
): Promise<ContentReport> {
  return fetchWithAuth<ContentReport>(
    buildApiUrl(`/comments/${commentId}/reports`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, note: note?.trim() || null }),
    },
    getToken
  );
}
