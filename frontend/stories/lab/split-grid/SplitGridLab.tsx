import {
  useEffect,
  useId,
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
  STATUS_LABEL,
  type BandId,
  type Fundur,
  type Lidur,
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
 * Style variations of the current SplitGrid. The form stays: a time axis down the side, one
 * column per flokkur, liðir stacked in each column as tall as they are long, the free tail as
 * "N mín bið", the hint, the summary line and "Sameina í eitt". Only the look changes.
 *
 * - `ren`: S1 · Clean. The patrol colour as a full header band; liðir as plain ruled rows.
 * - `stimplar`: S2 · Stamped. The Dagatal's D4 Stimplar language: ink-stamped column labels,
 *   and each liður's status as a small rubber stamp.
 * - `veifur`: S3 · Patrol flags. Each column under its flokkur's swallowtail pennant, with the
 *   lane total as a tally.
 * - `blad`: S4 · Paper. A printed sheet: ruled lines, typewriter times, ink on paper.
 */
export type SplitGridLook = "ren" | "stimplar" | "veifur" | "blad";

export interface SplitGridLabProps {
  /** Which style variation to render. */
  look: SplitGridLook;
  data: PlanBenchData;
  fundurId?: string;
  band?: BandId;
  /** Open the merge confirmation straight away. */
  defaultMergeOpen?: boolean;
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
  look: SplitGridLook;
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
}: Omit<SplitGridLabProps, "data">) {
  const { state, dispatch } = useLabBench();
  const fundur = state.data.fundir.find((f) => f.event_id === fundurId);
  const model = fundur ? splitModel(fundur, band, state.data.patrols) : null;
  const selected = state.laneSelected;

  const rootRef = useRef<HTMLDivElement>(null);
  const mergeButtonRef = useRef<HTMLButtonElement>(null);
  const hintId = useId();
  const mergeId = useId();
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
  }, [state.data]);

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
    look,
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
    <div ref={rootRef} className={styles.root} data-style={look}>
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

      <Columns ctx={ctx} />

      {picked && <MoveStrip ctx={ctx} lane={picked.lane} li={picked.li} />}

      <div className={styles.foot}>
        <p id={hintId} className={styles.hint}>
          ← → færa milli flokka · ↑ ↓ breyta röð · eða dragðu á annan flokk
        </p>
        <p className={styles.summary} data-balanced={model.balanced || undefined}>
          Ristin er {model.duration} mín
          {model.from ? ` — frá ${model.from} til ${model.to}` : ""}. {balanceSentence(model)}
        </p>
      </div>
    </div>
  );
}

/* ── Shared pieces ─────────────────────────────────────────────────────────── */

