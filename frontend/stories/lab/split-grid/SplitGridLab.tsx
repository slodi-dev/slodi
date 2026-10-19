import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useDndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { MIN_MINUTES } from "@/components/plan/bench/benchState";
import { dragId } from "@/components/plan/bench/dnd";
import { countIs } from "@/lib/format";
import {
  BANDS,
  BAND_KIND,
  BAND_OF,
  type BandId,
  type Fundur,
  type PatrolAccent,
  type PlanBenchData,
} from "@/services/plan.service";
import {
  LabBench,
  at,
  balanceSentence,
  planMerge,
  splitModel,
  useLabBench,
  type LaneItem,
  type LaneModel,
  type MergeKeep,
  type MergePlan,
  type SplitModel,
} from "./labBench";
import { LAB_FUNDUR } from "./splitGridLabData";
import styles from "./SplitGridLab.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────── */

/**
 * - `timaas`: A · lanes on a shared time axis. One row per flokkur, liðir as wide as they are long.
 * - `stodvar`: B · station rotation. Stations as rows, time as columns, flokkar as tokens.
 * - `fylki`: C · compact matrix. Flokkar as rows, fixed time slots as columns, like the Rist.
 * - `spjold`: D · cards per flokkur, with a switcher. One lane at a time; built for the phone.
 */
export type SplitGridLook = "timaas" | "stodvar" | "fylki" | "spjold";

export interface SplitGridLabProps {
  /** Which lab direction to render. */
  look: SplitGridLook;
  data: PlanBenchData;
  fundurId?: string;
  band?: BandId;
  /** Open the merge confirmation straight away. */
  defaultMergeOpen?: boolean;
  /** D: the flokkur shown first, by lane position. */
  defaultLane?: number;
}

/* ── Root ──────────────────────────────────────────────────────────────────── */

export default function SplitGridLab({ data, ...props }: SplitGridLabProps) {
  return (
    <LabBench data={data}>
      <SplitBand {...props} />
    </LabBench>
  );
}

/** What every direction gets from the band: the model and the shared move paths. */
type Ctx = {
  model: SplitModel;
  selected: string | null;
  hintId: string;
  itemProps: (lane: LaneModel, li: LaneItem) => ItemProps;
  moveTo: (lane: LaneModel, li: LaneItem, toLane: number) => void;
  reorder: (lane: LaneModel, li: LaneItem, to: number) => void;
  addTo: (lane: LaneModel) => void;
  deselect: () => void;
};

type ItemProps = {
  "data-lidur-id": string;
  "aria-label": string;
  "aria-describedby": string;
  "aria-pressed": boolean;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
};

