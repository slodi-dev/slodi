"use client";

import { useDndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import {
  BAND_KIND,
  type BandId,
  type Fundur,
  type Lidur,
  type Patrol,
} from "@/services/plan.service";
import { accentVarFor } from "../planEntries";
import { MIN_MINUTES, bandMinutes, bandOffset, clockAt, type BenchIntent } from "./benchState";
import { dragId } from "./dnd";
import styles from "./split.module.css";

/**
 * A band split across the flokkar — time down the side, one column per patrol.
 *
 * ## Why this is a grid and not three lists
 *
 * The lanes run *at the same time*. The sveit splits up, each flokkur does its
 * own thing for the same stretch of clock, and they reconvene. A list per
 * flokkur would render that as three things happening in sequence, which is the
 * opposite of what is happening — and it would give a leader no way to see the
 * thing they actually need to see, which is whether one flokkur is going to be
 * standing around while another is still working.
 *
 * So time is the constant on the Y axis for the whole section, blocks are
 * positioned by their offset, and the empty tail of a short lane is drawn as
 * "N mín laus" rather than left blank. The band ends when the *longest* lane
 * ends — "lengsti flokkur ræður" — because that is when everyone can regroup.
 *
 * ## Moving a verkefni between flokkar
 *
 * Three ways, all dispatching the same `laneMoveAcross` intent (SPEC §0: drag
 * is an accelerator, never the only path):
 *
 * - **drag** a block into another column;
 * - **← →** on a focused block, which moves it one flokkur sideways;
 * - the **← →** buttons that appear on the selected block.
 *
 * The drag is dnd-kit, the same as everywhere else on the bench. It used to be
 * the browser's own HTML5 drag, which worked — but two drag systems in one
 * surface is a bug waiting for the first leader who drags a bench row towards a
 * lane, and HTML5 drag never fired on touch at all.
 *
 * A dropped block joins the end of the lane rather than landing at the height
 * it was released. The lanes do not share a row grid, so "level with 17:40" is
 * not a position in the target lane — and appending is what the ← → buttons
 * and the keyboard already do, so all three paths agree.
 */

/** Pixels per minute. Tall enough that a 15-minute block is still readable. */
const PX_PER_MIN = 4;
const TICK_MINUTES = 15;
/** Below this a block only has room for its title. */
const TIGHT_MINUTES = 20;

interface Props {
  fundur: Fundur;
  band: BandId;
  patrols: Patrol[];
  selected: string | null;
  dispatch: (intent: BenchIntent) => void;
}

function laneMinutes(items: { minutes: number }[]): number {
  return items.reduce((sum, item) => sum + item.minutes, 0);
}

export default function SplitGrid({ fundur, band, patrols, selected, dispatch }: Props) {
  const lanes = fundur.split?.[band];
  if (!lanes || lanes.length === 0) return null;

  const offset = bandOffset(fundur, band);
  const duration = bandMinutes(fundur, band);
  const height = Math.max(duration, TICK_MINUTES) * PX_PER_MIN;

  const ticks: number[] = [];
  for (let m = 0; m <= duration; m += TICK_MINUTES) ticks.push(m);

  /**
   * The flokkur in a given lane.
   *
   * Resolved through the lane's own `patrol_id` rather than by indexing
   * `patrols` at the lane position. They agree today because `splitBand` deals
   * lanes out in patrol order, but the moment lanes come from the backend — or
   * a flokkur is removed — an index-based label would name the wrong flokkur,
   * and a label that lies is worse than the generic fallback.
   */
  const nameOfLane = (index: number): string => {
    const lane = lanes[index];
    if (!lane) return "annars flokks";
    return patrols.find((patrol) => patrol.id === lane.patrol_id)?.name ?? "annars flokks";
  };

  /**
   * A lane's flokkur, and the column index its colour comes from.
   *
   * The colour index is the patrol's position in `patrols`, not the lane's —
   * the Rist and the Dagatal both derive it that way, and a flokkur with no
   * declared accent has to land on the same ramp in all three or the whole
   * point of colouring them is lost.
   */
  const flokkurOf = (laneIndex: number) => {
    const laneId = lanes[laneIndex]?.patrol_id;
    const at = patrols.findIndex((patrol) => patrol.id === laneId);
    return { patrol: at >= 0 ? patrols[at] : undefined, colourIndex: at >= 0 ? at : laneIndex };
  };

  const moveAcross = (id: string, fromLane: number, toLane: number, toIndex?: number) => {
    if (toLane < 0 || toLane >= lanes.length) return;
    dispatch({
      t: "laneMoveAcross",
      fundurId: fundur.event_id,
      band,
      fromLane,
      toLane,
      id,
      toIndex,
    });
  };

  return (
    <div className={styles.grid} style={{ ["--n" as string]: lanes.length }}>
      <div className={styles.head}>
        <div className={styles.axhd}>kl.</div>
        {lanes.map((lane, i) => {
          const { patrol, colourIndex } = flokkurOf(i);
          const used = laneMinutes(lane.items);
          const slack = duration - used;
          return (
            <div
              key={lane.patrol_id}
              className={styles.lanehd}
              style={{ ["--c" as string]: accentVarFor(patrol, colourIndex) }}
            >
              <span className={styles.fl}>{patrol?.name ?? lane.patrol_id}</span>
              <span className={styles.lt}>
                {used} mín{slack > 0 ? ` · ${slack} laus` : ""}
              </span>
            </div>
          );
        })}
      </div>

      <div className={styles.body} style={{ height: `${height}px` }}>
        <div className={styles.ax} aria-hidden="true">
          {ticks.map((m) => (
            <div key={m} className={styles.tick} style={{ top: `${m * PX_PER_MIN}px` }}>
              <span className={styles.tickT}>{clockAt(fundur, offset + m) ?? `+${m}`}</span>
            </div>
          ))}
        </div>

        {ticks.slice(1).map((m) => (
          <div
            key={`line-${m}`}
            className={styles.gline}
            style={{ top: `${m * PX_PER_MIN}px` }}
            aria-hidden="true"
          />
        ))}

        {lanes.map((lane, laneIndex) => {
          const { patrol, colourIndex } = flokkurOf(laneIndex);
          const used = laneMinutes(lane.items);
          let running = 0;

          return (
            <Lane
              key={lane.patrol_id}
              fundurId={fundur.event_id}
              band={band}
              laneIndex={laneIndex}
              accent={accentVarFor(patrol, colourIndex)}
            >
              {lane.items.map((item, i) => {
                const top = running * PX_PER_MIN;
                const at = clockAt(fundur, offset + running);
                running += item.minutes;
                const tight = item.minutes < TIGHT_MINUTES;

                return (
                  <LaneBlock
                    key={item.id}
                    fundurId={fundur.event_id}
                    band={band}
                    laneIndex={laneIndex}
                    item={item}
                    tight={tight}
                    top={top}
                    height={Math.max(26, item.minutes * PX_PER_MIN - 3)}
                    isSelected={selected === item.id}
                  >
                    <button
                      type="button"
                      className={styles.gev}
                      aria-label={`${patrol?.name ?? ""}${at ? ` kl. ${at}` : ""}: ${item.name}, ${item.minutes} mín. Vinstri og hægri ör færa milli flokka.`}
                      aria-pressed={selected === item.id}
                      onClick={() =>
                        dispatch({ t: "laneSelect", id: selected === item.id ? null : item.id })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                          e.preventDefault();
                          moveAcross(
                            item.id,
                            laneIndex,
                            laneIndex + (e.key === "ArrowLeft" ? -1 : 1)
                          );
                          return;
                        }
                        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                          e.preventDefault();
                          dispatch({
                            t: "laneMove",
                            fundurId: fundur.event_id,
                            band,
                            laneIndex,
                            id: item.id,
                            to: i + (e.key === "ArrowUp" ? -1 : 1),
                          });
                          return;
                        }
                        if (e.key === "Delete" || e.key === "Backspace") {
                          e.preventDefault();
                          dispatch({
                            t: "laneRemove",
                            fundurId: fundur.event_id,
                            band,
                            laneIndex,
                            id: item.id,
                          });
                        }
                      }}
                    >
                      <span className={styles.gevHd}>
                        {at && <span className={styles.num}>{at}</span>}
                        <span className={styles.num}>{item.minutes} mín</span>
                      </span>
                      <span className={styles.gevT}>{item.name}</span>
                      {!tight && item.theme && <span className={styles.gevSub}>{item.theme}</span>}
                    </button>

                    {/*
                     * A sibling of the block, not a child of it. Buttons inside
                     * a button is invalid HTML, and the browser resolves it by
                     * giving the inner controls no keyboard activation at all —
                     * so ↑ and ✕ were mouse-only in a split band.
                     */}
                    {selected === item.id && (
                      <span className={styles.gevActs}>
                        <button
                          type="button"
                          className={styles.gib}
                          disabled={laneIndex === 0}
                          aria-label={`Færa ${item.name} til ${nameOfLane(laneIndex - 1)}`}
                          onClick={() => moveAcross(item.id, laneIndex, laneIndex - 1)}
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          className={styles.gib}
                          disabled={laneIndex === lanes.length - 1}
                          aria-label={`Færa ${item.name} til ${nameOfLane(laneIndex + 1)}`}
                          onClick={() => moveAcross(item.id, laneIndex, laneIndex + 1)}
                        >
                          →
                        </button>
                        <button
                          type="button"
                          className={styles.gib}
                          disabled={i === 0}
                          aria-label={`Færa ${item.name} upp`}
                          onClick={() =>
                            dispatch({
                              t: "laneMove",
                              fundurId: fundur.event_id,
                              band,
                              laneIndex,
                              id: item.id,
                              to: i - 1,
                            })
                          }
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={styles.gib}
                          aria-label={`Fjarlægja ${item.name}`}
                          onClick={() =>
                            dispatch({
                              t: "laneRemove",
                              fundurId: fundur.event_id,
                              band,
                              laneIndex,
                              id: item.id,
                            })
                          }
                        >
                          ✕
                        </button>
                      </span>
                    )}
                  </LaneBlock>
                );
              })}

              {/* The free tail: a short lane's idle time, offered as somewhere
                  to put something rather than left as a gap to interpret. */}
              {used < duration && (
                <button
                  type="button"
                  className={styles.ggap}
                  style={{
                    top: `${used * PX_PER_MIN}px`,
                    height: `${Math.max(20, (duration - used) * PX_PER_MIN - 3)}px`,
                  }}
                  aria-label={`Bæta verkefni við hjá ${patrol?.name ?? "flokknum"}${
                    clockAt(fundur, offset + used) ? ` kl. ${clockAt(fundur, offset + used)}` : ""
                  }`}
                  onClick={() =>
                    dispatch({
                      t: "laneAdd",
                      fundurId: fundur.event_id,
                      band,
                      laneIndex,
                      // Fits the slack the button just promised. The default of
                      // 15 made "+ 5 mín laus" insert a 15-minute block, which
                      // lengthened the band and re-clocked everything after it.
                      lidur: {
                        name: "Nýtt verkefni",
                        kind: BAND_KIND[band],
                        minutes: Math.max(MIN_MINUTES, Math.min(15, duration - used)),
                        status: "draft",
                        theme: fundur.theme ?? null,
                        venue: null,
                        endurmat: null,
                      },
                    })
                  }
                >
                  + {duration - used} mín laus
                </button>
              )}
            </Lane>
          );
        })}
      </div>

      <div className={styles.ft}>
        <span className={styles.eyebrow}>← → færa milli flokka · </span>
        <span className={styles.eyebrow}>
          Ristin er {duration} mín
          {clockAt(fundur, offset)
            ? ` — frá ${clockAt(fundur, offset)} til ${clockAt(fundur, offset + duration)}`
            : ""}
          . Lengsti flokkur ræður.
        </span>
      </div>
    </div>
  );
}

