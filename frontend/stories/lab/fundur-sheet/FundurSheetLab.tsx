"use client";

import { Fragment, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Columns3, Rows3 } from "lucide-react";
import {
  BANDS,
  BAND_OF,
  STATUS_LABEL,
  type BandId,
  type Fundur,
  type Patrol,
} from "@/services/plan.service";
import {
  bandOffset,
  clockAt,
  startTimes,
  type BenchIntent,
} from "@/components/plan/bench/benchState";
import LidurEditor from "@/components/plan/bench/LidurEditor";
import SplitGrid from "@/components/plan/bench/SplitGrid";
import { dragId } from "@/components/plan/bench/dnd";
import { countIs } from "@/lib/format";
import LidurRowLab, { StatusTag } from "./LidurRowLab";
import {
  STATUS_ORDER,
  bandMinutes,
  cycleLabel,
  dateLabel,
  fitLabel,
  offsetLabel,
  sheetFacts,
  startOffsets,
  undecidedSentence,
  undecidedShort,
  type FundurSheetLook,
  type SheetFacts,
} from "./sheetModel";
import styles from "./FundurSheetLab.module.css";

/**
 * FundurSheet, four ways: lab copies with a `look` prop. Nothing in the app
 * uses this file; see Lab → FundurSheet → About for why each look exists.
 *
 * Same props as the real FundurSheet plus `look`, so the chosen look can be
 * promoted without touching PlanBench. The bands, the split grid, the inline
 * editor, the drag contexts and every intent are the bench's own.
 */

export interface FundurSheetLabProps {
  look: FundurSheetLook;
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
  /** Lab only: told apart from other sheets of the same fundur (axe landmark-unique). */
  labelSuffix?: string;
}

export default function FundurSheetLab(props: FundurSheetLabProps) {
  const { look, fundur, isActive, isPast, dispatch, labelSuffix = "" } = props;
  const facts = sheetFacts(fundur);
  const date = dateLabel(fundur);

  return (
    <section
      className={styles.sheet}
      data-look={look}
      data-active={isActive}
      data-past={isPast}
      aria-label={`${fundur.title} · ${date}${labelSuffix}`}
      onFocus={() => dispatch({ t: "activate", fundurId: fundur.event_id })}
    >
      <div className={styles.inner}>
        {look === "dagskra" && <DagskraHeader fundur={fundur} facts={facts} isPast={isPast} />}
        {look === "timalina" && <TimalinaHeader fundur={fundur} facts={facts} isPast={isPast} />}
        {look === "gatlisti" && (
          <GatlistiHeader fundur={fundur} facts={facts} isPast={isPast} dispatch={dispatch} />
        )}
        {look === "thett" && <ThettHeader fundur={fundur} facts={facts} isPast={isPast} />}

        {look === "thett" && (
          // A visual column head. Each control names itself, so it's hidden from
          // the tree rather than pretending to be a table header.
          <div className={styles.colHead} aria-hidden="true">
            <span />
            <span>Kl.</span>
            <span>Mín</span>
            <span>Liður</span>
            <span>Staða</span>
            <span />
          </div>
        )}

        {BANDS.map((band) => (
          <Band key={band.id} {...props} band={band.id} label={band.label} />
        ))}

        {look === "dagskra" && (
          <footer className={styles.foot}>
            <span>{facts.endsAt ? `Lok kl. ${facts.endsAt}` : "Ódagsett"}</span>
            <FitBadge facts={facts} />
          </footer>
        )}
        {look === "thett" && (
          <footer className={styles.foot}>
            <span>{undecidedSentence(facts.undecided)}</span>
            <FitBadge facts={facts} />
          </footer>
        )}
      </div>
    </section>
  );
}

/* ── Headers, one per look ─────────────────────────────────────────────── */

type HeaderProps = { fundur: Fundur; facts: SheetFacts; isPast: boolean };

/** The kicker every look carries: cycle, venue, scope, and "Liðinn" on a past fundur. */
function Kicker({ fundur, isPast }: { fundur: Fundur; isPast: boolean }) {
  const cycle = cycleLabel(fundur);
  return (
    <p className={styles.kicker}>
      {isPast && <span className={styles.pastTag}>Liðinn fundur</span>}
      {cycle && <span>{cycle}</span>}
      {fundur.venue && <span>{fundur.venue}</span>}
      {fundur.scope === "troop-wide" && <span className={styles.troop}>Öll sveitin</span>}
    </p>
  );
}

function FitBadge({ facts }: { facts: SheetFacts }) {
  return (
    <span className={styles.fit} data-over={facts.over || undefined}>
      {fitLabel(facts)}
    </span>
  );
}