function SplitBand({
  look,
  fundurId = LAB_FUNDUR,
  band = "kjarni",
  defaultMergeOpen = false,
  defaultLane = 0,
}: Omit<SplitGridLabProps, "data">) {
  const { state, dispatch } = useLabBench();
  const fundur = state.data.fundir.find((f) => f.event_id === fundurId);
  const model = fundur ? splitModel(fundur, band, state.data.patrols) : null;
  const selected = state.laneSelected;

  const rootRef = useRef<HTMLDivElement>(null);
  const mergeButtonRef = useRef<HTMLButtonElement>(null);
  const hintId = useId();
  const mergeId = useId();
  const [activeLane, setActiveLane] = useState(defaultLane);
  const [mergeOpen, setMergeOpen] = useState(defaultMergeOpen);
  // Focus moves into the confirmation only when the leader opened it, not when a story starts
  // with it open (that would scroll a Docs page to it).
  const [mergeOpenedByUser, setMergeOpenedByUser] = useState(false);
  const [undo, setUndo] = useState<{ fundur: Fundur; text: string } | null>(null);

  /*
   * Focus follows a moved liður. The block unmounts from one lane and mounts in another, so
   * without this a second → press lands on nothing and the leader has to find the block again.
   */
  const focusTarget = useRef<string | null>(null);
  useEffect(() => {
    const id = focusTarget.current;
    if (!id) return;
    focusTarget.current = null;
    rootRef.current?.querySelector<HTMLElement>(`[data-lidur-id="${CSS.escape(id)}"]`)?.focus();
  }, [state.data, activeLane]);

  // UX rule 5: "Afturkalla" stays for at least 8 seconds.
  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  if (!fundur) return null;

  if (!model) {
    return (
      <MergedBand
        fundur={fundur}
        band={band}
        undo={undo}
        onUndo={() => {
          if (!undo) return;
          dispatch({ t: "labRestore", fundur: undo.fundur });
          setUndo(null);
        }}
        onSplit={() => dispatch({ t: "splitBand", fundurId, band })}
      />
    );
  }

  const plan = planMerge(
    model.lanes.map((lane) => ({
      patrol_id: lane.patrolId,
      items: lane.items.map((li) => li.item),
    }))
  );

  const merge = (keep: MergeKeep) => {
    const dropped = keep === "all" ? 0 : (plan.droppedIfKeep[keep]?.length ?? 0);
    setUndo({
      fundur,
      text: dropped
        ? `Sameinað. ${countIs(dropped, "liður féll", "liðir féllu")} út.`
        : "Sameinað í eina röð. Ekkert féll út.",
    });
    setMergeOpen(false);
    dispatch({ t: "labMerge", fundurId, band, keep });
  };

  const moveTo = (lane: LaneModel, li: LaneItem, toLane: number) => {
    if (toLane < 0 || toLane >= model.lanes.length || toLane === lane.laneIndex) return;
    dispatch({
      t: "laneMoveAcross",
      fundurId,
      band,
      fromLane: lane.laneIndex,
      toLane,
      id: li.item.id,
    });
    focusTarget.current = li.item.id;
    setActiveLane(toLane);
  };

  const reorder = (lane: LaneModel, li: LaneItem, to: number) => {
    if (to < 0 || to >= lane.items.length) return;
    dispatch({ t: "laneMove", fundurId, band, laneIndex: lane.laneIndex, id: li.item.id, to });
    focusTarget.current = li.item.id;
  };

  const addTo = (lane: LaneModel) =>
    dispatch({
      t: "laneAdd",
      fundurId,
      band,
      laneIndex: lane.laneIndex,
      // Fits the wait it was offered in, as SplitGrid does.
      lidur: {
        name: "Nýtt verkefni",
        kind: BAND_KIND[band],
        minutes: Math.max(MIN_MINUTES, Math.min(15, lane.idle || 15)),
        status: "draft",
        theme: fundur.theme ?? null,
        venue: null,
        endurmat: null,
      },
    });

  const itemProps = (lane: LaneModel, li: LaneItem): ItemProps => ({
    "data-lidur-id": li.item.id,
    "aria-label": itemLabel(lane, li),
    "aria-describedby": hintId,
    "aria-pressed": selected === li.item.id,
    onClick: () => dispatch({ t: "laneSelect", id: selected === li.item.id ? null : li.item.id }),
    onKeyDown: (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        moveTo(lane, li, lane.laneIndex + (e.key === "ArrowLeft" ? -1 : 1));
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        reorder(lane, li, li.index + (e.key === "ArrowUp" ? -1 : 1));
      } else if (e.key === "Escape" && selected) {
        dispatch({ t: "laneSelect", id: null });
      }
    },
  });

  const ctx: Ctx = {
    model,
    selected,
    hintId,
    itemProps,
    moveTo,
    reorder,
    addTo,
    deselect: () => dispatch({ t: "laneSelect", id: null }),
  };

  const picked = findSelected(model, selected);

  return (
    <div ref={rootRef} className={styles.root} data-look={look}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h3 className={styles.title}>{model.label}</h3>
          <p className={styles.meta}>
            <span>Skipt á {countIs(model.lanes.length, "flokk", "flokka")}</span>
            <span className={styles.num}>
              {model.duration} mín samhliða
              {model.from ? ` · ${model.from}–${model.to}` : ""}
            </span>
          </p>
        </div>
        <button
          ref={mergeButtonRef}
          type="button"
          className={styles.quiet}
          aria-expanded={plan.identical ? undefined : mergeOpen}
          aria-controls={plan.identical ? undefined : mergeId}
          onClick={() => {
            if (plan.identical) return merge("all");
            setMergeOpenedByUser(true);
            setMergeOpen((open) => !open);
          }}
        >
          {plan.identical ? "Sameina í eitt" : "Sameina í eitt…"}
        </button>
      </div>

      {mergeOpen && !plan.identical && (
        <MergePanel
          id={mergeId}
          model={model}
          plan={plan}
          takeFocus={mergeOpenedByUser}
          onCancel={() => {
            setMergeOpen(false);
            mergeButtonRef.current?.focus();
          }}
          onConfirm={merge}
        />
      )}

      <p className={styles.balance} data-balanced={model.balanced || undefined}>
        {balanceSentence(model)}
      </p>

      {look === "timaas" && <TimeAxis ctx={ctx} />}
      {look === "stodvar" && <Stations ctx={ctx} />}
      {look === "fylki" && <Matrix ctx={ctx} />}
      {look === "spjold" && (
        <Cards
          ctx={ctx}
          activeLane={Math.min(activeLane, model.lanes.length - 1)}
          onLane={setActiveLane}
        />
      )}

      {picked && look !== "spjold" && <MoveStrip ctx={ctx} lane={picked.lane} li={picked.li} />}

      <p id={hintId} className={styles.hint}>
        ← → færa í fyrri eða næsta flokk · ↑ ↓ breyta röð · eða dragðu á annan flokk
      </p>
    </div>
  );
}

