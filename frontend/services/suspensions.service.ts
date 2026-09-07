import { buildApiUrl } from "@/lib/api-utils";
import { fetchWithAuth } from "@/lib/api";

/**
 * Skammarkrókur — a timed pause on submitting.
 *
 * The person keeps reading, filtering, favourites, likes and **reporting**.
 * Taking away someone's ability to flag genuinely unsafe content because they
 * are themselves under review helps nobody.
 */

export type Suspension = {
  id: string;
  user_id: string;
  starts_at: string;
  expires_at: string;
  reason: string;
  lifted_at: string | null;
  lift_reason: string | null;
  issued_by_name: string | null;
  lifted_by_name: string | null;
  is_active: boolean;
};

/**
 * Three separate numbers on purpose. Reports received is context — anyone can
 * be reported. Strikes are decisions a moderator actually made. Suspensions are
 * what was done about them. One combined score would hide the difference
 * between being complained about and being wrong.
 */
export type AuthorStanding = {
  author_id: string;
  reports_received: number;
  strikes: number;
  suspensions: Suspension[];
  active_suspension: Suspension | null;
};

/** A moderator may suspend for up to this long; beyond it is an admin's call. */
export const MODERATOR_MAX_DAYS = 90;

/** The lengths offered as one click each. */
export const SUSPENSION_PRESETS = [7, 30, 90] as const;

type GetToken = () => Promise<string | null>;

export async function fetchAuthorStanding(
  authorId: string,
  getToken: GetToken
): Promise<AuthorStanding> {
  return fetchWithAuth<AuthorStanding>(
    buildApiUrl(`/moderation/authors/${authorId}/standing`),
    {},
    getToken
  );
}

export async function suspendAuthor(
  authorId: string,
  days: number,
  reason: string,
  getToken: GetToken
): Promise<Suspension> {
  return fetchWithAuth<Suspension>(
    buildApiUrl(`/moderation/authors/${authorId}/suspensions`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days, reason: reason.trim() }),
    },
    getToken
  );
}

export async function liftSuspension(
  suspensionId: string,
  reason: string,
  getToken: GetToken
): Promise<Suspension> {
  return fetchWithAuth<Suspension>(
    buildApiUrl(`/moderation/suspensions/${suspensionId}/lift`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    },
    getToken
  );
}

/**
 * My own status, so the bank can say so on arrival rather than letting someone
 * write something and refusing it afterwards. Null means nothing to say.
 */
export async function fetchMySuspension(getToken: GetToken): Promise<Suspension | null> {
  return fetchWithAuth<Suspension | null>(buildApiUrl("/users/me/suspension"), {}, getToken);
}

/**
 * Am *I* currently suspended?
 *
 * Read from the 403 the API already returns on a write, not from a separate
 * poll: the answer changes rarely, and a banner that disagrees with what the
 * server just said is worse than no banner.
 */
export function suspendedUntilFromError(error: unknown): string | null {
  const message = error instanceof Error ? error.message : "";
  const match = message.match(/fram til (\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}
