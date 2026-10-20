"use client";

import { useId, useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  GripVertical,
  MessageSquareText,
  Search,
  X,
} from "lucide-react";
import { useBlockLibrary } from "@/hooks/usePlan";
import { useFolders, type BankSelection, type FoldersApi } from "@/hooks/useFolders";
import { countIs } from "@/lib/format";
import type { LibraryFolder } from "@/lib/mock/folders.mock";
import { LIBRARY_KINDS, type LibraryBlock } from "@/lib/mock/library.mock";
import type { SlotKind } from "@/services/plan.service";
import { BlockKindLine, BlockMarker } from "./BlockCard";
import { SOURCES } from "./blockIcons";
import { useBench } from "./BenchProvider";
import { blockAsLidur, dragId } from "./dnd";
import { CreateFolder, FolderCovers, FolderGlyph, Popover } from "./PaletteFolders";
import styles from "./palette.module.css";

/**
 * The dagskrárbankinn rail — sc-145 `BlockPalette`, sc-146 `PaletteSearch`,
 * sc-147 `BlockLibraryItem`, sc-149 `PaletteEmptyState`. C · Card grid with C2 · Covers, from
 * the Lab (2026-10-20); the docs page beside the stories has the reasoning.
 *
 * - Top: the built-in sources as tabs, and the leader's möppur as covers (PaletteFolders).
 *   Möppur are in memory until sc-620 (hooks/useFolders.ts).
 * - Below: search, one type select, and the blocks as cards. Each card has its picture (the
 *   drag handle), its type and theme, how often the sveit has run it, "Bæta við" and
 *   "Setja í möppu…".
 *
 * Adding is a *button*, not only a drag. The spec's governing principle is that drag is an
 * accelerator and never the only path (SPEC §0).
 */

/* ── Types ─────────────────────────────────────────────────────────────────── */

/** All optional: the app passes none. Stories use them to start from a particular state. */
export interface BlockPaletteProps {
  /** The bank, instead of useBlockLibrary's. */
  blocks?: LibraryBlock[];
  /** The leader's möppur, instead of useFolders' seed. */
  folders?: LibraryFolder[];
  /** What is selected on load. */
  defaultSelection?: BankSelection;
  defaultQuery?: string;
  defaultKind?: SlotKind | "allt";
}

/* ── Copy ──────────────────────────────────────────────────────────────────── */

/** The rail's type chips, plus Endurmat, which the current rail leaves out. */
const KIND_FILTERS: { id: SlotKind | "allt"; label: string }[] = [
  ...LIBRARY_KINDS,
  { id: "endurmat", label: "Endurmat" },
];

const timesUsed = (n: number) => `notað ${countIs(n, "sinni", "sinnum")}`;

/* ── The rail ──────────────────────────────────────────────────────────────── */