function timeRange(facts: SheetFacts): string {
  return facts.startsAt ? `${facts.startsAt}–${facts.endsAt}` : "Ódagsett";
}

function DagskraHeader({ fundur, facts, isPast }: HeaderProps) {
  return (
    <header className={styles.head}>
      <Kicker fundur={fundur} isPast={isPast} />
      <h2 className={styles.heading}>{fundur.title}</h2>
      <p className={styles.when}>
        <span className={styles.date}>{dateLabel(fundur)}</span>
        <span className={styles.range}>{timeRange(facts)}</span>
      </p>
      <p className={styles.meta}>
        <FitBadge facts={facts} />
        <span>{countIs(facts.allItems.length, "liður", "liðir")}</span>
        {facts.undecided > 0 && (
          <span className={styles.warnText}>{undecidedSentence(facts.undecided)}</span>
        )}
      </p>
    </header>
  );
}

function TimalinaHeader({ fundur, facts, isPast }: HeaderProps) {
  const offsets = startOffsets(fundur);
  // One segment per liður, and one per split band: its lanes run side by side,
  // so the evening's shape has a single block there as long as the longest lane.
  const segments = BANDS.flatMap((band) => {
    if (fundur.split?.[band.id]) {
      return [
        {
          id: band.id,
          start: bandOffset(fundur, band.id),
          minutes: bandMinutes(fundur, band.id),
          status: "draft" as const,
          split: true,
        },
      ];
    }
    return fundur.items
      .map((item, i) => ({ item, start: offsets[i] }))
      .filter(({ item }) => BAND_OF[item.kind] === band.id)
      .map(({ item, start }) => ({
        id: item.id,
        start,
        minutes: item.minutes,
        status: item.status,
        split: false,
      }));
  });
  const at = (minutes: number) => `${(minutes / facts.scale) * 100}%`;

  return (
    <header className={styles.head}>
      <Kicker fundur={fundur} isPast={isPast} />
      <div className={styles.titleLine}>
        <h2 className={styles.heading}>{fundur.title}</h2>
        <span className={styles.date}>{dateLabel(fundur)}</span>
      </div>
      <div className={styles.evening}>
        <div className={styles.eveningBar} aria-hidden="true">
          {segments.flatMap((seg) => {
            // The part of a liður past the planned end is drawn on its own, in
            // the warning colour, so the overrun is a shape and not a number.
            const end = seg.start + seg.minutes;
            const inTime = Math.max(0, Math.min(end, facts.planned) - seg.start);
            const overStart = Math.max(seg.start, facts.planned);
            return [
              inTime > 0 && (
                <span
                  key={seg.id}
                  className={styles.seg}
                  data-status={seg.status}
                  data-split={seg.split || undefined}
                  style={{ left: at(seg.start), width: at(inTime) }}
                />
              ),
              end > facts.planned && (
                <span
                  key={`${seg.id}-over`}
                  className={`${styles.seg} ${styles.segOver}`}
                  style={{ left: at(overStart), width: at(end - overStart) }}
                />
              ),
            ];
          })}
          <span className={styles.eveningLimit} style={{ left: at(facts.planned) }} />
          <span className={styles.eveningLimitLabel} style={{ left: at(facts.planned) }}>
            Áætluð lok {facts.plannedEndsAt ?? offsetLabel(facts.planned)}
          </span>
        </div>
        <div className={styles.eveningScale} aria-hidden="true">
          <span>{facts.startsAt ?? offsetLabel(0)}</span>
          <span>{facts.endsAt ?? offsetLabel(facts.total)}</span>
        </div>
        <p className={styles.meta}>
          <FitBadge facts={facts} />
          <span>{timeRange(facts)}</span>
          <span>{countIs(facts.allItems.length, "liður", "liðir")}</span>
        </p>
      </div>
    </header>
  );
}