/* ── Shared pieces ─────────────────────────────────────────────────────────── */

function itemLabel(lane: LaneModel, li: LaneItem): string {
  const when = li.clock ? `kl. ${li.clock}` : `${li.index + 1}. liður`;
  return `${lane.name} ${when}: ${li.item.name}, ${li.item.minutes} mín`;
}

function findSelected(model: SplitModel, id: string | null) {
  if (!id) return null;
  for (const lane of model.lanes) {
    const li = lane.items.find((entry) => entry.item.id === id);
    if (li) return { lane, li };
  }
  return null;
}

/** The custom properties a lane's colour comes through. Background and text always as a pair. */
function laneVars(accent: PatrolAccent): CSSProperties {
  return {
    ["--lane" as string]: `var(--sl-color-patrol-${accent})`,
    ["--lane-on" as string]: `var(--sl-color-patrol-${accent}-foreground)`,
  };
}

/** Patrol identity: the vivid colour and the name, always together. */
function PatrolTag({ lane, small = false }: { lane: LaneModel; small?: boolean }) {
  return (
    <span className={styles.tag} data-small={small || undefined} style={laneVars(lane.accent)}>
      {lane.name}
    </span>
  );
}

/** The lane's total, which every direction shows and the play tests read. */
function LaneTotal({ lane }: { lane: LaneModel }) {
  return (
    <span className={styles.num} data-lane-total={lane.patrolId}>
      {lane.used} mín
    </span>
  );
}

/** "ræður lengd" for the lane that sets the band, "15 mín bið" for one that waits. */
function LaneState({ lane, model }: { lane: LaneModel; model: SplitModel }) {
  if (model.balanced || model.duration === 0) return null;
  if (lane.longest) return <span className={styles.leads}>ræður lengd</span>;
  return <span className={styles.waits}>{lane.idle} mín bið</span>;
}

/** A drop target for one lane. Not lit for the lane the drag came from: that drop is refused. */
function useLaneDrop(model: SplitModel, laneIndex: number) {
  const { setNodeRef, isOver } = useDroppable({
    id: dragId.laneDrop(model.fundur.event_id, model.band, laneIndex),
    data: { kind: "lane", fundurId: model.fundur.event_id, band: model.band, laneIndex },
  });
  const { active } = useDndContext();
  const from = active?.data.current as { kind?: string; laneIndex?: number } | undefined;
  const isSource = from?.kind === "lane" && from.laneIndex === laneIndex;
  return { setNodeRef, over: isOver && !isSource };
}

/** A liður that can be focused, pressed, moved with ← → and dragged. */
function DragItem({
  ctx,
  lane,
  li,
  className,
  style,
  children,
}: {
  ctx: Ctx;
  lane: LaneModel;
  li: LaneItem;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { model } = ctx;
  // `listeners` only: there is no KeyboardSensor (dnd.ts), and dnd-kit's `attributes` would add
  // a second role and tab stop to what is already a real button.
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: dragId.lane(li.item.id),
    data: {
      kind: "lane",
      fundurId: model.fundur.event_id,
      band: model.band,
      laneIndex: lane.laneIndex,
      lidur: li.item,
    },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={className}
      style={{ ...laneVars(lane.accent), ...style }}
      data-on={ctx.selected === li.item.id || undefined}
      data-dragging={isDragging || undefined}
      {...listeners}
      {...ctx.itemProps(lane, li)}
    >
      {children}
    </button>
  );
}

/**
 * What the selected liður can do. Every other flokkur is a named button, so a phone user can
 * send a liður from the first flokkur to the sixth in one tap instead of five.
 */
function MoveStrip({ ctx, lane, li }: { ctx: Ctx; lane: LaneModel; li: LaneItem }) {
  const { model } = ctx;
  const when = li.clock ? `${li.clock}–${li.clockEnd}` : `+${li.start} mín`;
  return (
    <div className={styles.strip} role="group" aria-label={`Valinn liður: ${li.item.name}`}>
      <p className={styles.stripTitle}>
        <span className={styles.stripName}>{li.item.name}</span>
        <span className={styles.stripMeta}>
          <PatrolTag lane={lane} small />
          <span className={styles.num}>
            {when} · {li.item.minutes} mín
          </span>
        </span>
      </p>
      <div className={styles.stripActions}>
        <span className={styles.stripLabel}>Færa til:</span>
        {model.lanes
          .filter((other) => other.laneIndex !== lane.laneIndex)
          .map((other) => (
            <button
              key={other.patrolId}
              type="button"
              className={styles.moveTo}
              style={laneVars(other.accent)}
              aria-label={`Færa ${li.item.name} til ${other.name}`}
              onClick={() => ctx.moveTo(lane, li, other.laneIndex)}
            >
              {other.name}
            </button>
          ))}
        <span className={styles.stripGap} />
        <button
          type="button"
          className={styles.quiet}
          disabled={li.index === 0}
          aria-label={`Færa ${li.item.name} framar`}
          onClick={() => ctx.reorder(lane, li, li.index - 1)}
        >
          ↑ Fyrr
        </button>
        <button
          type="button"
          className={styles.quiet}
          disabled={li.index === lane.items.length - 1}
          aria-label={`Færa ${li.item.name} aftar`}
          onClick={() => ctx.reorder(lane, li, li.index + 1)}
        >
          ↓ Síðar
        </button>
        <button type="button" className={styles.quiet} aria-label="Loka" onClick={ctx.deselect}>
          ✕
        </button>
      </div>
    </div>
  );
}

