/**
 * The bench state for the SplitGrid lab.
 *
 * Every move still goes through the real `benchReducer`, so a lab direction can't drift from
 * what the app does: ← →, the "Færa til" buttons and a drop all dispatch `laneMoveAcross`, and
 * the reducer writes the announcement. The lab adds only what the merge proposal needs and the
 * reducer doesn't have yet: `labMerge` (keep everything, or one flokkur's plan) and
 * `labRestore` (Afturkalla, after a merge or a removed card). Card edits are the reducer's own
 * `lanePatch`.
 *
 * The provider is a small copy of `BenchProvider` (same sensors, same collision rule, same
 * `dragId` vocabulary), because `BenchProvider` owns its reducer and the lab needs to extend it.
 */
import { createContext, useContext, useMemo, useReducer, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  bandMinutes,
  bandOffset,
  benchReducer,
  clockAt,
  initialBenchState,
  type BenchIntent,
  type BenchState,
} from "@/components/plan/bench/benchState";
import { benchCollision, readDrag, readDrop, type DragPayload } from "@/components/plan/bench/dnd";
import { PATROL_ACCENTS } from "@/components/plan/planEntries";
import { countIs } from "@/lib/format";
import {
  BANDS,
  BAND_OF,
  type BandId,
  type Fundur,
  type Lidur,
  type Patrol,
  type PatrolAccent,
  type PlanBenchData,
} from "@/services/plan.service";
import benchStyles from "@/components/plan/bench/bench.module.css";

/* ── Merge ─────────────────────────────────────────────────────────────────── */

/** "all": every distinct liður once, in sequence. Otherwise the patrol id whose plan is kept. */
export type MergeKeep = "all" | string;

export type LabIntent =
  | BenchIntent
  | { t: "labMerge"; fundurId: string; band: BandId; keep: MergeKeep }
  | { t: "labRestore"; fundur: Fundur; text?: string };

/** Two liðir are "the same" when a leader would call them the same: name, kind and length. */
const keyOf = (item: Lidur) => `${item.kind}|${item.name}|${item.minutes}`;

function counts(items: Lidur[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) map.set(keyOf(item), (map.get(keyOf(item)) ?? 0) + 1);
  return map;
}

export type MergeEntry = { item: Lidur; patrolIds: string[] };

export type MergePlan = {
  /** True when every lane holds the same liðir: merging loses nothing and needs no question. */
  identical: boolean;
  /** Keep everything: the first lane's order, then whatever other lanes had on top of it. */
  all: MergeEntry[];
  /** Keep one flokkur's plan: what is dropped from the others, per kept patrol id. */
  droppedIfKeep: Record<string, MergeEntry[]>;
};

export function planMerge(lanes: { patrol_id: string; items: Lidur[] }[]): MergePlan {
  const laneCounts = lanes.map((lane) => counts(lane.items));
  /** The lanes that have this liður at least `nth` times: a second copy is only theirs. */
  const holders = (item: Lidur, nth: number) =>
    lanes
      .filter((_, i) => (laneCounts[i].get(keyOf(item)) ?? 0) >= nth)
      .map((lane) => lane.patrol_id);

  const all: MergeEntry[] = [];
  const taken = new Map<string, number>();
  lanes.forEach((lane, i) => {
    for (const item of lane.items) {
      const key = keyOf(item);
      if ((taken.get(key) ?? 0) < (laneCounts[i].get(key) ?? 0)) {
        const nth = (taken.get(key) ?? 0) + 1;
        taken.set(key, nth);
        all.push({ item, patrolIds: holders(item, nth) });
      }
    }
  });

  const droppedIfKeep: Record<string, MergeEntry[]> = {};
  lanes.forEach((kept, k) => {
    const left = new Map(laneCounts[k]);
    droppedIfKeep[kept.patrol_id] = all.filter(({ item }) => {
      const key = keyOf(item);
      const n = left.get(key) ?? 0;
      if (n > 0) {
        left.set(key, n - 1);
        return false;
      }
      return true;
    });
  });

  const first = laneCounts[0];
  const identical = laneCounts.every(
    (c) => c.size === first.size && [...c].every(([key, n]) => first.get(key) === n)
  );

  return { identical, all, droppedIfKeep };
}

let idCounter = 0;