function itemLabel(lane: LaneModel, li: LaneItem): string {
  const when = li.clock ? `kl. ${li.clock}` : `${li.index + 1}. liður`;
  return `${lane.name} ${when}: ${li.item.name}, ${li.item.minutes} mín, ${STATUS_LABEL[li.item.status].toLowerCase()}`;
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

/* ── The current form ──────────────────────────────────────────────────────── */

/** The status word on S2's stamp. Óákveðið is an empty box with a "?". */
const STAMP_WORD: Record<Lidur["status"], string> = {
  confirmed: "Klárt",
  draft: "Drög",
  tentative: "Óvíst",
  unknown: "?",
};

/** The same small tilt for a liður on every render: −4° … +3°. */
function tiltOf(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return (hash % 8) - 4;
}

/**
 * Time down the side and one column per flokkur, as SplitGrid has it. Heights are exact
 * (`--ppm` per minute), so the columns stay level with the axis and with each other. On a phone
 * the columns scroll sideways with snap, two at a time, and the axis stays pinned.
 */
function Columns({ ctx }: { ctx: Ctx }) {
  const { model } = ctx;
  const span = Math.max(model.duration, 15);
  const ticks: number[] = [];
  for (let m = 0; m <= span; m += 15) ticks.push(m);

  return (
    <div className={styles.columnsWrap}>
      {model.lanes.length > 2 && (
        <p className={styles.swipe}>
          Strjúktu til hliðar til að sjá alla {countIs(model.lanes.length, "flokk", "flokka")}.
        </p>
      )}
      <div className={styles.scroller}>
        <div
          className={styles.grid}
          style={{ ["--n" as string]: model.lanes.length, ["--span" as string]: span }}
        >
          <div className={styles.axisHead} aria-hidden="true">
            kl.
          </div>
          {model.lanes.map((lane) => (
            <LaneHead key={lane.patrolId} ctx={ctx} lane={lane} />
          ))}
          <div className={styles.axis} aria-hidden="true">
            {ticks.map((m) => (
              <span key={m} className={styles.tick} style={{ top: `calc(var(--ppm) * ${m})` }}>
                {at(model, m)}
              </span>
            ))}
          </div>
          {model.lanes.map((lane) => (
            <LaneColumn key={lane.patrolId} ctx={ctx} lane={lane} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LaneHead({ ctx, lane }: { ctx: Ctx; lane: LaneModel }) {
  const { model, look } = ctx;
  const tilt = look === "stimplar" ? (lane.laneIndex % 2 ? 1.5 : -1.5) : 0;
  return (
    <div className={styles.laneHead} style={laneVars(lane.accent)}>
      <span className={styles.laneName} style={{ ["--tilt" as string]: `${tilt}deg` }}>
        {lane.name}
      </span>
      <span className={styles.laneNums}>
        <LaneTotal lane={lane} />
        <LaneState lane={lane} model={model} />
      </span>
      {look === "veifur" && <Tally minutes={lane.used} />}
    </div>
  );
}

/** One mark per 5 minutes, struck through in fives, like a tally on a patrol's notebook. */
function Tally({ minutes }: { minutes: number }) {
  const marks = Math.round(minutes / 5);
  const groups = Array.from({ length: Math.ceil(marks / 5) }, (_, g) => Math.min(5, marks - g * 5));
  return (
    <span className={styles.tally} aria-hidden="true">
      {groups.map((n, g) => (
        <span key={g} className={styles.tallyGroup} data-full={n === 5 || undefined}>
          {Array.from({ length: Math.min(n, 4) }, (_, i) => (
            <span key={i} className={styles.tallyMark} />
          ))}
        </span>
      ))}
    </span>
  );
}

function LaneColumn({ ctx, lane }: { ctx: Ctx; lane: LaneModel }) {
  const { model, look } = ctx;
  const { setNodeRef, over } = useLaneDrop(model, lane.laneIndex);
  const span = Math.max(model.duration, 15);
  const rest = span - lane.used;

  return (
    <div
      ref={setNodeRef}
      className={styles.lane}
      data-over={over || undefined}
      style={laneVars(lane.accent)}
    >
      {lane.items.map((li) => (
        <DragItem
          key={li.item.id}
          ctx={ctx}
          lane={lane}
          li={li}
          className={styles.item}
          style={{ height: `calc(var(--ppm) * ${li.item.minutes})` }}
        >
          <span className={styles.itemTop} data-tight={li.item.minutes < 15 || undefined}>
            <span className={styles.itemTime}>{li.clock ?? `+${li.start}`}</span>
            <span className={styles.itemMin}>{li.item.minutes} mín</span>
          </span>
          <span className={styles.itemTitle} data-tight={li.item.minutes < 15 || undefined}>
            {li.item.name}
          </span>
          {look === "stimplar" && (
            <span
              className={styles.stamp}
              data-state={li.item.status}
              style={{ ["--tilt" as string]: `${tiltOf(li.item.id)}deg` }}
              aria-hidden="true"
            >
              {STAMP_WORD[li.item.status]}
            </span>
          )}
        </DragItem>
      ))}
      {rest > 0 && (
        <button
          type="button"
          className={styles.gap}
          style={{ height: `calc(var(--ppm) * ${rest})` }}
          aria-label={
            lane.items.length === 0
              ? `Ekkert skráð. Bæta verkefni við hjá ${lane.name}`
              : `${rest} mín bið. Bæta verkefni við hjá ${lane.name}`
          }
          onClick={() => ctx.addTo(lane)}
        >
          {lane.items.length === 0 ? "Ekkert skráð · + Bæta við" : `+ ${rest} mín bið`}
        </button>
      )}
    </div>
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