/* ── A · Tímaás ────────────────────────────────────────────────────────────── */

function tickStep(duration: number): number {
  if (duration <= 30) return 5;
  if (duration <= 90) return 15;
  return 30;
}

function TimeAxis({ ctx }: { ctx: Ctx }) {
  const { model } = ctx;
  const span = Math.max(model.duration, 15);
  const step = tickStep(span);
  const ticks: number[] = [];
  for (let m = 0; m < span - step / 2; m += step) ticks.push(m);
  ticks.push(span);
  // On a phone only the half hours are labelled; the rest would run into each other.
  const minor = (m: number) => m !== 0 && m !== span && m % 30 !== 0;

  return (
    <div className={styles.axis}>
      <div className={styles.ruler} aria-hidden="true">
        <span />
        <div className={styles.rulerTrack}>
          {ticks.map((m) => (
            <span
              key={m}
              className={styles.tick}
              data-edge={m === 0 ? "start" : m === span ? "end" : undefined}
              data-minor={minor(m) || undefined}
              style={{ left: `${(m / span) * 100}%` }}
            >
              {at(model, m)}
            </span>
          ))}
        </div>
      </div>
      {model.lanes.map((lane) => (
        <AxisLane key={lane.patrolId} ctx={ctx} lane={lane} span={span} />
      ))}
      {model.from && model.duration > 0 && (
        <p className={styles.regroup}>Allir saman aftur kl. {model.to}</p>
      )}
    </div>
  );
}

function AxisLane({ ctx, lane, span }: { ctx: Ctx; lane: LaneModel; span: number }) {
  const { model } = ctx;
  const { setNodeRef, over } = useLaneDrop(model, lane.laneIndex);
  const labelId = useId();
  const pct = (m: number) => `${(m / span) * 100}%`;

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-labelledby={labelId}
      className={styles.axisRow}
      data-over={over || undefined}
      style={laneVars(lane.accent)}
    >
      <div className={styles.axisLabel} id={labelId}>
        <PatrolTag lane={lane} />
        <span className={styles.axisNums}>
          <LaneTotal lane={lane} />
          <LaneState lane={lane} model={model} />
        </span>
      </div>
      <div className={styles.track}>
        {lane.items.map((li) => {
          const narrow = li.item.minutes / span < 0.12;
          return (
            <DragItem
              key={li.item.id}
              ctx={ctx}
              lane={lane}
              li={li}
              className={styles.block}
              style={{ left: pct(li.start), width: pct(li.item.minutes) }}
            >
              {!narrow && <span className={styles.blockTitle}>{li.item.name}</span>}
              <span className={styles.blockMeta}>{li.item.minutes} mín</span>
            </DragItem>
          );
        })}
        {lane.items.length === 0 ? (
          <button
            type="button"
            className={styles.gap}
            style={{ left: 0, width: "100%" }}
            aria-label={`Bæta verkefni við hjá ${lane.name}`}
            onClick={() => ctx.addTo(lane)}
          >
            Ekkert skráð · + Bæta við
          </button>
        ) : (
          lane.idle > 0 && (
            <button
              type="button"
              className={styles.gap}
              style={{ left: pct(lane.used), width: pct(lane.idle) }}
              aria-label={`${lane.idle} mín bið. Bæta verkefni við hjá ${lane.name}`}
              onClick={() => ctx.addTo(lane)}
            >
              {lane.idle} mín bið
            </button>
          )
        )}
      </div>
    </div>
  );
}

/* ── B · Stöðvar ───────────────────────────────────────────────────────────── */

type Slot = { start: number; end: number };

function slotsOf(model: SplitModel): Slot[] {
  const edges = new Set<number>([0, model.duration]);
  for (const lane of model.lanes) {
    for (const li of lane.items) {
      edges.add(li.start);
      edges.add(li.start + li.item.minutes);
    }
  }
  const sorted = [...edges].sort((a, b) => a - b);
  return sorted.slice(0, -1).map((start, i) => ({ start, end: sorted[i + 1] }));
}

