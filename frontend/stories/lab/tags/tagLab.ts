/**
 * Shared state for the tag-management lab looks. Each look renders the same behaviour
 * differently, so create, rename, delete-with-undo, merge, search and validation live here once.
 *
 * Nothing here calls the API. Saves are simulated with a delay so the busy state can be seen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { countIs } from "@/lib/format";

/** Mirrors `backend/app/domain/tag_constraints.py` (NAME_MAX). */
export const NAME_MAX = 50;
/** Rule 6: the counter appears from 90% of the limit. */
export const COUNTER_FROM = Math.ceil(NAME_MAX * 0.9);

export type ItemKind = "Dagskrá" | "Leikur" | "Verkefni";
export interface LabItem {
  id: string;
  title: string;
  kind: ItemKind;
}
export interface LabTag {
  id: string;
  name: string;
  /** The items (einingar) carrying this tag. */
  items: LabItem[];
}
export type LoadStatus = "ready" | "loading" | "error";

/** One-line message with an optional undo, shown in the page's status region. */
export interface Notice {
  key: number;
  text: string;
  undo?: () => void;
}

// ── Text ──────────────────────────────────────────────────────────────────────

export const DUPLICATE = "Merkimiði með þessu nafni er þegar til.";

export function usageText(n: number): string {
  return n === 0 ? "Ekki notaður" : `Notað á ${countIs(n, "einingu", "einingum")}`;
}

/** Same name for duplicate purposes: case and spacing don't count. */
export function sameName(a: string, b: string): boolean {
  return normalise(a) === normalise(b);
}

function normalise(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Looser key for spotting likely duplicates: also ignores accents and hyphens. */
export function looseKey(name: string): string {
  return normalise(name)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[-_]/g, " ");
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

/** First letter for grouping. Á is its own letter in Icelandic, not a kind of A. */
export function initial(name: string): string {
  const c = name.trim().charAt(0).toUpperCase();
  return /\p{L}/u.test(c) ? c : "#";
}

/** Rule 6 messages. Returns null when the name is fine. */
export function validateName(
  name: string,
  tags: LabTag[],
  exceptId?: string
): { message: string; duplicateOf?: LabTag } | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { message: "Skrifaðu nafn á merkimiðanum." };
  if (trimmed.length > NAME_MAX) {
    const over = trimmed.length - NAME_MAX;
    return {
      message: `Nafnið má mest vera ${NAME_MAX} stafir. Styttu það um ${countIs(over, "staf", "stafi")}.`,
    };
  }
  const dup = tags.find((t) => t.id !== exceptId && sameName(t.name, trimmed));
  if (dup)
    return { message: `${DUPLICATE} Veldu annað nafn eða notaðu „${dup.name}“.`, duplicateOf: dup };
  return null;
}

// ── Sample data ───────────────────────────────────────────────────────────────

let itemSeq = 0;
function items(n: number, titles: string[]): LabItem[] {
  const kinds: ItemKind[] = ["Dagskrá", "Leikur", "Verkefni"];
  return Array.from({ length: n }, (_, i) => ({
    id: `i-${++itemSeq}`,
    title:
      titles[i % titles.length] +
      (i >= titles.length ? ` ${Math.floor(i / titles.length) + 1}` : ""),
    kind: kinds[i % kinds.length],
  }));
}

const T = {
  uti: ["Útilega í Heiðmörk", "Tjaldbúðir á vori", "Göngudagur á Esjuna", "Kvöld í skóginum"],
  rat: ["Ratleikur um hverfið", "Áttavitaþjálfun", "Kortalestur fyrir drekaskáta"],
  hnu: ["Hnútakeppni", "Pelastikk á tíma", "Súrrun á fánastöng"],
  kvo: ["Kvöldvaka við varðeld", "Skemmtiatriði sveita", "Söngvakvöld"],
  hef: ["Vígsla nýliða", "Sumardagurinn fyrsti", "Skátaheitið"],
  umh: ["Hjálparhönd í hverfinu", "Ruslatínsla í fjörunni"],
};

export const SAMPLE_TAGS: LabTag[] = [
  { id: "t-1", name: "Útilíf", items: items(23, T.uti) },
  { id: "t-2", name: "Ratleikni", items: items(11, T.rat) },
  { id: "t-3", name: "Hnútar", items: items(8, T.hnu) },
  { id: "t-4", name: "Kvöldvaka", items: items(21, T.kvo) },
  { id: "t-5", name: "Hefðir", items: items(5, T.hef) },
  { id: "t-6", name: "Umhyggja", items: items(3, T.umh) },
  { id: "t-7", name: "Söngur", items: items(14, T.kvo) },
  { id: "t-8", name: "Eldamennska", items: items(6, T.uti) },
  { id: "t-9", name: "Skyndihjálp", items: items(9, T.umh) },
  { id: "t-10", name: "Áttaviti", items: items(4, T.rat) },
  { id: "t-11", name: "Þrautir", items: items(1, T.hnu) },
  { id: "t-12", name: "Útilif", items: items(2, T.uti) },
  { id: "t-13", name: "Föndur", items: [] },
  { id: "t-14", name: "Umhverfisvernd og samfélagsverkefni í nærumhverfi", items: items(2, T.umh) },
  { id: "t-15", name: "Útivistarleiðtogaþjálfunarnámskeiðsundirbúningur", items: items(1, T.uti) },
  { id: "t-16", name: "Drekaskátar", items: items(12, T.hef) },
];