function GatlistiHeader({
  fundur,
  facts,
  isPast,
  dispatch,
}: HeaderProps & { dispatch: (intent: BenchIntent) => void }) {
  const left: string[] = [];
  if (facts.undecided > 0) left.push(undecidedShort(facts.undecided));
  if (facts.delta > 0) left.push(`${facts.delta} mín yfir`);
  const emptyLabels = BANDS.filter((band) => facts.emptyBands.includes(band.id)).map(
    (band) => band.label
  );
  if (emptyLabels.length) left.push(`${emptyLabels.join(", ")} tómt`);

  const todo = fundur.items
    .filter((item) => item.status !== "confirmed")
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  const total = facts.allItems.length || 1;

  const goTo = (id: string) => {
    dispatch({ t: "select", id });
    document.querySelector<HTMLElement>(`[data-lidur-row="${id}"]`)?.focus();
  };

  return (
    <header className={styles.head}>
      <Kicker fundur={fundur} isPast={isPast} />
      <div className={styles.titleLine}>
        <h2 className={styles.heading}>{fundur.title}</h2>
        <span className={styles.date}>
          {dateLabel(fundur)} · {timeRange(facts)}
        </span>
      </div>

      <p className={styles.readiness} data-done={left.length === 0 || undefined}>
        {left.length ? left.join(" · ") : "Tilbúið: allt ákveðið og passar í tímann"}
      </p>

      <div className={styles.meter} aria-hidden="true">
        {[...STATUS_ORDER]
          .reverse()
          .map((status) =>
            facts.byStatus[status] ? (
              <span
                key={status}
                className={styles.meterPart}
                data-status={status}
                style={{ width: `${(facts.byStatus[status] / total) * 100}%` }}
              />
            ) : null
          )}
      </div>
      <p className={styles.legend}>
        {[...STATUS_ORDER].reverse().map((status) => (
          <span key={status} className={styles.legendItem} data-status={status}>
            {STATUS_LABEL[status]} <b>{facts.byStatus[status]}</b>
          </span>
        ))}
        <FitBadge facts={facts} />
      </p>

      {todo.length > 0 && (
        <div className={styles.todo}>
          <h3 className={styles.todoHead}>Eftir að ákveða</h3>
          <ul className={styles.todoList}>
            {todo.map((item) => (
              <li key={item.id}>
                <button type="button" className={styles.todoItem} onClick={() => goTo(item.id)}>
                  <StatusTag status={item.status} />
                  <span>{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}

function ThettHeader({ fundur, facts, isPast }: HeaderProps) {
  return (
    <header className={`${styles.head} ${styles.headDense}`}>
      <div className={styles.titleLine}>
        <h2 className={styles.heading}>{fundur.title}</h2>
        <span className={styles.date}>
          {dateLabel(fundur)} · {timeRange(facts)}
        </span>
        <FitBadge facts={facts} />
      </div>
      <Kicker fundur={fundur} isPast={isPast} />
    </header>
  );
}

/* ── Bands ─────────────────────────────────────────────────────────────── */

function Band({
  look,
  fundur,
  patrols,
  otherFundir,
  selected,
  grabbed,
  editing,
  laneSelected,
  dispatch,
  registerRow,
  focusSibling,
  band,
  label,
}: FundurSheetLabProps & { band: BandId; label: string }) {
  const lanes = fundur.split?.[band];
  const items = fundur.items.filter((item) => BAND_OF[item.kind] === band);
  const minutes = bandMinutes(fundur, band);
  const starts = startTimes(fundur);
  const offset = bandOffset(fundur, band);
  const bandClock = clockAt(fundur, offset) ?? offsetLabel(offset);

  return (
    <div className={styles.band} data-band={band}>
      <div className={styles.bandHd}>
        {look === "dagskra" && <span className={styles.bandClock}>{bandClock}</span>}
        <h3 className={styles.bandLabel}>{label}</h3>
        <span className={styles.bandMin}>
          {minutes ? `${minutes} mín${lanes ? " samhliða" : ""}` : "—"}
        </span>
        <button
          type="button"
          className={styles.splitBtn}
          aria-pressed={Boolean(lanes)}
          title={
            lanes
              ? "Hver flokkur hefur sinn eigin tíma. Smelltu til að sameina í eina röð."
              : "Hver flokkur fær sinn eigin tíma í rist, með tímaás og einni súlu á flokk."
          }
          onClick={() =>
            dispatch({ t: lanes ? "mergeBand" : "splitBand", fundurId: fundur.event_id, band })
          }
        >
          {lanes ? <Rows3 aria-hidden="true" /> : <Columns3 aria-hidden="true" />}
          {lanes ? "Sameina í eitt" : "Skipta á flokka"}
        </button>
      </div>

      {lanes ? (
        <SplitGrid
          fundur={fundur}
          band={band}
          patrols={patrols}
          selected={laneSelected}
          dispatch={dispatch}
        />
      ) : items.length === 0 ? (
        <BandRows fundurId={fundur.event_id} band={band} itemIds={[]}>
          <p className={styles.blank}>Ekkert skráð hér enn.</p>
        </BandRows>
      ) : (
        <BandRows
          fundurId={fundur.event_id}
          band={band}
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
                  startsAt={starts[index]}
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
}

/** One band's sortable rows and its drop target: FundurSheet's BandRows, unchanged. */
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