function Stations({ ctx }: { ctx: Ctx }) {
  const { model } = ctx;
  const slots = slotsOf(model);

  // Stations in the order they first start, so the table reads top-left to bottom-right.
  const stations = useMemo(() => {
    const first = new Map<string, number>();
    for (const lane of model.lanes) {
      for (const li of lane.items) {
        const seen = first.get(li.item.name);
        if (seen === undefined || li.start < seen) first.set(li.item.name, li.start);
      }
    }
    return [...first.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name);
  }, [model]);

  const occupants = (station: string, slot: Slot) =>
    model.lanes.flatMap((lane) =>
      lane.items
        .filter(
          (li) =>
            li.item.name === station &&
            li.start <= slot.start &&
            slot.start < li.start + li.item.minutes
        )
        .map((li) => ({ lane, li, first: li.start === slot.start }))
    );

  const clashes = stations.reduce(
    (n, station) =>
      n +
      slots.filter((slot) => new Set(occupants(station, slot).map((o) => o.lane.patrolId)).size > 1)
        .length,
    0
  );

  const waiting = (slot: Slot) => model.lanes.filter((lane) => lane.used <= slot.start);

  return (
    <div className={styles.stations}>
      <ul className={styles.legend} aria-label="Flokkar">
        {model.lanes.map((lane) => (
          <LegendChip key={lane.patrolId} ctx={ctx} lane={lane} />
        ))}
      </ul>

      {clashes > 0 && (
        <p className={styles.clashNote}>
          <span aria-hidden="true">⚠ </span>
          {countIs(clashes, "árekstur", "árekstrar")}: fleiri en einn flokkur á sömu stöð á sama
          tíma.
        </p>
      )}

      {stations.length === 0 ? (
        <p className={styles.empty}>Engar stöðvar enn.</p>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>
              Hvaða flokkur er á hvaða stöð, og hvenær.{" "}
              {countIs(stations.length, "stöð", "stöðvar")}.
            </caption>
            <thead>
              <tr>
                <th scope="col" className={styles.corner}>
                  Stöð
                </th>
                {slots.map((slot) => (
                  <th key={slot.start} scope="col" className={styles.slotHead}>
                    <span className={styles.num}>{at(model, slot.start)}</span>
                    <span className={styles.slotLen}>{slot.end - slot.start} mín</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stations.map((station) => (
                <tr key={station}>
                  <th scope="row" className={styles.stationName}>
                    {station}
                  </th>
                  {slots.map((slot) => {
                    const here = occupants(station, slot);
                    const clash = new Set(here.map((o) => o.lane.patrolId)).size > 1;
                    return (
                      <td key={slot.start} className={styles.cell} data-clash={clash || undefined}>
                        {here.map(({ lane, li, first }) =>
                          first ? (
                            <DragItem
                              key={li.item.id}
                              ctx={ctx}
                              lane={lane}
                              li={li}
                              className={styles.token}
                            >
                              {lane.name}
                            </DragItem>
                          ) : (
                            <span
                              key={li.item.id}
                              className={styles.tokenCont}
                              style={laneVars(lane.accent)}
                            >
                              {lane.name} frh.
                            </span>
                          )
                        )}
                        {clash && <span className={styles.clashTag}>Árekstur</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {slots.some((slot) => waiting(slot).length > 0) && (
                <tr className={styles.waitRow}>
                  <th scope="row" className={styles.stationName}>
                    Bið
                  </th>
                  {slots.map((slot) => (
                    <td key={slot.start} className={styles.cell}>
                      {waiting(slot).map((lane) => (
                        <PatrolTag key={lane.patrolId} lane={lane} small />
                      ))}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LegendChip({ ctx, lane }: { ctx: Ctx; lane: LaneModel }) {
  const { setNodeRef, over } = useLaneDrop(ctx.model, lane.laneIndex);
  return (
    <li
      ref={setNodeRef}
      className={styles.legendChip}
      data-over={over || undefined}
      style={laneVars(lane.accent)}
    >
      <PatrolTag lane={lane} />
      <LaneTotal lane={lane} />
      <LaneState lane={lane} model={ctx.model} />
    </li>
  );
}

/* ── C · Fylki ─────────────────────────────────────────────────────────────── */

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function Matrix({ ctx }: { ctx: Ctx }) {
  const { model } = ctx;
  // The coarsest slot every liður fits exactly, never under 5 mín.
  const slot = Math.max(
    MIN_MINUTES,
    model.lanes
      .flatMap((l) => l.items)
      .reduce((g, li) => gcd(g, li.item.minutes), model.duration) || 15
  );
  const columns = Math.max(1, Math.round(model.duration / slot));
  const labelEvery = Math.max(1, Math.round(15 / slot));
  // 0.6rem per minute: a 10-minute liður gets 6rem, room for "Skyndihjálp".
  const slotRem = slot * 0.6;

  return (
    <div className={styles.scroll}>
      {/* Fixed column widths, so a 15-minute liður gets room for its name and a narrow box
          scrolls sideways instead of crushing every cell to one word per line. */}
      <table
        className={`${styles.table} ${styles.matrixTable}`}
        style={{ minWidth: `${14 + columns * slotRem}rem` }}
      >
        <colgroup>
          <col style={{ width: "7rem" }} />
          {Array.from({ length: columns }, (_, i) => (
            <col key={i} style={{ width: `${slotRem}rem` }} />
          ))}
          <col style={{ width: "7rem" }} />
        </colgroup>
        <caption className={styles.srOnly}>
          Hvað hver flokkur gerir, í {slot} mínútna hólfum.
        </caption>
        <thead>
          <tr>
            <th scope="col" className={styles.corner}>
              Flokkur
            </th>
            {Array.from({ length: columns }, (_, i) => (
              <th key={i} scope="col" className={styles.matrixHead}>
                {i % labelEvery === 0 ? (
                  <span className={styles.num}>{at(model, i * slot)}</span>
                ) : (
                  <span className={styles.srOnly}>{at(model, i * slot)}</span>
                )}
              </th>
            ))}
            <th scope="col" className={styles.matrixTotalHead}>
              Samtals
            </th>
          </tr>
        </thead>
        <tbody>
          {model.lanes.map((lane) => (
            <MatrixRow key={lane.patrolId} ctx={ctx} lane={lane} slot={slot} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatrixRow({
  ctx,
  lane,
  slot,
  columns,
}: {
  ctx: Ctx;
  lane: LaneModel;
  slot: number;
  columns: number;
}) {
  const { model } = ctx;
  const { setNodeRef, over } = useLaneDrop(model, lane.laneIndex);
  const idleCols = Math.round(lane.idle / slot);
  const share = model.duration ? (lane.used / model.duration) * 100 : 0;

  return (
    <tr ref={setNodeRef} data-over={over || undefined} className={styles.matrixRow}>
      <th scope="row" className={styles.matrixName}>
        <PatrolTag lane={lane} />
      </th>
      {lane.items.map((li) => (
        <td
          key={li.item.id}
          colSpan={Math.max(1, Math.round(li.item.minutes / slot))}
          className={styles.matrixCell}
        >
          <DragItem ctx={ctx} lane={lane} li={li} className={styles.chip}>
            <span className={styles.chipTitle}>{li.item.name}</span>
            <span className={styles.chipMeta}>
              {li.clock ? `${li.clock} · ` : ""}
              {li.item.minutes} mín
            </span>
          </DragItem>
        </td>
      ))}
      {lane.items.length === 0 && columns > 0 ? (
        <td colSpan={columns} className={styles.matrixCell}>
          <button type="button" className={styles.gapCell} onClick={() => ctx.addTo(lane)}>
            Ekkert skráð · + Bæta við
          </button>
        </td>
      ) : (
        idleCols > 0 && (
          <td colSpan={idleCols} className={styles.matrixCell}>
            <span className={styles.idleCell}>{lane.idle} mín bið</span>
          </td>
        )
      )}
      <td className={styles.matrixTotal}>
        <span className={styles.matrixTotalTop}>
          <LaneTotal lane={lane} />
          <LaneState lane={lane} model={model} />
        </span>
        <span className={styles.bar} aria-hidden="true" style={laneVars(lane.accent)}>
          <span style={{ width: `${share}%` }} />
        </span>
      </td>
    </tr>
  );
}

/* ── D · Spjöld ────────────────────────────────────────────────────────────── */

function Cards({
  ctx,
  activeLane,
  onLane,
}: {
  ctx: Ctx;
  activeLane: number;
  onLane: (lane: number) => void;
}) {
  const { model, selected } = ctx;
  const panelId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lane = model.lanes[activeLane];

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = model.lanes.length;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (i + 1) % n
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? (i - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : null;
    if (next === null) return;
    e.preventDefault();
    onLane(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className={styles.cards}>
      <div role="tablist" aria-label="Flokkar" className={styles.tabs}>
        {model.lanes.map((l, i) => (
          <LaneTab
            key={l.patrolId}
            ctx={ctx}
            lane={l}
            active={i === activeLane}
            panelId={panelId}
            refFn={(node) => {
              tabRefs.current[i] = node;
            }}
            onSelect={() => onLane(i)}
            onKeyDown={(e) => onTabKey(e, i)}
          />
        ))}
      </div>

      <div
        role="tabpanel"
        id={panelId}
        aria-label={lane.name}
        className={styles.panel}
        style={laneVars(lane.accent)}
      >
        {lane.items.length === 0 ? (
          <div className={styles.endCard}>
            <p>Ekkert skráð enn.</p>
            <button type="button" className={styles.quiet} onClick={() => ctx.addTo(lane)}>
              + Bæta við
            </button>
          </div>
        ) : (
          <ol className={styles.cardList}>
            {lane.items.map((li) => (
              <li key={li.item.id} className={styles.cardItem}>
                <DragItem ctx={ctx} lane={lane} li={li} className={styles.card}>
                  <span className={styles.cardWhen}>
                    {li.clock ? `${li.clock}–${li.clockEnd}` : `${li.index + 1}. liður`}
                  </span>
                  <span className={styles.cardTitle}>{li.item.name}</span>
                  <span className={styles.cardMin}>{li.item.minutes} mín</span>
                </DragItem>
                {selected === li.item.id && <MoveStrip ctx={ctx} lane={lane} li={li} />}
              </li>
            ))}
          </ol>
        )}
        {lane.items.length > 0 && (
          <div className={styles.endCard} data-waits={lane.idle > 0 || undefined}>
            {lane.idle > 0 ? (
              <>
                <p>
                  <span className={styles.num}>
                    Lok {at(model, lane.used)} · {lane.idle} mín bið
                  </span>{" "}
                  þar til allir eru búnir.
                </p>
                <button type="button" className={styles.quiet} onClick={() => ctx.addTo(lane)}>
                  + Fylla biðina
                </button>
              </>
            ) : (
              <p className={styles.num}>
                Lok {at(model, lane.used)}
                {model.balanced
                  ? " · allir búnir á sama tíma."
                  : " · þessi flokkur ræður lengdinni."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LaneTab({
  ctx,
  lane,
  active,
  panelId,
  refFn,
  onSelect,
  onKeyDown,
}: {
  ctx: Ctx;
  lane: LaneModel;
  active: boolean;
  panelId: string;
  refFn: (node: HTMLButtonElement | null) => void;
  onSelect: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const { model } = ctx;
  const { setNodeRef, over } = useLaneDrop(model, lane.laneIndex);
  const share = model.duration ? (lane.used / model.duration) * 100 : 0;
  return (
    <button
      ref={(node) => {
        setNodeRef(node);
        refFn(node);
      }}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={active ? panelId : undefined}
      tabIndex={active ? 0 : -1}
      className={styles.tab}
      data-over={over || undefined}
      style={laneVars(lane.accent)}
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      <PatrolTag lane={lane} />
      <span className={styles.tabNums}>
        <LaneTotal lane={lane} />
        <LaneState lane={lane} model={model} />
      </span>
      <span className={styles.bar} aria-hidden="true">
        <span style={{ width: `${share}%` }} />
      </span>
    </button>
  );
}

/* ── Merge ─────────────────────────────────────────────────────────────────── */

/**
 * The merge confirmation: what stays, what goes, and what it does to the clock, before
 * anything happens. Only shown when the lanes differ; identical lanes merge at once.
 */
function MergePanel({
  id,
  model,
  plan,
  takeFocus,
  onCancel,
  onConfirm,
}: {
  id: string;
  model: SplitModel;
  plan: MergePlan;
  takeFocus: boolean;
  onCancel: () => void;
  onConfirm: (keep: MergeKeep) => void;
}) {
  const [mode, setMode] = useState<"all" | "one">("all");
  const [laneId, setLaneId] = useState(model.lanes[0].patrolId);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const name = useId();
  const selectId = useId();

  useEffect(() => {
    if (takeFocus) headingRef.current?.focus();
  }, [takeFocus]);

  const allMinutes = plan.all.reduce((sum, e) => sum + e.item.minutes, 0);
  const keptLane = model.lanes.find((lane) => lane.patrolId === laneId) ?? model.lanes[0];
  const dropped = plan.droppedIfKeep[keptLane.patrolId] ?? [];
  const droppedMinutes = dropped.reduce((sum, e) => sum + e.item.minutes, 0);
  const laneOf = (patrolId: string) => model.lanes.find((lane) => lane.patrolId === patrolId);

  const holders = (patrolIds: string[]) =>
    patrolIds.length === model.lanes.length ? (
      <span className={styles.allFlokkar}>allir flokkar</span>
    ) : (
      patrolIds.map((pid) => {
        const lane = laneOf(pid);
        return lane ? <PatrolTag key={pid} lane={lane} small /> : null;
      })
    );

  const longer = allMinutes - model.duration;

  return (
    <section id={id} className={styles.merge} aria-labelledby={`${id}-h`}>
      <h4 id={`${id}-h`} ref={headingRef} tabIndex={-1} className={styles.mergeTitle}>
        Sameina í eina röð?
      </h4>
      <p className={styles.mergeLead}>
        Flokkarnir eru ekki með sömu dagskrá, svo eitthvað breytist. Veldu hvað á að halda.
      </p>

      <fieldset className={styles.choices}>
        <legend className={styles.srOnly}>Hvað á að halda?</legend>
        <label className={styles.choice}>
          <input
            type="radio"
            name={name}
            checked={mode === "all"}
            onChange={() => setMode("all")}
          />
          <span>
            <span className={styles.choiceTitle}>Halda öllu, hvað á eftir öðru</span>
            <span className={styles.choiceHelp}>
              {countIs(plan.all.length, "liður", "liðir")} í einni röð, {allMinutes} mín í stað{" "}
              {model.duration} mín samhliða
              {longer > 0 ? `. Fundurinn lengist um ${longer} mín.` : "."}
            </span>
          </span>
        </label>
        <label className={styles.choice}>
          <input
            type="radio"
            name={name}
            checked={mode === "one"}
            onChange={() => setMode("one")}
          />
          <span>
            <span className={styles.choiceTitle}>Halda einni dagskrá</span>
            <span className={styles.choiceHelp}>
              Allir gera það sem einn flokkur var með. Hitt fellur út.
            </span>
          </span>
        </label>
        {mode === "one" && (
          <div className={styles.pick}>
            <label htmlFor={selectId}>Flokkur</label>
            <select id={selectId} value={laneId} onChange={(e) => setLaneId(e.target.value)}>
              {model.lanes.map((lane) => (
                <option key={lane.patrolId} value={lane.patrolId}>
                  {lane.name} ({lane.used} mín)
                </option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      {mode === "all" ? (
        <div className={styles.preview}>
          <h5 className={styles.previewTitle}>Röðin eftir sameiningu</h5>
          <ol className={styles.previewList}>
            {plan.all.map((entry, i) => (
              <li key={`${entry.item.id}-${i}`}>
                <span className={styles.previewName}>{entry.item.name}</span>
                <span className={styles.num}>{entry.item.minutes} mín</span>
                <span className={styles.holders}>{holders(entry.patrolIds)}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className={styles.preview}>
          <h5 className={styles.previewTitle}>
            Fellur út: {countIs(dropped.length, "liður", "liðir")}
            {droppedMinutes ? ` · ${droppedMinutes} mín` : ""}
          </h5>
          {dropped.length === 0 ? (
            <p className={styles.choiceHelp}>Ekkert. Hinir flokkarnir eru með sömu liði.</p>
          ) : (
            <ul className={`${styles.previewList} ${styles.dropped}`}>
              {dropped.map((entry, i) => (
                <li key={`${entry.item.id}-${i}`}>
                  <span className={styles.previewName}>{entry.item.name}</span>
                  <span className={styles.num}>{entry.item.minutes} mín</span>
                  <span className={styles.holders}>{holders(entry.patrolIds)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={styles.mergeActions}>
        <button type="button" className={styles.quiet} onClick={onCancel}>
          Hætta við
        </button>
        {mode === "one" && dropped.length > 0 ? (
          <button
            type="button"
            className={styles.danger}
            onClick={() => onConfirm(keptLane.patrolId)}
          >
            Sameina og sleppa {countIs(dropped.length, "lið", "liðum")}
          </button>
        ) : (
          <button
            type="button"
            className={styles.primary}
            onClick={() => onConfirm(mode === "all" ? "all" : keptLane.patrolId)}
          >
            Sameina
          </button>
        )}
      </div>
    </section>
  );
}

/** The band after a merge: one list, with Afturkalla while it lasts. */
function MergedBand({
  fundur,
  band,
  undo,
  onUndo,
  onSplit,
}: {
  fundur: Fundur;
  band: BandId;
  undo: { text: string } | null;
  onUndo: () => void;
  onSplit: () => void;
}) {
  const items = fundur.items.filter((item) => BAND_OF[item.kind] === band);
  const minutes = items.reduce((sum, item) => sum + item.minutes, 0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h3 ref={headingRef} tabIndex={-1} className={styles.title}>
            {BANDS.find((b) => b.id === band)?.label ?? band}
          </h3>
          <p className={styles.meta}>
            <span>Ein röð fyrir alla</span>
            <span className={styles.num}>{minutes} mín</span>
          </p>
        </div>
        <button type="button" className={styles.quiet} onClick={onSplit}>
          Skipta á flokka
        </button>
      </div>
      {undo && (
        <div className={styles.undo}>
          <span>{undo.text}</span>
          <button type="button" className={styles.quiet} onClick={onUndo}>
            Afturkalla
          </button>
        </div>
      )}
      <ol className={styles.mergedList}>
        {items.map((item) => (
          <li key={item.id}>
            <span className={styles.previewName}>{item.name}</span>
            <span className={styles.num}>{item.minutes} mín</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