// ── State ─────────────────────────────────────────────────────────────────────

export interface UseTagLabOptions {
  tags: LabTag[];
  status: LoadStatus;
  /** Simulated save time in ms. */
  saveDelay?: number;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useTagLab({
  tags: initialTags,
  status: initialStatus,
  saveDelay = 600,
}: UseTagLabOptions) {
  const [tags, setTags] = useState(initialTags);
  const [status, setStatus] = useState(initialStatus);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const seq = useRef(0);
  // Latest tags for the async callbacks, which check duplicates again after their wait.
  const tagsRef = useRef(tags);
  useEffect(() => {
    tagsRef.current = tags;
  }, [tags]);

  const say = useCallback((text: string, undo?: () => void) => {
    setNotice({ key: ++seq.current, text, undo });
  }, []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const retry = useCallback(() => {
    setStatus("loading");
    setTimeout(() => setStatus("ready"), saveDelay);
  }, [saveDelay]);

  const sorted = useMemo(() => [...tags].sort((a, b) => compareIs(a.name, b.name)), [tags]);
  const visible = useMemo(() => {
    const q = normalise(query);
    return q ? sorted.filter((t) => normalise(t.name).includes(q)) : sorted;
  }, [sorted, query]);
  const exactMatch = useMemo(
    () => (query.trim() ? tags.find((t) => sameName(t.name, query)) : undefined),
    [tags, query]
  );

  /** Resolves to an error message, or null on success. */
  const create = useCallback(
    async (name: string): Promise<string | null> => {
      const invalid = validateName(name, tagsRef.current);
      if (invalid) return invalid.message;
      await wait(saveDelay);
      // Checked again after the wait, as the server would: someone may have made it meanwhile.
      const late = validateName(name, tagsRef.current);
      if (late) return late.message;
      const tag: LabTag = { id: `t-new-${++seq.current}`, name: name.trim(), items: [] };
      setTags((all) => [...all, tag]);
      say(`„${tag.name}“ bætt við.`);
      return null;
    },
    [saveDelay, say]
  );

  const rename = useCallback(
    async (id: string, name: string): Promise<string | null> => {
      const before = tagsRef.current.find((t) => t.id === id);
      if (!before) return null;
      if (name.trim() === before.name) return null;
      const invalid = validateName(name, tagsRef.current, id);
      if (invalid) return invalid.message;
      await wait(saveDelay);
      setTags((all) => all.map((t) => (t.id === id ? { ...t, name: name.trim() } : t)));
      say(`„${before.name}“ heitir nú „${name.trim()}“.`);
      return null;
    },
    [saveDelay, say]
  );

  /** Reversible delete (rule 5): gone at once, "Afturkalla" puts it back where it was. */
  const remove = useCallback(
    (id: string) => {
      const all = tagsRef.current;
      const index = all.findIndex((t) => t.id === id);
      if (index === -1) return;
      const tag = all[index];
      setTags(all.filter((t) => t.id !== id));
      const n = tag.items.length;
      const from = n ? ` og tekinn af ${countIs(n, "einingu", "einingum")}` : "";
      say(`„${tag.name}“ eytt${from}.`, () => {
        setTags((cur) => {
          const next = [...cur];
          next.splice(Math.min(index, next.length), 0, tag);
          return next;
        });
        say(`„${tag.name}“ er kominn aftur.`);
      });
    },
    [say]
  );

  /** Moves every item from `sourceId` onto `targetId` and drops the source, with undo. */
  const merge = useCallback(
    (sourceId: string, targetId: string) => {
      const snapshot = tagsRef.current;
      const source = snapshot.find((t) => t.id === sourceId);
      const target = snapshot.find((t) => t.id === targetId);
      if (!source || !target || source === target) return;
      const have = new Set(target.items.map((i) => i.id));
      const moved = source.items.filter((i) => !have.has(i.id));
      setTags(
        snapshot
          .filter((t) => t.id !== sourceId)
          .map((t) => (t.id === targetId ? { ...t, items: [...t.items, ...moved] } : t))
      );
      say(
        `„${source.name}“ sameinaður „${target.name}“ (${countIs(moved.length, "eining færð", "einingar færðar")}).`,
        () => {
          setTags(snapshot);
          say("Sameiningin var afturkölluð.");
        }
      );
    },
    [say]
  );

  /** Pairs whose names differ only by case, accents or hyphens. */
  const likelyDuplicates = useMemo(() => {
    const groups = new Map<string, LabTag[]>();
    for (const t of sorted) {
      const k = looseKey(t.name);
      groups.set(k, [...(groups.get(k) ?? []), t]);
    }
    return [...groups.values()].filter((g) => g.length > 1);
  }, [sorted]);

  return {
    status,
    retry,
    tags: sorted,
    total: tags.length,
    query,
    setQuery,
    visible,
    exactMatch,
    create,
    rename,
    remove,
    merge,
    likelyDuplicates,
    notice,
    dismissNotice,
  };
}

export type TagLabState = ReturnType<typeof useTagLab>;
