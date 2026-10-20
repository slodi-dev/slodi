/**
 * Dragging a card along the timeline and between flokkar.
 *
 * The drop spot is worked out from the pointer and the columns on screen, not from dnd-kit's
 * collision rules: a column is the flokkur, and the cards above the pointer's height say where
 * in the column it lands. While a card is dragged the grid draws the *result* (the card taken
 * out of its column and put in at the spot), so the clock times, the column totals and
 * "Lengsti flokkur ræður" are the ones the drop will give. Dropping then dispatches the
 * reducer's own `laneMove` or `laneMoveAcross` with that position.
 */
import { useEffect, useRef } from "react";
import type { BandId, Fundur } from "@/services/plan.service";

/** The card being dragged, and where it came from. */
export type CardDrag = {
  id: string;
  name: string;
  minutes: number;
  fromLane: number;
  fromIndex: number;
};

/** Where a dragged card would land: a column and a position in it (0 = first). */
export type DropSpot = { lane: number; index: number };

/** How far above or below a column the pointer can be and still aim at it, in px. */
const REACH = 40;

/**
 * The spot under the pointer, or null when it is outside every column (letting go there puts
 * the card back). Columns carry `data-lane-col`, card slots `data-slot-id`.
 */
export function spotAt(root: HTMLElement, x: number, y: number, dragId: string): DropSpot | null {
  for (const column of root.querySelectorAll<HTMLElement>("[data-lane-col]")) {
    const box = column.getBoundingClientRect();
    if (x < box.left || x > box.right || y < box.top - REACH || y > box.bottom + REACH) continue;
    const above = [...column.querySelectorAll<HTMLElement>("[data-slot-id]")].filter((slot) => {
      if (slot.dataset.slotId === dragId) return false;
      const r = slot.getBoundingClientRect();
      return r.top + r.height / 2 < y;
    });
    return { lane: Number(column.dataset.laneCol), index: above.length };
  }
  return null;
}

export function sameSpot(a: DropSpot | null, b: DropSpot | null): boolean {
  return a === b || (!!a && !!b && a.lane === b.lane && a.index === b.index);
}

/** The fundur as it would be after the drop: the card out of its column and in at the spot. */
export function previewFundur(
  fundur: Fundur,
  band: BandId,
  drag: CardDrag,
  spot: DropSpot | null
): Fundur {
  const lanes = fundur.split?.[band];
  const moved = lanes?.[drag.fromLane]?.items.find((item) => item.id === drag.id);
  if (!lanes || !moved || !spot || !lanes[spot.lane]) return fundur;
  const next = lanes.map((lane) => ({
    ...lane,
    items: lane.items.filter((item) => item.id !== drag.id),
  }));
  const target = next[spot.lane].items;
  target.splice(Math.min(spot.index, target.length), 0, moved);
  return { ...fundur, split: { ...fundur.split, [band]: next } };
}

/** Where the pointer or finger is, from the event that started the drag. */
export function pointOf(event: Event | null): { x: number; y: number } | null {
  if (!event) return null;
  if ("touches" in event) {
    const touch = (event as TouchEvent).touches[0] ?? (event as TouchEvent).changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  if ("clientX" in event) {
    const { clientX, clientY } = event as MouseEvent;
    return { x: clientX, y: clientY };
  }
  return null;
}

/**
 * Follows the pointer while `active`: mouse, pen and finger, and a scroll under a still
 * pointer (dnd-kit's auto-scroll at the edges moves the cards, not the pointer).
 */
export function useFollowPointer(
  active: boolean,
  start: { x: number; y: number } | null,
  onPoint: (x: number, y: number) => void,
  /**
   * Where the finger first touched. A touch keeps going to that element even after it leaves
   * the page (the card is redrawn in another flokkur while it is dragged), and then its moves
   * no longer bubble up to the window, so they are also heard on the element itself.
   */
  touchTarget?: EventTarget | null
) {
  const last = useRef(start);
  const callback = useRef(onPoint);
  callback.current = onPoint;

  useEffect(() => {
    if (!active) return;
    last.current = start;
    const at = (point: { x: number; y: number } | null) => {
      if (!point) return;
      last.current = point;
      callback.current(point.x, point.y);
    };
    const move = (event: Event) => at(pointOf(event));
    const scrolled = () => at(last.current);
    const options = { capture: true, passive: true } as const;
    window.addEventListener("pointermove", move, options);
    window.addEventListener("mousemove", move, options);
    window.addEventListener("touchmove", move, options);
    window.addEventListener("scroll", scrolled, options);
    // On the element too, unless it is still on the page (then the window hears it already).
    const target = touchTarget;
    const onTarget = (event: Event) => {
      if (target instanceof Node && !target.isConnected) move(event);
    };
    target?.addEventListener("touchmove", onTarget, options);
    at(start);
    return () => {
      target?.removeEventListener("touchmove", onTarget, options);
      window.removeEventListener("pointermove", move, options);
      window.removeEventListener("mousemove", move, options);
      window.removeEventListener("touchmove", move, options);
      window.removeEventListener("scroll", scrolled, options);
    };
    // `start` is read once per drag; a new drag sets `active` again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
