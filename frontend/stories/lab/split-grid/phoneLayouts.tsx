/**
 * The split band on a phone: four layouts (M1–M4) for a band that is 620px wide or less. The
 * desktop K2 grid squeezed onto a phone shows one and a half flokkar, cuts the second column's
 * cards mid-word and hides which flokkar are off screen; see the MDX.
 *
 * Every layout keeps K2's card language (the bank card, its clock line and status stamp, its
 * back as the editor, opened here as a sheet from the bottom: SplitGridLab's PhoneSheet) and
 * H6's identity (the ringed crest, the flokkur's colour as a cord and a faint wash). Split,
 * merge, Afturkalla and every edit are the band's own, unchanged; a layout only decides what is
 * on screen and how a card moves.
 *
 * Moving between flokkar on a phone:
 * - M1, M2: hold a card (200ms), then drag it up or down its column, across to the other column
 *   in view (M2), or onto another flokkur's crest in the row on top, which puts it at the end
 *   of that flokkur. The sheet's "Færa til" does the same in one tap.
 * - M3: no dragging (the rows are times, not places); the sheet's Fyrr, Síðar and Færa til.
 * - M4: hold and drag inside an open flokkur, or onto another flokkur's row.
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { BlockMinutes } from "@/components/plan/bench/BlockCard";
import { Stamp } from "@/components/plan/calendar/Stamp";
import type { PatrolAccent } from "@/services/plan.service";
import { AT_END, type CardDrag, type DropSpot } from "./cardDrag";
import { Crest } from "./laneHeaders";
import { at, type LaneItem, type LaneModel, type SplitModel } from "./labBench";
import type { PhoneLook } from "./phoneLooks";
import styles from "./phoneLayouts.module.css";

/** What the band hands a phone layout: its own grid pieces and the card's behaviour. */
export type PhoneParts = {
  /** The time axis and these flokkar's columns, as the desktop grid draws them. */
  columns: (lanes: LaneModel[], style?: CSSProperties) => ReactNode;
  /** One flokkur's column on its own, on the same minute scale. */
  lane: (lane: LaneModel) => ReactNode;
  /** A card's button props: its name, open on press, ↑ ↓ ← → (SplitGridLab's itemProps). */
  itemProps: (lane: LaneModel, li: LaneItem) => Record<string, unknown>;
  laneVars: (accent: PatrolAccent) => CSSProperties;
  selected: string | null;
  addTo: (lane: LaneModel) => void;
  /** Whether a card differs from the sveit's version. */
  changed: (li: LaneItem) => boolean;
};

type AreaProps = {
  model: SplitModel;
  drag: CardDrag | null;
  spot: DropSpot | null;
  parts: PhoneParts;
};

export function PhoneArea({ look, ...props }: AreaProps & { look: PhoneLook }) {
  if (look === "m1") return <OneAtATime {...props} />;
  if (look === "m2") return <CompareTwo {...props} />;
  if (look === "m3") return <ByTime {...props} />;
  return <PerFlokkur {...props} />;
}

/* ── Shared ── */

/** "70 mín · ræður lengd" or "45 mín · 30 mín bið". */
function LaneNums({ lane, model }: { lane: LaneModel; model: SplitModel }) {
  const state =
    model.balanced || model.duration === 0
      ? null
      : lane.longest
        ? "ræður lengd"
        : `${lane.idle} mín bið`;
  return (
    <span className={styles.nums}>
      <span className={styles.num} data-lane-total={lane.patrolId}>
        {lane.used} mín
      </span>
      {state && (
        <>
          <span aria-hidden="true">·</span>
          <span className={lane.longest ? styles.leads : styles.waits}>{state}</span>
        </>
      )}
    </span>
  );
}

/** Whether a drag is aimed at the end of this flokkur (its crest or row). */
function aimedAtEnd(lane: LaneModel, drag: CardDrag | null, spot: DropSpot | null) {
  return !!drag && spot?.lane === lane.laneIndex && spot.index === AT_END;
}

/**
 * The row of crests, one per flokkur, with its total and wait. Each one is a button (show it in
 * M1, pick it for M2) and a drop target: a card let go on it goes to the end of that flokkur.
 */
