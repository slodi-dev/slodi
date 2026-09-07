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
