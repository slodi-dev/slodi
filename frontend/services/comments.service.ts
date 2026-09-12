import { buildApiUrl } from "@/lib/api-utils";
import { fetchWithAuth } from "@/lib/api";
import type { ContentComment } from "./programs.service";

type GetToken = () => Promise<string | null>;

/**
 * Post a comment on a bank item.
 *
 * The author is taken from the token on the server, not from the payload —
 * the request body is only the text. A suspended leader is refused here by
 * `require_not_suspended`, which is why the caller surfaces the error rather
 * than swallowing it.
 */
export async function createComment(
  contentId: string,
  body: string,
  getToken: GetToken
): Promise<ContentComment> {
  return fetchWithAuth<ContentComment>(
    buildApiUrl(`/content/${contentId}/comments`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
    getToken
  );
}
