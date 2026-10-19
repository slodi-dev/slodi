"use client";

import { createContext, useContext, useMemo, useReducer, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { BAND_OF, type PlanBenchData } from "@/services/plan.service";
import { benchReducer, initialBenchState, type BenchIntent, type BenchState } from "./benchState";
import { benchCollision, blockAsLidur, readDrag, readDrop, type DragPayload } from "./dnd";
import styles from "./bench.module.css";

/**
 * sc-161 `AssemblyProvider` — one state, every path.
 *
 * The bench and the block rail are siblings in the layout but they change the
 * same thing: "Bæta við" in the rail and ▲/▼ in a row are both edits to one
 * fundur. Holding that state above both is what lets the rail add a block
 * without the two components reaching into each other.
 *
 * ## The drag context lives here too
 *
 * For the same reason, and it is not a stylistic choice: a `DndContext` mounted
 * inside the bench leaves the entire dagskrárbankinn outside it, so dragging a
 * block from the bank onto a sheet does nothing at all — no error, no ghost,
 * nothing. This is the only component that wraps both.
 *
 * dnd-kit owns no state of its own here. It is a pointer and touch *input* to
 * the same reducer the buttons and the keyboard dispatch into, which is exactly
 * the layering SPEC §5 step 3 asks for. See dnd.ts for the vocabulary, and for
 * why there is no KeyboardSensor.
 */

type BenchContextValue = {
  state: BenchState;
  dispatch: (intent: BenchIntent) => void;
};

const BenchContext = createContext<BenchContextValue | null>(null);

export function BenchProvider({ data, children }: { data: PlanBenchData; children: ReactNode }) {
  const [state, dispatch] = useReducer(benchReducer, data, initialBenchState);
  const [dragging, setDragging] = useState<DragPayload | null>(null);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  /**
   * Pointer and touch, deliberately not keyboard.
   *
   * The distance constraint is what keeps every button inside a row clickable —
   * without it a press that drifts three pixels becomes a drag and the click
   * never lands. The touch delay does the same job for a thumb, and touch is
   * the whole reason for adopting a library: HTML5 drag events never fire on
   * touch at all, so a leader planning on their phone had no drag path.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  );

  const onDragStart = (event: DragStartEvent) => setDragging(readDrag(event.active));

  /**
   * Every drop becomes an intent, or nothing happens.
   *
   * Pairs that are not listed here are ignored — a bench row dropped on a lane,
   * a lane block dropped on a band. Silence is the right answer: the reducer
   * would have to invent a meaning for the move, and the leader gets their
   * block back where it was rather than somewhere surprising.
   */
  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const drag = readDrag(event.active);
    const drop = readDrop(event.over);
    if (!drag || !drop) return;

    const fundurOf = (id: string) => state.data.fundir.find((f) => f.event_id === id);

    /** Where a drop on `row` sits in the fundur's own list. */
    const indexOfRow = (fundurId: string, lidurId: string): number =>
      fundurOf(fundurId)?.items.findIndex((item) => item.id === lidurId) ?? -1;

    if (drag.kind === "row" && drop.kind === "row") {
      const fundur = fundurOf(drag.fundurId);
      if (!fundur || drop.fundurId !== drag.fundurId) return;

      // Sortable reports position as "the row you are over". Translate that
      // into an index in the fundur's own list, which is what `move` takes.
      const band = BAND_OF[drag.lidur.kind];
      const inBand = fundur.items.filter((item) => BAND_OF[item.kind] === band);
      const from = inBand.findIndex((item) => item.id === drag.lidur.id);
      const to = inBand.findIndex((item) => item.id === drop.lidur.id);
      if (from < 0 || to < 0 || from === to) return;

      const reordered = arrayMove(inBand, from, to);
      dispatch({
        t: "move",
        fundurId: drag.fundurId,
        id: drag.lidur.id,
        to: fundur.items.indexOf(inBand[0]) + reordered.indexOf(drag.lidur),
      });
      return;
    }

    if (drag.kind === "library") {
      // Dropped on a row: land it *there*, not at the end of the band. The
      // whole reason to drag rather than press "Bæta við" is to say where —
      // and rows fill a band, so this is where a drop almost always resolves.
      if (drop.kind === "row") {
        const lidur = blockAsLidur(drag.block, fundurOf(drop.fundurId)?.theme ?? null);

        /*
         * Only honour the position when the row is in the block's own band.
         *
         * Every band's rows are droppables in one context, so a leikur can be
         * released over a Setning row. Splicing there would put a kjarni item
         * inside the opnun run — the exact interleaving `inBandOrder` exists to
         * prevent — and `move` would then announce reorders that change
         * nothing on screen. Falling back to the end of its own band still
         * accepts the block, which is friendlier than refusing the drop.
         */
        const sameBand = BAND_OF[drop.lidur.kind] === BAND_OF[lidur.kind];
        const rowIndex = indexOfRow(drop.fundurId, drop.lidur.id);

        /*
         * Before or after, decided by which half of the row it was released
         * over. Without this there is no way to drop at the *end* of a band at
         * all: every row drop splices before its row, so the last position is
         * unreachable by drag while the button can only ever append.
         */
        const overRect = event.over?.rect;
        const activeRect = event.active.rect.current.translated;
        const after =
          overRect && activeRect
            ? activeRect.top + activeRect.height / 2 > overRect.top + overRect.height / 2
            : false;

        dispatch({
          t: "add",
          fundurId: drop.fundurId,
          lidur,
          at: sameBand && rowIndex >= 0 ? rowIndex + (after ? 1 : 0) : undefined,
        });
        return;
      }
      if (drop.kind === "band") {
        dispatch({
          t: "add",
          fundurId: drop.fundurId,
          lidur: blockAsLidur(drag.block, fundurOf(drop.fundurId)?.theme ?? null),
        });
        return;
      }
      if (drop.kind === "lane") {
        dispatch({
          t: "laneAdd",
          fundurId: drop.fundurId,
          band: drop.band,
          laneIndex: drop.laneIndex,
          lidur: blockAsLidur(drag.block, fundurOf(drop.fundurId)?.theme ?? null),
        });
      }
      return;
    }

    if (drag.kind === "lane" && drop.kind === "lane") {
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
    }
  };

  return (
    <BenchContext.Provider value={value}>
      <DndContext
        sensors={sensors}
        collisionDetection={benchCollision}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
        // dnd-kit narrates drags itself. Suppressed, because the reducer already
        // announces every change that lands (sc-158) and two voices describing
        // one move is worse than one.
        accessibility={{
          announcements: {
            onDragStart: () => undefined,
            onDragOver: () => undefined,
            onDragEnd: () => undefined,
            onDragCancel: () => undefined,
          },
          screenReaderInstructions: {
            draggable: "Notaðu lyklaborðið til að færa lið: bil grípur, upp og niður færa.",
          },
        }}
      >
        {children}

        {/*
         * sc-143 DragOverlay / BlockGhost.
         *
         * Not a copy of the row: at the size of a 45-minute block that would be
         * a slab covering half the sheet, and the only things worth reading
         * mid-drag are what you are holding and how long it is. Tilted a couple
         * of degrees so it reads as picked up rather than as another row.
         */}
        <DragOverlay dropAnimation={null}>
          {dragging ? (
            <div className={styles.ghost} data-copy={dragging.kind === "library" || undefined}>
              <span className={styles.ghostTitle}>
                {dragging.kind === "library" ? dragging.block.name : dragging.lidur.name}
              </span>
              <span className={styles.ghostMeta}>
                {dragging.kind === "library" ? dragging.block.minutes : dragging.lidur.minutes} mín
                {dragging.kind === "library" ? " · afrit úr bankanum" : ""}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </BenchContext.Provider>
  );
}

/**
 * Null outside a provider rather than throwing.
 *
 * The rail renders even when no season is loaded and there is nothing to add to
 * — it is still worth reading the bank. Throwing would make "no fundur yet" an
 * error instead of a state, and the rail already has a disabled-add path for it.
 */
export function useBench(): BenchContextValue | null {
  return useContext(BenchContext);
}
