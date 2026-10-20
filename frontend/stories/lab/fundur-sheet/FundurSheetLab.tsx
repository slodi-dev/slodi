"use client";

import { Fragment, type CSSProperties, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Columns3, Rows3 } from "lucide-react";
import { BANDS, BAND_OF, type BandId, type Fundur, type Patrol } from "@/services/plan.service";
import type { BenchIntent } from "@/components/plan/bench/benchState";
import {
  bandMinutes,
  clockAt,
  fundurMinutes,
  startTimes,
} from "@/components/plan/bench/benchState";
import LidurEditor from "@/components/plan/bench/LidurEditor";
import SplitGrid from "@/components/plan/bench/SplitGrid";
import { dragId } from "@/components/plan/bench/dnd";
import { countIs, pluralIs } from "@/lib/format";
import { cn } from "@/lib/util";
import LidurRowLab from "./LidurRowLab";
import { fitWord, offsetLabel, patrolOf, startOffsets, type FundurSheetLook } from "./sheetModel";
import styles from "./FundurSheetLab.module.css";

/**
 * The current FundurSheet (components/plan/bench/FundurSheet.tsx) with a `look`.
 *
 * The form is the current one: header, the three beinagrind bands with "Skipta
 * á flokka" on each, the rows, the open editor under its row, the real
 * SplitGrid for a split band, and the footer. Every intent is the same. The
 * fixes every look shares are in the MDX ("What's wrong with the current
 * sheet"); the looks differ only in CSS, plus F2's stamps and F3's tick boxes.
 */

interface Props {
  look: FundurSheetLook;
  /** Appended to the sheet's name, when several sheets of one fundur share a page. */
  labelSuffix?: string;
  fundur: Fundur;
  patrols: Patrol[];
  otherFundir: Fundur[];
  isActive: boolean;
  isPast: boolean;
  selected: string | null;
  grabbed: string | null;
  editing: string | null;
  laneSelected: string | null;
  dispatch: (intent: BenchIntent) => void;
  registerRow: (id: string, node: HTMLDivElement | null) => void;
  focusSibling: (id: string, delta: -1 | 1) => void;
}