export default function BlockPalette({
  blocks: blocksOverride,
  folders: initialFolders,
  defaultSelection = { type: "source", id: "allt" },
  defaultQuery = "",
  defaultKind = "allt",
}: BlockPaletteProps = {}) {
  const library = useBlockLibrary();
  const blocks = blocksOverride ?? library.blocks;
  const bench = useBench();
  const activeId = bench?.state.active ?? null;
  const activeFundur = bench?.state.data.fundir.find((f) => f.event_id === activeId) ?? null;
  const onFundur = useMemo(
    () => new Set(activeFundur?.items.map((item) => item.name) ?? []),
    [activeFundur]
  );

  const api = useFolders({ initial: initialFolders, initialSelection: defaultSelection });
  const [kind, setKind] = useState<SlotKind | "allt">(defaultKind);
  const [query, setQuery] = useState(defaultQuery);
  const hintId = useId();
  const searchId = useId();
  const kindId = useId();

  const { selection } = api;
  const folder =
    selection.type === "folder" ? api.folders.find((a) => a.id === selection.id) : undefined;
  const collectionLabel =
    folder?.name ?? SOURCES.find((s) => s.id === selection.id)?.label ?? "Allt";

  /** The selected collection's blocks, in its own order (a folder keeps the leader's order). */
  const inCollection = useMemo(() => {
    if (folder) {
      return folder.blockIds
        .map((id) => blocks.find((b) => b.id === id))
        .filter((b): b is LibraryBlock => Boolean(b));
    }
    if (selection.id === "allt") return blocks;
    return blocks.filter((b) => b.source === selection.id);
  }, [folder, blocks, selection.id]);

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("is");
    return inCollection.filter((block) => {
      if (kind !== "allt" && block.kind !== kind) return false;
      if (!needle) return true;
      const haystack = [block.name, block.theme, ...(block.needs ?? [])]
        .join(" ")
        .toLocaleLowerCase("is");
      return haystack.includes(needle);
    });
  }, [inCollection, kind, query]);

  const filtered = query.trim() !== "" || kind !== "allt";
  const resetFilters = () => {
    setQuery("");
    setKind("allt");
  };

  const add = activeFundur
    ? (block: LibraryBlock) =>
        bench?.dispatch({
          t: "add",
          fundurId: activeFundur.event_id,
          lidur: blockAsLidur(block, null),
        })
    : undefined;

  return (
    // A labelled section rather than <aside>: the shell sits inside the app's <main>, and a
    // complementary landmark must be top-level (axe landmark-complementary-is-top-level).
    // `lang` lets the browser hyphenate long Icelandic titles in a 130px card.
    <section className={styles.rail} data-rail aria-label="Dagskrá og möppur" lang="is">
      <div className={styles.collections}>
        <FolderCovers api={api} blocks={blocks} />
      </div>

      <div className={styles.head}>
        <div className={styles.searchRow}>
          <div className={styles.search}>
            <label htmlFor={searchId} className={styles.srOnly}>
              Leita í dagskrá
            </label>
            <Search className={styles.searchIcon} aria-hidden="true" />
            <input
              id={searchId}
              type="search"
              className={styles.searchInput}
              placeholder="Leita…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className={styles.clear}
                aria-label="Hreinsa leit"
                onClick={() => setQuery("")}
              >
                <X aria-hidden="true" />
              </button>
            )}
          </div>
          {/* One select instead of six chips: the chips took two rows the cards needed. */}
          <label className={styles.srOnly} htmlFor={kindId}>
            Sía eftir tegund
          </label>
          <select
            id={kindId}
            className={styles.kindSelect}
            value={kind}
            onChange={(e) => setKind(e.target.value as SlotKind | "allt")}
          >
            {KIND_FILTERS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.id === "allt" ? "Allar tegundir" : k.label}
              </option>
            ))}
          </select>
        </div>
        <p className={styles.count} role="status" data-showing>
          <strong>{collectionLabel}</strong>:{" "}
          {filtered
            ? countIs(results.length, "blokk passar", "blokkir passa")
            : countIs(results.length, "blokk", "blokkir")}
        </p>
      </div>

      <div className={styles.body}>
        {blocks.length > 0 &&
          (activeFundur ? (
            <p className={styles.target}>
              Bætist við: <strong>{activeFundur.title}</strong>
            </p>
          ) : (
            // Why "Bæta við" is disabled, as visible text (docs/ux-conventions.md §9).
            <p className={styles.hint} id={hintId}>
              Veldu fund á bekknum til að bæta blokkum við. Þú getur samt dregið blokk á fund.
            </p>
          ))}

        {blocks.length === 0 ? (
          // Not "no results": there is no bank at all yet. Saying "ekkert fannst" would blame
          // the search for a missing backend.
          <p className={styles.empty}>
            Dagskrárbankinn er ekki tengdur enn. Þegar bakendinn svarar birtast blokkirnar hér.
          </p>
        ) : folder && folder.blockIds.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Mappan „{folder.name}“ er tóm.</p>
            <p>
              Settu blokkir í hana með bókamerkinu{" "}
              <Bookmark className={styles.inlineIcon} aria-hidden="true" /> á spjaldi („Setja í
              möppu…“).
            </p>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => api.select({ type: "source", id: "allt" })}
            >
              Sýna allan bankann
            </button>
          </div>
        ) : results.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>
              Ekkert fannst{query.trim() ? ` fyrir „${query.trim()}“` : ""}.
            </p>
            <p>Prófaðu færri orð eða aðra tegund.</p>
            <button type="button" className={styles.secondaryButton} onClick={resetFilters}>
              Hreinsa leit og síur
            </button>
          </div>
        ) : (
          <ul className={styles.cards} aria-label="Blokkir">
            {results.map((block) => (
              <Card
                key={block.id}
                block={block}
                api={api}
                onAdd={add ? () => add(block) : undefined}
                disabledReasonId={add ? undefined : hintId}
                isOnFundur={onFundur.has(block.name)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Folder changes and "Afturkalla" after a delete. Always mounted, so it is announced. */}
      <div className={styles.toastArea} role="status">
        {api.message && (
          <p className={styles.toast} key={api.message.seq}>
            <span>{api.message.text}</span>
            {api.message.canUndo && (
              <button type="button" className={styles.toastButton} onClick={api.undoRemove}>
                Afturkalla
              </button>
            )}
          </p>
        )}
      </div>

      <div className={styles.foot}>
        {/* Not built yet (sc-148): visibly "Kemur síðar", never a live button (§9). */}
        <button type="button" className={styles.create} disabled>
          + Búa til nýja blokk <span className={styles.soon}>Kemur síðar</span>
        </button>
      </div>
    </section>
  );
}

/* ── The card ──────────────────────────────────────────────────────────────── */

interface CardProps {
  block: LibraryBlock;
  api: FoldersApi;
  /** Absent while there is no fundur to add to. */
  onAdd?: () => void;
  /** The visible hint that says why "Bæta við" is disabled. */
  disabledReasonId?: string;
  /** A liður with this name is already on the active fundur. */
  isOnFundur: boolean;
}

function Card({ block, api, onAdd, disabledReasonId, isOnFundur }: CardProps) {
  // Drag from the picture only, so "Bæta við" stays a plain click. No role="button" on it:
  // there's no keyboard drag here, and "Bæta við" is the keyboard path.
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId.library(block.id),
    data: { kind: "library", block },
  });

  return (
    <li className={styles.card} data-dragging={isDragging || undefined}>
      <span ref={setNodeRef} className={styles.cardPicture} aria-hidden="true" {...listeners}>
        <BlockMarker kind={block.kind} theme={block.theme} image={block.image} />
        <GripVertical className={styles.cardGrip} />
        {/* Minutes on the picture, like the length on a video thumbnail: read with the picture. */}
        <span className={styles.cardMinutes}>{block.minutes} mín</span>
      </span>
      <div className={styles.cardBody}>
        <span className={styles.title}>{block.name}</span>
        <span className={styles.srOnly}>, {block.minutes} mínútur</span>
        <BlockKindLine kind={block.kind} theme={block.theme} />
        <span className={styles.cardUsed}>{timesUsed(block.timesUsed)}</span>
        {(isOnFundur || block.endurmat) && (
          <span className={styles.badges}>
            {isOnFundur && (
              <span className={styles.badge}>
                <Check aria-hidden="true" />
                Þegar á fundinum
              </span>
            )}
            {block.endurmat && (
              <span className={styles.badge}>
                <MessageSquareText aria-hidden="true" />
                Endurmat fylgir
              </span>
            )}
          </span>
        )}
      </div>
      <div className={styles.cardActions}>
        <button
          type="button"
          className={styles.add}
          disabled={!onAdd}
          aria-describedby={disabledReasonId}
          onClick={onAdd}
        >
          Bæta við
        </button>
        <FolderPicker block={block} api={api} />
      </div>
    </li>
  );
}

