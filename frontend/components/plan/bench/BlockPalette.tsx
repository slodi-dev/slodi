"use client";

import { useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { type SlotKind } from "@/services/plan.service";
import { LIBRARY_FOLDERS, LIBRARY_KINDS } from "@/lib/mock/library.mock";
import { useBlockLibrary } from "@/hooks/usePlan";
import { useBench } from "./BenchProvider";
import { blockAsLidur, dragId } from "./dnd";
import type { LibraryBlock } from "@/lib/mock/library.mock";
import styles from "./palette.module.css";

/**
 * The dagskrárbankinn rail — sc-145 `BlockPalette`, sc-146 `PaletteSearch`,
 * sc-147 `BlockLibraryItem`, sc-149 `PaletteEmptyState`.
 *
 * Every item carries its theme, its length and how often the sveit has run it.
 * That last one is the cheapest useful signal in the bank: a block used 31 times
 * is the sveit's own tradition, and one used once probably needs reading before
 * it gets dropped into a fundur.
 *
 * Adding is a *button*, not only a drag. The spec's governing principle is that
 * drag is an accelerator and never the only path (SPEC §0), and the sequencing
 * in §5 puts add-via-button before dnd-kit deliberately: steps 1–2 already give
 * a working, accessible assembler.
 */

export default function BlockPalette() {
  const bench = useBench();
  const { blocks } = useBlockLibrary();
  const activeFundur = bench?.state.active ?? null;

  const [folder, setFolder] = useState("allt");
  const [kind, setKind] = useState<SlotKind | "allt">("allt");
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return blocks.filter((block) => {
      if (folder !== "allt" && block.folder !== folder) return false;
      if (kind !== "allt" && block.kind !== kind) return false;
      if (!needle) return true;
      return (
        block.name.toLowerCase().includes(needle) || block.theme.toLowerCase().includes(needle)
      );
    });
  }, [blocks, folder, kind, query]);

  return (
    // A labelled section rather than <aside>: the shell sits inside the app's
    // <main>, and a complementary landmark must be top-level
    // (axe landmark-complementary-is-top-level).
    <section className={styles.src} aria-label="Dagskrá og möppur">
      <nav className={styles.nav} aria-label="Möppur">
        {LIBRARY_FOLDERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`${styles.fol} ${folder === f.id ? styles.folOn : ""}`}
            aria-pressed={folder === f.id}
            onClick={() => setFolder(f.id)}
          >
            <span className={styles.folL}>{f.label}</span>
            <span className={styles.folHint}>{f.hint}</span>
          </button>
        ))}
      </nav>

      <div className={styles.hd}>
        <label className={styles.srch}>
          <span className={styles.srOnly}>Leita í dagskrá</span>
          <input
            type="search"
            className={styles.in}
            placeholder="Leita…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className={styles.tabs} role="group" aria-label="Sía eftir tegund">
          {LIBRARY_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={`${styles.tab} ${kind === k.id ? styles.tabOn : ""}`}
              aria-pressed={kind === k.id}
              onClick={() => setKind(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.body}>
        {/* Why "Bæta við" is disabled, as visible text — never only a
            tooltip (docs/ux-conventions.md §9). */}
        {blocks.length > 0 && !activeFundur && (
          <p className={styles.hint}>Veldu fund á bekknum til að bæta blokkum við.</p>
        )}
        {blocks.length === 0 ? (
          // Not "no results" — there is no bank at all yet. Saying "ekkert
          // fannst" would blame the search for a missing backend.
          <p className={styles.emptyState}>
            Dagskrárbankinn er ekki tengdur enn. Þegar bakendinn svarar birtast blokkirnar hér.
          </p>
        ) : results.length === 0 ? (
          <p className={styles.emptyState}>
            Ekkert fannst{query ? ` fyrir „${query}“` : ""}. Prófaðu aðra möppu eða aðra tegund.
          </p>
        ) : (
          <ul className={styles.list}>
            {results.map((block) => (
              <LibraryItem
                key={block.id}
                block={block}
                onAdd={
                  activeFundur
                    ? () =>
                        bench?.dispatch({
                          t: "add",
                          fundurId: activeFundur,
                          lidur: blockAsLidur(block, null),
                        })
                    : undefined
                }
              />
            ))}
          </ul>
        )}
      </div>

      <div className={styles.ft}>
        {/* Not wired to anything yet (sc-148). A feature that is not built is
            visibly marked "Kemur síðar" (docs/ux-conventions.md §9): the
            reason is part of the label, not a tooltip. */}
        <button type="button" className={styles.create} disabled>
          + Búa til nýja blokk <span className={styles.soon}>Kemur síðar</span>
        </button>
      </div>
    </section>
  );
}

/**
 * One block in the bank — draggable onto a sheet, and addable by button.
 *
 * sc-147. Its own component because `useDraggable` is a hook and the list is a
 * `map`. The grip is the drag affordance, the same as on a bench row, so the
 * "Bæta við" button stays clickable: without a dedicated handle a pointer-down
 * on the button would be ambiguous between pressing it and starting a drag.
 */
function LibraryItem({ block, onAdd }: { block: LibraryBlock; onAdd?: () => void }) {
  // See LidurRow on why `attributes` is dropped: it would add a focusable
  // `role="button"` per item that responds to no key, described as "bil grípur,
  // upp og niður færa" — which is not merely misplaced here but untrue, since a
  // library block has no keyboard path at all beyond the "Bæta við" beside it.
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId.library(block.id),
    data: { kind: "library", block },
  });

  return (
    <li className={styles.item} data-kind={block.kind} data-dragging={isDragging || undefined}>
      <span ref={setNodeRef} className={styles.grip} aria-hidden="true" {...listeners}>
        ⠿
      </span>
      <span className={styles.itemKind} aria-hidden="true" />
      <span className={styles.itemBody}>
        <span className={styles.itemT}>{block.name}</span>
        <span className={styles.itemM}>
          <span className={styles.num}>{block.minutes} mín</span>
          <span className={styles.dot} aria-hidden="true" />
          <span>{block.theme}</span>
          <span className={styles.dot} aria-hidden="true" />
          <span>notað {block.timesUsed}×</span>
        </span>
      </span>
      <button type="button" className={styles.add} disabled={!onAdd} onClick={onAdd}>
        Bæta við
      </button>
    </li>
  );
}