function CrestRow({
  model,
  shown,
  onPick,
  drag,
  spot,
  parts,
  label,
}: AreaProps & {
  shown: number[];
  onPick: (laneIndex: number) => void;
  label: string;
}) {
  return (
    <div className={styles.crestRow} role="group" aria-label={label}>
      {model.lanes.map((lane) => {
        const on = shown.includes(lane.laneIndex);
        return (
          <button
            key={lane.patrolId}
            type="button"
            className={styles.crestTab}
            style={parts.laneVars(lane.accent)}
            aria-pressed={on}
            data-lane-col={lane.laneIndex}
            data-drop-end
            data-over={aimedAtEnd(lane, drag, spot) || undefined}
            title={lane.name}
            onClick={() => onPick(lane.laneIndex)}
          >
            <Crest name={lane.name} size="2.25rem" />
            <span className={styles.crestTabText}>
              <span className={styles.oneLine}>{lane.name}</span>
              <LaneNums lane={lane} model={model} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── M1 · One flokkur at a time ── */

/** The pinned time axis's width: the grid's first cell ("kl."), so a column can sit beside it. */
function axisWidth(scroller: HTMLElement): number {
  return (scroller.firstElementChild?.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0;
}

/**
 * One flokkur's column at nearly full width, the next one peeking in at the edge, the time axis
 * pinned on the left. The crests on top say which flokkar there are and which is in view; a
 * swipe or a tap on a crest changes flokkur.
 */
function OneAtATime(props: AreaProps) {
  const { model, parts } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(0);
  // While a card is dragged the crests hold still, so the one under the finger stays there.
  const dragging = useRef(false);
  dragging.current = props.drag !== null;

  // The crest follows the swipe: the column whose left edge is nearest the axis is in view.
  useEffect(() => {
    const scroller = ref.current?.querySelector<HTMLElement>("[data-scroller]");
    if (!scroller) return;
    const update = () => {
      const columns = [...scroller.querySelectorAll<HTMLElement>("[data-lane-col]")];
      const axis = axisWidth(scroller);
      let best = 0;
      let bestDistance = Infinity;
      for (const column of columns) {
        const distance = Math.abs(column.offsetLeft - axis - scroller.scrollLeft);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = Number(column.dataset.laneCol);
        }
      }
      setInView(best);
      // Keep its crest in sight in the row on top (sideways only: the page doesn't move).
      const row = ref.current?.querySelector<HTMLElement>("[role='group']");
      const tab = row?.querySelector<HTMLElement>(`[data-lane-col="${best}"]`);
      if (row && tab && !dragging.current) {
        if (tab.offsetLeft < row.scrollLeft) row.scrollLeft = tab.offsetLeft;
        else if (tab.offsetLeft + tab.offsetWidth > row.scrollLeft + row.clientWidth) {
          row.scrollLeft = tab.offsetLeft + tab.offsetWidth - row.clientWidth;
        }
      }
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    return () => scroller.removeEventListener("scroll", update);
  }, [model.lanes.length]);

  const show = (laneIndex: number) => {
    const scroller = ref.current?.querySelector<HTMLElement>("[data-scroller]");
    const column = scroller?.querySelector<HTMLElement>(`[data-lane-col="${laneIndex}"]`);
    if (!scroller || !column) return;
    const axis = axisWidth(scroller);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({ left: column.offsetLeft - axis, behavior: still ? "auto" : "smooth" });
    setInView(laneIndex);
  };

  return (
    <div ref={ref} className={styles.area} data-look="m1">
      <CrestRow {...props} shown={[inView]} onPick={show} label="Flokkar, einn í einu" />
      {parts.columns(model.lanes, {
        // Nearly the band's width, so the next column peeks in by 2.25rem; the same room after
        // the last one, so it too can be scrolled up against the axis.
        ["--col-min" as string]: "calc(100cqw - var(--axis) - 2.25rem)",
        ["--tail" as string]: "2.25rem",
      })}
    </div>
  );
}

/* ── M2 · Compare two ── */

/**
 * Two flokkar side by side on the time axis: enough to compare and to drag across. The row of
 * crests picks the two (a third replaces the one picked longest ago) and keeps every other
 * flokkur's total and wait in view.
 */
function CompareTwo(props: AreaProps) {
  const { model, parts } = props;
  const [pair, setPair] = useState<[number, number]>([0, Math.min(1, model.lanes.length - 1)]);
  const shown = model.lanes.filter((lane) => pair.includes(lane.laneIndex));
  const pick = (laneIndex: number) => {
    if (pair.includes(laneIndex)) return;
    setPair([pair[1], laneIndex]);
  };
  return (
    <div className={styles.area} data-look="m2">
      <p className={styles.caption}>Veldu tvo flokka til að bera saman</p>
      <CrestRow {...props} shown={pair} onPick={pick} label="Flokkar sem eru bornir saman" />
      {parts.columns(shown, {
        ["--col-min" as string]: "calc((100cqw - var(--axis)) / 2 - 1px)",
      })}
    </div>
  );
}

/* ── M3 · Stacked by time ── */

type Row =
  | { kind: "start"; lane: LaneModel; li: LaneItem }
  | { kind: "wait"; lane: LaneModel; minutes: number };

/**
 * One timeline down the page. At each time a liður starts, a row with what every flokkur starts
 * then, as a short card line with its crest; where a flokkur is done before the band, a row
 * says how long it waits (and adds to it). Tap a line to open its card.
 */
function ByTime({ model, parts }: AreaProps) {
  const rows = new Map<number, Row[]>();
  const put = (minute: number, row: Row) => rows.set(minute, [...(rows.get(minute) ?? []), row]);
  for (const lane of model.lanes) {
    for (const li of lane.items) put(li.start, { kind: "start", lane, li });
    if (lane.idle > 0) put(lane.used, { kind: "wait", lane, minutes: lane.idle });
  }
  const minutes = [...rows.keys()].sort((a, b) => a - b);

  return (
    <div className={styles.area} data-look="m3">
      <ul className={styles.legend} aria-label="Flokkarnir">
        {model.lanes.map((lane) => (
          <li key={lane.patrolId} className={styles.legendItem} style={parts.laneVars(lane.accent)}>
            <Crest name={lane.name} size="1.75rem" />
            <span className={styles.legendText}>
              <span className={styles.oneLine} title={lane.name}>
                {lane.name}
              </span>
              <LaneNums lane={lane} model={model} />
            </span>
          </li>
        ))}
      </ul>
      <ol className={styles.timeline} aria-label="Tímalína">
        {minutes.map((minute) => (
          <li key={minute} className={styles.timeRow}>
            <span className={styles.time}>{at(model, minute)}</span>
            <ul className={styles.timeItems}>
              {rows.get(minute)!.map((row) =>
                row.kind === "start" ? (
                  <li key={row.li.item.id}>
                    <TimeLine row={row} parts={parts} />
                  </li>
                ) : (
                  <li key={`wait-${row.lane.patrolId}`}>
                    <button
                      type="button"
                      className={styles.waitLine}
                      style={parts.laneVars(row.lane.accent)}
                      aria-label={
                        row.lane.items.length === 0
                          ? `Ekkert skráð. Bæta verkefni við (${row.lane.name})`
                          : `${row.minutes} mín bið. Bæta verkefni við (${row.lane.name})`
                      }
                      onClick={() => parts.addTo(row.lane)}
                    >
                      <Crest name={row.lane.name} size="1.75rem" />
                      <span className={styles.lineText}>
                        <span className={styles.oneLine}>{row.lane.name}</span>
                        <span className={styles.lineMeta}>
                          {row.lane.items.length === 0
                            ? "Ekkert skráð · + Bæta við"
                            : `${row.minutes} mín bið · + Bæta við`}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              )}
            </ul>
          </li>
        ))}
        <li className={styles.timeRow} data-end>
          <span className={styles.time}>{at(model, model.duration)}</span>
          <span className={styles.endNote}>Lok · allir koma saman</span>
        </li>
      </ol>
    </div>
  );
}

/** One liður on the timeline: the flokkur's crest, the name, its length and status stamp. */
function TimeLine({ row, parts }: { row: Extract<Row, { kind: "start" }>; parts: PhoneParts }) {
  const { lane, li } = row;
  return (
    <button
      type="button"
      className={styles.line}
      style={parts.laneVars(lane.accent)}
      data-status={li.item.status}
      data-on={parts.selected === li.item.id || undefined}
      {...parts.itemProps(lane, li)}
    >
      <Crest name={lane.name} size="1.75rem" />
      <span className={styles.lineText}>
        <span className={styles.lineTitle}>{li.item.name}</span>
        <span className={styles.lineMeta}>
          <BlockMinutes minutes={li.item.minutes} hidden />
          <span className={styles.oneLine}>{lane.name}</span>
        </span>
      </span>
      <Stamp entry={{ id: li.item.id, status: li.item.status, type: "flokks" }} size="sm" />
      {parts.changed(li) && (
        <span className={styles.changedDot} title="Breytt fyrir þennan flokk" aria-hidden="true" />
      )}
    </button>
  );
}

/* ── M4 · List per flokkur ── */

/**
 * One row per flokkur: its crest, name, total, and a bar for its length against the band's (the
 * longest fills it; the others end in a dashed wait). Open a row to see its column of cards.
 * Several can be open; the first is open to begin with.
 */
function PerFlokkur(props: AreaProps) {
  const { model, drag, spot, parts } = props;
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(model.lanes[0] ? [model.lanes[0].patrolId] : [])
  );
  const baseId = useId();
  const toggle = (patrolId: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(patrolId)) next.delete(patrolId);
      else next.add(patrolId);
      return next;
    });
  const span = Math.max(model.duration, 1);

  return (
    <div className={styles.area} data-look="m4">
      {model.lanes.map((lane) => {
        const isOpen = open.has(lane.patrolId);
        const panelId = `${baseId}-${lane.laneIndex}`;
        return (
          <section
            key={lane.patrolId}
            className={styles.flokkur}
            style={parts.laneVars(lane.accent)}
          >
            <h4 className={styles.flokkurHead}>
              <button
                type="button"
                className={styles.flokkurButton}
                aria-expanded={isOpen}
                aria-controls={panelId}
                data-lane-col={lane.laneIndex}
                data-drop-end
                data-over={aimedAtEnd(lane, drag, spot) || undefined}
                onClick={() => toggle(lane.patrolId)}
              >
                <Crest name={lane.name} size="2.25rem" />
                <span className={styles.flokkurText}>
                  <span className={styles.twoLines} title={lane.name}>
                    {lane.name}
                  </span>
                  <LaneNums lane={lane} model={model} />
                  <span className={styles.bar} aria-hidden="true">
                    <span
                      className={styles.barFill}
                      style={{ width: `${(lane.used / span) * 100}%` }}
                    />
                  </span>
                </span>
                <ChevronDown className={styles.chevron} aria-hidden="true" />
              </button>
            </h4>
            {isOpen && (
              <div id={panelId} className={styles.flokkurPanel}>
                {parts.lane(lane)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
