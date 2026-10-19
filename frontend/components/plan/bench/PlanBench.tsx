"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useBench } from "./BenchProvider";
import { entryDay } from "../planEntries";
import FundurSheet from "./FundurSheet";
import styles from "./bench.module.css";

/**
 * Bekkurinn — the working surface (sc-138 `AssemblyCanvas`).
 *
 * A scroll of fundir in date order with one divider in it: the point where the
 * past ends. That divider is the whole navigational idea of the bench — a
 * leader opens it to work on what is next, not to browse a year, so the thing
 * they came for should be the thing under the fold marker rather than something
 * they have to hunt for.
 *
 * Everything below dispatches into one reducer; see benchState.ts. The drag
 * context lives in BenchProvider rather than here, because the dagskrárbankinn
 * rail is a sibling of this component, not a child — a `DndContext` mounted
 * here would leave the whole bank outside it, and dragging a block onto a sheet
 * would silently do nothing.
 */

interface Props {
  /** Injectable so tests do not depend on the day they run. */
  today?: Date;
}

export default function PlanBench({ today }: Props) {
  const bench = useBench();
  const now = useMemo(() => today ?? new Date(), [today]);

  /**
   * Focus follows a block across a move.
   *
   * React re-renders the list in the new order, and the DOM node that had focus
   * is reused for whatever now sits at that index — so without this, moving a
   * block down leaves focus pointing at its former neighbour and the next arrow
   * press moves the wrong thing. Re-focusing by id is what makes the keyboard
   * path usable at all past the first move.
   */
  const rows = useRef(new Map<string, HTMLDivElement>());
  const registerRow = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) rows.current.set(id, node);
    else rows.current.delete(id);
  }, []);

  /**
   * Move focus to the next or previous row, in screen order.
   *
   * Ordered by the registered nodes' document position rather than by any data
   * structure, because "the row above this one" is a question about what the
   * leader can see — which spans bands and sheets and is not the order of any
   * one list in state.
   */
  const focusSibling = useCallback((id: string, delta: -1 | 1) => {
    // Queried from the DOM rather than from the registry: `querySelectorAll`
    // returns document order for free, which is exactly what "the row above
    // this one" means to the person looking at it — and it spans bands and
    // sheets, which no single list in state does.
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-lidur-row]"));
    const at = nodes.findIndex((node) => node.dataset.lidurRow === id);
    if (at >= 0) nodes[at + delta]?.focus();
  }, []);

  /**
   * Open on today, not on the top of the year.
   *
   * The fold marker is the bench's navigational idea, but rendering it is only
   * half of it: a leader landing at the top of a twenty-week scroll has to hunt
   * for the fundur they came to work on, and the marker they are hunting for is
   * the thing that was supposed to save them the hunt. So the marker is also
   * the scroll anchor — history above, what is coming below.
   *
   * Once per load, not once per render: `anchored` is what stops the view
   * yanking back to today after every reorder and duration nudge.
   *
   * When nothing is ahead the anchor moves to the last sheet, because the most
   * recent fundur is the useful end of an all-past season — the oldest one is
   * the least useful place the scroll could possibly stop.
   */
  const anchor = useRef<HTMLDivElement | null>(null);
  const anchored = useRef(false);

  const grabbed = bench?.state.grabbed ?? null;
  const data = bench?.state.data;
  useEffect(() => {
    if (!grabbed) return;
    rows.current.get(grabbed)?.focus();
  }, [grabbed, data]);

  const ordered = useMemo(() => {
    return [...(data?.fundir ?? [])].sort((a, b) => {
      const dayA = entryDay(a.starts_at);
      const dayB = entryDay(b.starts_at);
      if (!dayA || !dayB) return a.week_index - b.week_index;
      return dayA.getTime() - dayB.getTime();
    });
  }, [data?.fundir]);

  const firstAhead = ordered.findIndex((fundur) => {
    const day = entryDay(fundur.starts_at);
    return day ? day.getTime() >= startOfDay(now).getTime() : false;
  });

  useEffect(() => {
    if (anchored.current || ordered.length === 0) return;
    const node = anchor.current;
    if (!node) return;
    anchored.current = true;
    // Optional call: jsdom has no scrollIntoView, and a test that renders the
    // bench should not fail over where the scrollbar ended up.
    node.scrollIntoView?.({ block: "start", behavior: "auto" });
  }, [ordered.length]);

  if (!bench) return null;
  const { state, dispatch } = bench;

  if (ordered.length === 0) {
    return (
      <p className={styles.empty}>
        Engir fundir á þessu starfsári enn. Búðu til fund til að byrja á bekknum.
      </p>
    );
  }

  return (
    <>
      {/*
       * sc-158 LiveRegionAnnouncer — grab, move, drop and remove all land here.
       *
       * Two regions, alternating, and both always mounted. This looked like one
       * region keyed on `seq`, which announced nothing at all: changing the key
       * remounts the node, and a live region that is *inserted already
       * containing its text* is not read by NVDA, JAWS or VoiceOver — it has to
       * exist first and then change. Alternating also solves the other half,
       * which is what `seq` was for: repeating an identical message only
       * re-announces if the text differs from what that region last held.
       */}
      <p aria-live="polite" className={styles.srOnly} data-bench-announcer>
        {state.announcement.seq % 2 === 0 ? state.announcement.text : ""}
      </p>
      <p aria-live="polite" className={styles.srOnly} data-bench-announcer>
        {state.announcement.seq % 2 === 1 ? state.announcement.text : ""}
      </p>

      <p className={styles.kbar}>
        <b>Bil</b> grípa · <b>↑↓</b> færa · <b>Enter</b> velja · <b>Delete</b> fjarlægja ·{" "}
        <b>Esc</b> hætta við
      </p>

      {ordered.map((fundur, i) => {
        const day = entryDay(fundur.starts_at);
        const isPast = day ? day.getTime() < startOfDay(now).getTime() : false;
        return (
          <div
            key={fundur.event_id}
            className={styles.fold}
            ref={firstAhead === -1 && i === ordered.length - 1 ? anchor : undefined}
          >
            {i === firstAhead && (
              <div
                ref={anchor}
                className={`${styles.daymark} ${isToday(day, now) ? styles.daymarkToday : ""}`}
              >
                <span className={styles.daymarkL}>
                  {isToday(day, now) ? "Í dag" : "Héðan í frá"}
                </span>
              </div>
            )}
            <FundurSheet
              fundur={fundur}
              patrols={state.data.patrols}
              otherFundir={ordered.filter((other) => other.event_id !== fundur.event_id)}
              isActive={state.active === fundur.event_id}
              isPast={isPast}
              selected={state.selected}
              grabbed={state.grabbed}
              editing={state.editing}
              laneSelected={state.laneSelected}
              dispatch={dispatch}
              registerRow={registerRow}
              focusSibling={focusSibling}
            />
          </div>
        );
      })}
    </>
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isToday(day: Date | null, now: Date): boolean {
  return day !== null && startOfDay(day).getTime() === startOfDay(now).getTime();
}