/** "Setja í möppu…": every folder as a checkbox, ticked where the block already is. */
function FolderPicker({ block, api }: { block: LibraryBlock; api: FoldersApi }) {
  const inFolders = api.folders.filter((a) => a.blockIds.includes(block.id));
  const Icon = inFolders.length > 0 ? BookmarkCheck : Bookmark;
  const where = inFolders.length > 0 ? `, í ${countIs(inFolders.length, "möppu", "möppum")}` : "";
  return (
    <Popover
      label={`Setja ${block.name} í möppu`}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className={styles.folderButton}
          data-in-folder={inFolders.length > 0 || undefined}
          aria-label={`Setja í möppu…${where}`}
          title="Setja í möppu…"
        >
          <Icon aria-hidden="true" />
        </button>
      )}
    >
      {() => (
        <>
          <fieldset className={styles.pickerSet}>
            <legend className={styles.popoverHead}>Setja í möppu</legend>
            {api.folders.length === 0 && <p className={styles.popoverNote}>Engar möppur enn.</p>}
            <div className={styles.pickerList}>
              {api.folders.map((folder) => (
                <label key={folder.id} className={styles.pickerItem}>
                  <input
                    type="checkbox"
                    checked={folder.blockIds.includes(block.id)}
                    onChange={() => api.toggleBlock(folder.id, block.id, block.name)}
                  />
                  <FolderGlyph folder={folder} />
                  <span className={styles.collectionName}>{folder.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className={styles.createRow}>
            <CreateFolder api={api} withBlock={block.id} select={false} />
          </div>
        </>
      )}
    </Popover>
  );
}