export default function FundurSheetLab({
  look,
  labelSuffix = "",
  fundur,
  patrols,
  otherFundir,
  isActive,
  isPast,
  selected,
  grabbed,
  editing,
  laneSelected,
  dispatch,
  registerRow,
  focusSibling,
}: Props) {
  const starts = startTimes(fundur);
  const offsets = startOffsets(fundur);
  const total = fundurMinutes(fundur);
  const over = total > fundur.planned_minutes;

  const allItems = [
    ...fundur.items,
    ...Object.values(fundur.split ?? {}).flatMap((lanes) =>
      (lanes ?? []).flatMap((lane) => lane.items)
    ),
  ];

  const clock = fundur.starts_at ? /T(\d{2}):(\d{2})/.exec(fundur.starts_at) : null;
  const endsAt = clockAt(fundur, total);
  const plannedEnd = clockAt(fundur, fundur.planned_minutes);
  const undecided = allItems.filter((item) => item.status === "unknown").length;
  const drafts = allItems.filter((item) => item.status === "draft").length;
  const fit = fitWord(fundur);

  // F4: the flokkur's colour, or the sveit's for a troop-wide fundur.
  const patrol = patrolOf(fundur, patrols);
  const accent = patrol?.accent;
  const patrolStyle = (
    accent
      ? {
          "--pc": `var(--sl-color-patrol-${accent})`,
          "--pc-on": `var(--sl-color-patrol-${accent}-foreground)`,
          "--pc-tint": `var(--sl-color-patrol-${accent}-subtle)`,
        }
      : {
          "--pc": "var(--sl-color-primary)",
          "--pc-on": "var(--sl-color-text-inverse)",
          "--pc-tint": "var(--sl-color-primary-subtle)",
        }
  ) as CSSProperties;

  return (
    <section
      className={styles.sheet}
      data-look={look}
      data-active={isActive}
      data-past={isPast}
      style={patrolStyle}
      aria-label={`${fundur.title} · ${fundur.date_label}${labelSuffix}`}
      onFocus={() => dispatch({ t: "activate", fundurId: fundur.event_id })}
    >
      <header className={styles.sheetHd}>
        <div className={styles.sheetKick}>
          {look === "flokkur" && (
            <span className={styles.patrolName}>{patrol ? patrol.name : "Öll sveitin"}</span>
          )}
          {fundur.theme && (
            <span className={styles.cyc}>
              {fundur.theme}
              {fundur.of_weeks ? ` · vika ${fundur.week_index}/${fundur.of_weeks}` : ""}
            </span>
          )}
          {fundur.venue && <span className={styles.venue}>{fundur.venue}</span>}
          {fundur.scope === "troop-wide" && look !== "flokkur" && (
            <span className={styles.troopWide}>Öll sveitin</span>
          )}
        </div>
        <h2 className={styles.sheetT}>
          {fundur.title}
          <span className={styles.sheetDate}>
            <span className={styles.srOnly}> · </span>
            {fundur.date_label}
          </span>
        </h2>
        <div className={styles.sheetWhen}>
          <b className={styles.num}>{clock ? `${clock[1]}:${clock[2]}–${endsAt}` : "Ódagsett"}</b>
          <span className={styles.num}>
            áætlað {fundur.planned_minutes} mín
            {clock && over ? ` (til ${plannedEnd})` : ""} ·{" "}
            {countIs(allItems.length, "liður", "liðir")}
          </span>
          <span className={styles.fit} data-tone={fit.tone}>
            {fit.text}
          </span>
        </div>
      </header>

      {BANDS.map((band) => {
        const lanes = fundur.split?.[band.id];
        const items = fundur.items.filter((item) => BAND_OF[item.kind] === band.id);
        const minutes = bandMinutes(fundur, band.id);

        return (
          <div key={band.id} className={styles.bandWrap}>
            <div className={styles.band}>
              <span className={styles.bandL}>{band.label}</span>
              <span className={cn(styles.bandN, styles.num)}>
                {minutes ? `${minutes} mín${lanes ? " samhliða" : ""}` : "—"}
              </span>
              <button
                type="button"
                className={styles.bandsplit}
                aria-pressed={Boolean(lanes)}
                title={
                  lanes
                    ? "Hver flokkur hefur sinn eigin tíma. Smelltu til að sameina í eina röð."
                    : "Hver flokkur fær sinn eigin tíma í rist, með tímaás og einni súlu á flokk."
                }
                onClick={() =>
                  dispatch({
                    t: lanes ? "mergeBand" : "splitBand",
                    fundurId: fundur.event_id,
                    band: band.id,
                  })
                }
              >
                {lanes ? (
                  <Rows3 size={14} strokeWidth={2} aria-hidden />
                ) : (
                  <Columns3 size={14} strokeWidth={2} aria-hidden />
                )}
                {lanes ? "Sameina í eitt" : "Skipta á flokka"}
              </button>
            </div>

            {lanes ? (
              <SplitGrid
                fundur={fundur}
                band={band.id}
                patrols={patrols}
                selected={laneSelected}
                dispatch={dispatch}
              />
            ) : items.length === 0 ? (
              <BandRows fundurId={fundur.event_id} band={band.id} itemIds={[]}>
                <p className={styles.blank}>Ekkert skráð hér enn.</p>
              </BandRows>
            ) : (
              <BandRows
                fundurId={fundur.event_id}
                band={band.id}
                itemIds={items.map((item) => dragId.row(item.id))}
              >
                {items.map((lidur, positionInBand) => {
                  const index = fundur.items.findIndex((item) => item.id === lidur.id);
                  return (
                    <Fragment key={lidur.id}>
                      <LidurRowLab
                        look={look}
                        fundur={fundur}
                        lidur={lidur}
                        index={index}
                        canMoveUp={positionInBand > 0}
                        canMoveDown={positionInBand < items.length - 1}
                        isEditing={editing === lidur.id}
                        startsAt={starts[index] ?? offsetLabel(offsets[index])}
                        isSelected={selected === lidur.id}
                        isGrabbed={grabbed === lidur.id}
                        dispatch={dispatch}
                        registerRow={registerRow}
                        focusSibling={focusSibling}
                      />
                      {editing === lidur.id && (
                        <LidurEditor
                          fundur={fundur}
                          otherFundir={otherFundir}
                          lidur={lidur}
                          position={index + 1}
                          total={fundur.items.length}
                          startsAt={starts[index]}
                          dispatch={dispatch}
                          onClose={() => dispatch({ t: "edit", id: null })}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </BandRows>
            )}
          </div>
        );
      })}

      <footer className={styles.sheetFt}>
        <span className={styles.left} data-open={undecided > 0}>
          {undecided > 0
            ? `${countIs(undecided, "liður", "liðir")} enn ${pluralIs(undecided, "óákveðinn", "óákveðnir")}`
            : "Allir liðir ákveðnir"}
          {/* "Allir liðir ákveðnir" next to two Drög read as "done"; say what's still a draft. */}
          {drafts > 0 && ` · ${drafts} í drögum`}
        </span>
        <span className={cn(styles.tot, over && styles.over)}>
          {total} / {fundur.planned_minutes} mín
          {over ? ` · ${total - fundur.planned_minutes} yfir` : ""}
        </span>
      </footer>
    </section>
  );
}

/** One band's rows: a sortable list, and a drop target for the bank (as in FundurSheet). */
function BandRows({
  fundurId,
  band,
  itemIds,
  children,
}: {
  fundurId: string;
  band: BandId;
  itemIds: string[];
  children: ReactNode;
}) {
  const isEmpty = itemIds.length === 0;
  const { setNodeRef, isOver } = useDroppable({
    id: dragId.bandDrop(fundurId, band),
    data: { kind: "band", fundurId, band },
    disabled: !isEmpty,
  });

  return (
    <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        role={isEmpty ? undefined : "list"}
        className={styles.rows}
        data-over={isOver || undefined}
      >
        {children}
      </div>
    </SortableContext>
  );
}