/** One flokkur's column: a drop target for blocks from other lanes and the bank. */
function Lane({
  fundurId,
  band,
  laneIndex,
  accent,
  children,
}: {
  fundurId: string;
  band: BandId;
  laneIndex: number;
  accent: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dragId.laneDrop(fundurId, band, laneIndex),
    data: { kind: "lane", fundurId, band, laneIndex },
  });

  // The lane a block came from is not a destination — `onDragEnd` refuses a
  // same-lane drop — so it must not light up as one. A ring that promises
  // something the handler will decline is worse than no feedback.
  const { active } = useDndContext();
  const from = active?.data.current;
  const isSource = !!from && "kind" in from && from.kind === "lane" && from.laneIndex === laneIndex;

  return (
    <div
      ref={setNodeRef}
      className={styles.glane}
      data-over={(isOver && !isSource) || undefined}
      style={{ ["--c" as string]: accent }}
    >
      {children}
    </div>
  );
}

/**
 * One verkefni in a lane.
 *
 * The whole block is the drag handle here, unlike a bench row: it is a single
 * button with nothing else competing for the pointer, so there is nothing to be
 * ambiguous about. The action strip only appears once the block is selected,
 * and by then the drag has already ended.
 */
function LaneBlock({
  fundurId,
  band,
  laneIndex,
  item,
  tight,
  top,
  height,
  isSelected,
  children,
}: {
  fundurId: string;
  band: BandId;
  laneIndex: number;
  item: Lidur;
  tight: boolean;
  top: number;
  height: number;
  isSelected: boolean;
  children: React.ReactNode;
}) {
  // `listeners` only, never `attributes`. dnd-kit's attributes are
  // `role="button"` + `tabIndex=0`, and this div wraps the block's own button
  // and its ← → ↑ ✕ strip — so spreading them would make every lane block an
  // ARIA button containing four real buttons, which is the nested-interactive
  // shape this component was already fixed for once. It would also add a tab
  // stop that does nothing, since there is no KeyboardSensor.
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId.lane(item.id),
    data: { kind: "lane", fundurId, band, laneIndex, lidur: item },
  });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.gslot} ${tight ? styles.tight : ""}`}
      style={{ top: `${top}px`, height: `${height}px` }}
      data-on={isSelected || undefined}
      data-dragging={isDragging || undefined}
      {...listeners}
    >
      {children}
    </div>
  );
}