function labReducer(state: BenchState, intent: LabIntent): BenchState {
  if (intent.t === "labRestore") {
    return {
      ...state,
      data: {
        ...state.data,
        fundir: state.data.fundir.map((f) =>
          f.event_id === intent.fundur.event_id ? intent.fundur : f
        ),
      },
      laneSelected: null,
      announcement: {
        text: intent.text ?? "Sameining afturkölluð. Flokkarnir hafa aftur hver sína dagskrá.",
        seq: state.announcement.seq + 1,
      },
    };
  }

  if (intent.t === "labMerge") {
    const fundur = state.data.fundir.find((f) => f.event_id === intent.fundurId);
    const lanes = fundur?.split?.[intent.band];
    if (!fundur || !lanes) return state;

    const plan = planMerge(lanes);
    const keptLane = lanes.find((lane) => lane.patrol_id === intent.keep);
    const kept = keptLane ? keptLane.items : plan.all.map((entry) => entry.item);
    const dropped = keptLane ? plan.droppedIfKeep[keptLane.patrol_id].length : 0;
    const restored = kept.map((item) => {
      idCounter += 1;
      return { ...item, id: `lab-merged-${idCounter}` };
    });
    const label = BANDS.find((b) => b.id === intent.band)?.label ?? intent.band;

    return {
      ...state,
      data: {
        ...state.data,
        fundir: state.data.fundir.map((f) => {
          if (f.event_id !== intent.fundurId) return f;
          const split = { ...f.split };
          delete split[intent.band];
          const items = BANDS.flatMap((band) =>
            band.id === intent.band
              ? restored
              : f.items.filter((item) => BAND_OF[item.kind] === band.id)
          );
          return { ...f, items, split };
        }),
      },
      laneSelected: null,
      announcement: {
        text: `Sameinað í eina röð: ${label}. Liðir sem halda: ${restored.length}.${
          dropped ? ` Liðir sem falla út: ${dropped}.` : ""
        }`,
        seq: state.announcement.seq + 1,
      },
    };
  }

  return benchReducer(state, intent);
}

/* ── Provider ──────────────────────────────────────────────────────────────── */

type LabBenchValue = { state: BenchState; dispatch: (intent: LabIntent) => void };

const LabBenchContext = createContext<LabBenchValue | null>(null);

export function useLabBench(): LabBenchValue {
  const value = useContext(LabBenchContext);
  if (!value) throw new Error("useLabBench outside LabBench");
  return value;
}

