import {
  pointerWithin,
  rectIntersection,
  type Active,
  type CollisionDetection,
  type Over,
} from "@dnd-kit/core";
import { BAND_OF, type BandId, type Lidur } from "@/services/plan.service";
import type { LibraryBlock } from "@/lib/mock/library.mock";

/**
 * What can be dragged on the bench, and what it can be dropped on.
 *
 * ## Why this file exists
 *
 * dnd-kit identifies everything by a flat id, so without a vocabulary the drop
 * handler becomes string parsing. Every draggable and droppable instead carries
 * a typed `data.current`, and `readDrag` / `readDrop` are the only places that
 * narrow it. A drop that does not match a known pair is simply ignored, which
 * is what makes "you cannot drag a liður out of its band" enforceable rather
 * than merely discouraged.
 *
 * ## One drag system
 *
 * The split grid used the browser's own HTML5 drag before this. It does not
 * matter how well that worked — two drag systems in one surface is a bug
 * waiting for the first leader who drags a row into a lane. Everything routes
 * through dnd-kit now, and native `draggable` is gone.
 *
 * ## No KeyboardSensor
 *
 * dnd-kit ships one, and it binds Space on the draggable — which is what the
 * bench's own grab already uses (benchState.ts). Two keyboard systems fighting
 * over one key is worse than either. The reducer's path stays the keyboard
 * path; dnd-kit is the pointer and touch path, and both dispatch the same
 * intents. That is exactly the layering SPEC §5 step 3 asks for.
 */

export type DragPayload =
  /** A liður being reordered inside its band on a sheet. */
  | { kind: "row"; fundurId: string; lidur: Lidur }
  /** A block being pulled out of the dagskrárbankinn. */
  | { kind: "library"; block: LibraryBlock }
  /** A verkefni inside a split band's lane. */
  | {
      kind: "lane";
      fundurId: string;
      band: BandId;
      laneIndex: number;
      lidur: Lidur;
    };

export type DropPayload =
  /** A whole band on a sheet — where a library block lands. */
  | { kind: "band"; fundurId: string; band: BandId }
  /** One flokkur's column in a split band. */
  | { kind: "lane"; fundurId: string; band: BandId; laneIndex: number }
  /**
   * Another row, which is how sortable reports position.
   *
   * Deliberately the same shape as the `row` drag payload: `useSortable`
   * registers one `data` object for both the draggable and the droppable, so a
   * separate drop shape here would describe something that never arrives — and
   * the handler would read `undefined` off it and bail without a word.
   */
  | { kind: "row"; fundurId: string; lidur: Lidur };

/** Stable ids. Prefixed so a row and the lane it sits in can never collide. */
export const dragId = {
  row: (lidurId: string) => `row:${lidurId}`,
  library: (blockId: string) => `lib:${blockId}`,
  lane: (lidurId: string) => `lane-item:${lidurId}`,
  bandDrop: (fundurId: string, band: BandId) => `band:${fundurId}:${band}`,
  laneDrop: (fundurId: string, band: BandId, laneIndex: number) =>
    `lane:${fundurId}:${band}:${laneIndex}`,
};

export function readDrag(active: Active | null): DragPayload | null {
  const data = active?.data.current;
  if (!data || typeof data !== "object" || !("kind" in data)) return null;
  const kind = (data as { kind: unknown }).kind;
  if (kind === "row" || kind === "library" || kind === "lane") return data as DragPayload;
  return null;
}

export function readDrop(over: Over | null): DropPayload | null {
  const data = over?.data.current;
  if (!data || typeof data !== "object" || !("kind" in data)) return null;
  const kind = (data as { kind: unknown }).kind;
  if (kind === "band" || kind === "lane" || kind === "row") return data as DropPayload;
  return null;
}

/** A library block, as the liður it becomes once placed. */
export function blockAsLidur(block: LibraryBlock, theme: string | null): Omit<Lidur, "id"> {
  return {
    name: block.name,
    kind: block.kind,
    minutes: block.minutes,
    // A block arriving from the bank is a draft until the leader has looked at
    // it — never silently confirmed.
    status: "draft",
    // B3: a reused block brings its context with it.
    theme: block.theme || theme,
    venue: null,
    endurmat: null,
  };
}

/**
 * Whatever the pointer is actually inside — and nothing if it is inside nothing.
 *
 * `closestCenter` compares centres, which is wrong for this surface twice over:
 * a tall band's centre is nearer the pointer than any row inside it, and lane
 * blocks are absolutely positioned, so their centres say little about where the
 * pointer is.
 *
 * It is also wrong as a *fallback*. `closestCenter` has no distance cap, so it
 * always returns something — which means `over` was never null and there was no
 * way to cancel a drag by releasing it somewhere harmless. A leader who pulled
 * a block out of the bank, thought better of it and let go over the rail had it
 * silently added to whichever fundur happened to be nearest by centre. Release-
 * outside-to-cancel is the standard gesture; returning nothing restores it.
 *
 * ## A drag only collides with things it could actually land on
 *
 * A row is a droppable in every band, but a liður cannot leave its band — so
 * without this filter the source band previews a reorder that `onDragEnd` then
 * refuses: rows slide down to make room, the drop is ignored, and everything
 * snaps back. Filtering the candidates keeps the preview honest.
 */
export const benchCollision: CollisionDetection = (args) => {
  const drag = readDrag(args.active);

  const allowed = (id: string | number): boolean => {
    if (!drag) return true;
    const data = args.droppableContainers.find((c) => c.id === id)?.data.current;
    const drop = data && "kind" in data ? (data as DropPayload) : null;
    if (!drop) return false;

    if (drag.kind === "row") {
      // Same fundur, same band. Anywhere else is not a move, it is a change of
      // kind — a different intent entirely.
      return (
        drop.kind === "row" &&
        drop.fundurId === drag.fundurId &&
        BAND_OF[drop.lidur.kind] === BAND_OF[drag.lidur.kind]
      );
    }
    if (drag.kind === "lane") {
      return drop.kind === "lane" && drop.fundurId === drag.fundurId && drop.band === drag.band;
    }
    // A block from the bank can go anywhere a liður can live.
    return true;
  };

  const within = pointerWithin(args).filter((c) => allowed(c.id));
  if (within.length > 0) return within;

  return rectIntersection(args).filter((c) => allowed(c.id));
};
