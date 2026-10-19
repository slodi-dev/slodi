/**
 * Rules and copy for the tag-management page: name limits, duplicate checks,
 * Icelandic order, and the one message the reader sees for each failure.
 */
import { countIs } from "@/lib/format";
import { TagRequestError, type Tag } from "@/services/tags.service";

/** Mirrors `backend/app/domain/tag_constraints.py` (NAME_MAX). */
export const NAME_MAX = 50;
/** UX rule 6: the counter appears from 90% of the limit. */
export const COUNTER_FROM = Math.ceil(NAME_MAX * 0.9);

export const DUPLICATE = "Merkimiði með þessu nafni er þegar til.";

/** Case and spacing don't make a different tag. */
export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function sameName(a: string, b: string): boolean {
  return normaliseName(a) === normaliseName(b);
}

/** Icelandic alphabetical order. `localeCompare` can't be trusted: Chrome has no is-IS data. */
const ALPHABET = "aábcdðeéfghiíjklmnoópqrstuúvwxyýzþæö";

export function compareIs(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const ix = ALPHABET.indexOf(x[i]);
    const iy = ALPHABET.indexOf(y[i]);
    const dx = ix === -1 ? 100 + x.charCodeAt(i) : ix;
    const dy = iy === -1 ? 100 + y.charCodeAt(i) : iy;
    if (dx !== dy) return dx - dy;
  }
  return x.length - y.length;
}

/**
 * The tags whose name contains the search text, in Icelandic order, with an
 * exact match first so "Er til" is always on the first page.
 */
export function searchTags(tags: Tag[], query: string): Tag[] {
  const q = normaliseName(query);
  const sorted = [...tags].sort((a, b) => compareIs(a.name, b.name));
  if (!q) return sorted;
  const hits = sorted.filter((t) => normaliseName(t.name).includes(q));
  const exact = hits.find((t) => normaliseName(t.name) === q);
  return exact ? [exact, ...hits.filter((t) => t !== exact)] : hits;
}

/**
 * Checks a name before it is sent (UX rule 6). Returns the message to show, or
 * null when the name is fine. `exceptId` is the tag being renamed.
 */
export function validateTagName(name: string, tags: Tag[], exceptId?: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Skrifaðu nafn á merkimiðanum.";
  if (trimmed.length > NAME_MAX) {
    const over = trimmed.length - NAME_MAX;
    return `Nafnið má mest vera ${NAME_MAX} stafir. Styttu það um ${countIs(over, "staf", "stafi")}.`;
  }
  const taken = tags.find((t) => t.id !== exceptId && sameName(t.name, trimmed));
  if (taken) return `${DUPLICATE} Veldu annað nafn eða notaðu „${taken.name}“.`;
  return null;
}

/** "Notað á 3 einingum". Null when the count isn't known. */
export function usageText(count: number | null | undefined): string | null {
  if (count === null || count === undefined) return null;
  return count === 0 ? "Ekki notað" : `Notað á ${countIs(count, "einingu", "einingum")}`;
}

export type TagAction = "create" | "rename" | "delete" | "load";

const FAILED: Record<TagAction, string> = {
  create: "Ekki tókst að búa til merkimiðann.",
  rename: "Ekki tókst að endurnefna merkimiðann.",
  delete: "Ekki tókst að eyða merkimiðanum.",
  load: "Ekki tókst að sækja merkimiðana.",
};

/**
 * The one Icelandic message for a failed tag request, chosen from the HTTP
 * status (UX rule 3). The backend's English `detail` is never shown or matched.
 */
export function tagErrorMessage(err: unknown, action: TagAction): string {
  const status = err instanceof TagRequestError ? err.status : 0;
  switch (status) {
    case 409:
      return `${DUPLICATE} Veldu annað nafn.`;
    case 422:
      return `Nafnið má mest vera ${NAME_MAX} stafir og ekki vera tómt.`;
    case 403:
      return "Þú hefur ekki heimild til að breyta merkimiðum.";
    case 404:
      return `${FAILED[action]} Hann er ekki lengur til. Endurhlaðaðu síðuna.`;
    case 0:
      return `${FAILED[action]} Athugaðu nettenginguna og reyndu aftur.`;
    default:
      return `${FAILED[action]} Reyndu aftur eftir smástund.`;
  }
}