export function LabBench({ data, children }: { data: PlanBenchData; children: ReactNode }) {
  const [state, dispatch] = useReducer(labReducer, data, initialBenchState);
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const value = useMemo(() => ({ state, dispatch }), [state]);

  // The same constraints as BenchProvider: a press that drifts 5px is still a click, and a
  // thumb has to hold for 200ms before the sheet stops scrolling and the drag starts.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  );

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const drag = readDrag(event.active);
    const drop = readDrop(event.over);
    if (drag?.kind !== "lane" || drop?.kind !== "lane") return;
    if (drop.fundurId !== drag.fundurId || drop.band !== drag.band) return;
    if (drop.laneIndex === drag.laneIndex) return;
    dispatch({
      t: "laneMoveAcross",
      fundurId: drag.fundurId,
      band: drag.band,
      fromLane: drag.laneIndex,
      toLane: drop.laneIndex,
      id: drag.lidur.id,
    });
    // A dropped card lands closed: in the lab, a selected card is an open editor.
    dispatch({ t: "laneSelect", id: null });
  };

  const announcement = state.announcement;

  return (
    <LabBenchContext.Provider value={value}>
      <DndContext
        sensors={sensors}
        collisionDetection={benchCollision}
        onDragStart={(event) => setDragging(readDrag(event.active))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
        // The reducer announces every move that lands; dnd-kit's own narration would be a
        // second voice describing the same move.
        accessibility={{
          announcements: {
            onDragStart: () => undefined,
            onDragOver: () => undefined,
            onDragEnd: () => undefined,
            onDragCancel: () => undefined,
          },
          screenReaderInstructions: {
            draggable: "Vinstri og hægri ör færa lið í fyrri eða næsta flokk.",
          },
        }}
      >
        {/* Two alternating regions, as PlanBench renders them, so a repeat still announces. */}
        <p aria-live="polite" className={benchStyles.srOnly}>
          {announcement.seq % 2 === 0 ? announcement.text : ""}
        </p>
        <p aria-live="polite" className={benchStyles.srOnly}>
          {announcement.seq % 2 === 1 ? announcement.text : ""}
        </p>
        {children}
        <DragOverlay dropAnimation={null}>
          {dragging?.kind === "lane" ? (
            <div className={benchStyles.ghost}>
              <span className={benchStyles.ghostTitle}>{dragging.lidur.name}</span>
              <span className={benchStyles.ghostMeta}>{dragging.lidur.minutes} mín</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </LabBenchContext.Provider>
  );
}

/* ── The split band, as every direction reads it ───────────────────────────── */

export type LaneItem = {
  item: Lidur;
  /** Position in its lane. */
  index: number;
  /** Minutes from the start of the band. */
  start: number;
  /** `HH:MM`, or null on an undated fundur. */
  clock: string | null;
  clockEnd: string | null;
};

export type LaneModel = {
  laneIndex: number;
  patrolId: string;
  name: string;
  accent: PatrolAccent;
  items: LaneItem[];
  used: number;
  /** Minutes this flokkur waits at the end, because another lane is longer. */
  idle: number;
  /** One of the lanes that set the band's length. */
  longest: boolean;
};

export type SplitModel = {
  fundur: Fundur;
  band: BandId;
  label: string;
  duration: number;
  offset: number;
  /** `HH:MM` of the band's start and end, or null when undated. */
  from: string | null;
  to: string | null;
  lanes: LaneModel[];
  balanced: boolean;
};

/**
 * The patrol colour a lane uses. Through the lane's own `patrol_id`, never its position, so a
 * label can't name the wrong flokkur (see SplitGrid.tsx).
 */
function accentOf(patrols: Patrol[], patrolId: string, laneIndex: number): PatrolAccent {
  const at = patrols.findIndex((patrol) => patrol.id === patrolId);
  const patrol = at >= 0 ? patrols[at] : undefined;
  return patrol?.accent ?? PATROL_ACCENTS[(at >= 0 ? at : laneIndex) % PATROL_ACCENTS.length];
}

export function splitModel(fundur: Fundur, band: BandId, patrols: Patrol[]): SplitModel | null {
  const lanes = fundur.split?.[band];
  if (!lanes || lanes.length === 0) return null;
  const duration = bandMinutes(fundur, band);
  const offset = bandOffset(fundur, band);

  const laneModels: LaneModel[] = lanes.map((lane, laneIndex) => {
    let running = 0;
    const items = lane.items.map((item, index) => {
      const start = running;
      running += item.minutes;
      return {
        item,
        index,
        start,
        clock: clockAt(fundur, offset + start),
        clockEnd: clockAt(fundur, offset + running),
      };
    });
    return {
      laneIndex,
      patrolId: lane.patrol_id,
      name: patrols.find((patrol) => patrol.id === lane.patrol_id)?.name ?? lane.patrol_id,
      accent: accentOf(patrols, lane.patrol_id, laneIndex),
      items,
      used: running,
      idle: duration - running,
      longest: running === duration && duration > 0,
    };
  });

  return {
    fundur,
    band,
    label: BANDS.find((b) => b.id === band)?.label ?? band,
    duration,
    offset,
    from: clockAt(fundur, offset),
    to: clockAt(fundur, offset + duration),
    lanes: laneModels,
    balanced: laneModels.every((lane) => lane.idle === 0),
  };
}

/** A minute offset as the reader sees it: the clock when dated, "+15 mín" when not. */
export function at(model: SplitModel, minutes: number): string {
  return clockAt(model.fundur, model.offset + minutes) ?? `+${minutes} mín`;
}

/** "Refir ráða lengdinni (70 mín). Bið: Ernir 25 mín · Uglur 5 mín." */
export function balanceSentence(model: SplitModel): string {
  if (model.duration === 0) return "Enginn liður enn.";
  if (model.balanced) {
    return `Jafnt: ${countIs(model.lanes.length, "flokkur", "flokkar")}, allir ${model.duration} mín.`;
  }
  const longest = model.lanes.filter((lane) => lane.longest).map((lane) => lane.name);
  const waiting = model.lanes
    .filter((lane) => lane.idle > 0)
    .map((lane) => `${lane.name} ${lane.idle} mín`)
    .join(" · ");
  return `Lengsti flokkur ræður: ${longest.join(", ")} (${model.duration} mín). Bið: ${waiting}.`;
}
