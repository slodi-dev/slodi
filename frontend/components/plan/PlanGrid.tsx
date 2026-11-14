"use client";

import { useMemo } from "react";
import {
  cellKey,
  type PlanBand,
  type PlanCell,
  type PlanGrid as PlanGridData,
} from "@/services/plan.service";
import { countIs } from "@/lib/format";
import { accentVarFor } from "./planEntries";
import PlanEntryChip from "./PlanEntryChip";
import styles from "./PlanGrid.module.css";

/**
 * The dagskrárhringur as a grid — weeks down, flokkar across (A2, sc-37).
 *
 * ## Why a real <table>, and no table library
 *
 * The ticket asks for a build-vs-library decision. This is built, because the
 * two hard parts are spanning, and spanning is what a table already does:
 *
 *   - a troop-wide event is one `colSpan` across every patrol column;
 *   - a multi-week element is one `rowSpan` down several weeks.
 *
 * `@tanstack/react-table` is a headless *data* table — sorting, filtering,
 * columns derived from rows. It has no spanning primitive, so the cells would
 * still be hand-rendered, and the grid is a fixed matrix rather than a data
 * table. `@dnd-kit` belongs to the Vinnubekkurinn block-assembly surface
 * (sc-138/143/160), which owns dragging; pulling it in here would pre-empt it.
 *
 * A semantic table also gets screen-reader row and column context for free from
 * `<th scope>`. The equivalent div grid would need a full ARIA grid.
 */

interface Props {
  data: PlanGridData;
  onSelectEvent?: (eventId: string) => void;
}

export default function PlanGrid({ data, onSelectEvent }: Props) {
  const { patrols, weeks, bands, cells } = data;

  /**
   * The kit each week needs, gathered from everything happening in it.
   *
   * The hi-fi's "Innkaup" column. This is a derived list, not a stored one: it
   * is the union of what the week's fundir declare they need, so it cannot fall
   * out of step with the plan the way a hand-kept shopping list does — which is
   * the whole complaint behind C4.
   */
  const needsByWeek = useMemo(() => {
    const byWeek = new Map<number, string[]>();
    const add = (entry: PlanBand | PlanCell) => {
      if (!entry.needs?.length) return;
      const current = byWeek.get(entry.week_index) ?? [];
      for (const need of entry.needs) {
        if (!current.includes(need)) current.push(need);
      }
      byWeek.set(entry.week_index, current);
    };
    bands.forEach(add);
    cells.forEach(add);
    return byWeek;
  }, [bands, cells]);

  const patrolIndex = useMemo(() => new Map(patrols.map((patrol, i) => [patrol.id, i])), [patrols]);

  /**
   * A band takes the whole week: a troop-wide event means every flokkur is on
   * it, so per-flokkur cells cannot coexist with one. That is what makes the
   * layout tractable — the alternative is placing a band into whatever columns
   * a spanning cell has left free, which the HTML table model cannot express as
   * one cell unless those columns happen to be contiguous and at an edge.
   *
   * So spans are *clipped* at the next band instead, and any cell that lands
   * inside a band's weeks is reported on the band rather than silently dropped.
   */
  const layout = useMemo(() => {
    const lastWeek = weeks.length > 0 ? weeks[weeks.length - 1].index : 0;

    /**
     * How far an entry may span before it runs into something, or off the end.
     *
     * `blockers` are week indices it must not reach. A span that overshoots the
     * season emits a rowSpan longer than the table has rows; a span that reaches
     * another entry puts two cells in one slot and shears every row below it.
     */
    const clipSpan = (startWeek: number, wanted: number, blockers: Set<number>): number => {
      const capped = Math.min(Math.max(1, wanted), Math.max(1, lastWeek - startWeek + 1));
      for (let offset = 1; offset < capped; offset++) {
        if (blockers.has(startWeek + offset)) return offset;
      }
      return capped;
    };

    const bandStart = new Map<number, PlanBand>();
    for (const band of bands) bandStart.set(band.week_index, band);

    // Bands clip against each other too. Two overlapping troop-wide events is
    // bad data, but the grid must not turn bad data into a broken table.
    const bandStartWeeks = new Set(bandStart.keys());
    const bandSpan = new Map<number, number>();
    const bandWeeks = new Set<number>();
    for (const week of [...bandStartWeeks].sort((a, b) => a - b)) {
      const band = bandStart.get(week) as PlanBand;
      const others = new Set([...bandStartWeeks].filter((other) => other !== week));
      const span = clipSpan(week, band.span_weeks, others);
      bandSpan.set(week, span);
      for (let offset = 0; offset < span; offset++) bandWeeks.add(week + offset);
    }

    const placed = new Map<string, { cell: PlanCell; span: number }>();
    const covered = new Set<string>();
    const swallowed = new Map<number, PlanCell[]>();

    /**
     * Report rather than drop: an omitted event is worse than an awkward one.
     *
     * Reported against the cell's *own* week. An earlier version walked back to
     * the nearest band start, which put the count on a row that might be many
     * weeks away — and, when no band preceded it, on a row that is not a band
     * row and so never rendered the notice at all. That is the silent drop this
     * exists to prevent.
     */
    const hide = (cell: PlanCell) => {
      const list = swallowed.get(cell.week_index) ?? [];
      list.push(cell);
      swallowed.set(cell.week_index, list);
    };

    // Earliest first, so a later cell in the same column clips the one above it
    // rather than being silently overdrawn by it.
    const byColumn = new Map<string, number[]>();
    for (const cell of cells) {
      if (bandWeeks.has(cell.week_index)) continue;
      const starts = byColumn.get(cell.patrol_id) ?? [];
      starts.push(cell.week_index);
      byColumn.set(cell.patrol_id, starts);
    }

    for (const cell of [...cells].sort((a, b) => a.week_index - b.week_index)) {
      if (bandWeeks.has(cell.week_index)) {
        hide(cell);
        continue;
      }
      const key = cellKey(cell.week_index, cell.patrol_id);
      if (placed.has(key) || covered.has(key)) {
        hide(cell);
        continue;
      }

      const blockers = new Set(
        (byColumn.get(cell.patrol_id) ?? []).filter((week) => week !== cell.week_index)
      );
      for (const week of bandWeeks) blockers.add(week);

      const span = clipSpan(cell.week_index, cell.span_weeks, blockers);
      placed.set(key, { cell, span });
      for (let offset = 1; offset < span; offset++) {
        covered.add(cellKey(cell.week_index + offset, cell.patrol_id));
      }
    }

    return { bandStart, bandSpan, bandWeeks, placed, covered, swallowed };
  }, [bands, cells, weeks]);

  if (patrols.length === 0 || weeks.length === 0) {
    return (
      <p className={styles.empty}>
        Þessi hringur hefur hvorki flokka né vikur enn — bættu við flokkum til að byrja töfluna.
      </p>
    );
  }

  return (
    <>
      <div className={styles.vhead}>
        <h2>Dagskrárhringur</h2>
        <span className={styles.eyebrow}>
          sveitarbönd spanna alla flokka · ATH og innkaup fylgja vikunni
        </span>
      </div>
      <div className={styles.rist}>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <caption className={styles.caption}>
              Dagskrárhringur — vikur niður, flokkar til hliðar. Sveitarbönd spanna alla flokka.
            </caption>
            <thead>
              <tr>
                <th scope="col" className={styles.cornerHead}>
                  Vika
                </th>
                {patrols.map((patrol, i) => (
                  <th key={patrol.id} scope="col" className={styles.patrolHead}>
                    <span className={styles.flokk}>
                      <i
                        aria-hidden="true"
                        style={{ ["--c" as string]: accentVarFor(patrol, i) }}
                      />
                      {patrol.name}
                    </span>
                  </th>
                ))}
                <th scope="col" className={styles.utilHead}>
                  ATH
                </th>
                <th scope="col" className={styles.utilHead}>
                  Innkaup
                </th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => {
                const band = layout.bandStart.get(week.index);
                const needs = needsByWeek.get(week.index) ?? [];

                const hidden = layout.swallowed.get(week.index) ?? [];
                const hiddenNote =
                  hidden.length > 0 ? (
                    <p className={styles.swallowed}>
                      {countIs(hidden.length, "flokkafundur", "flokkafundir")} á sama tíma — opnaðu
                      vikuna til að sjá
                    </p>
                  ) : null;

                const utilCells = (
                  <>
                    <td className={styles.util}>
                      {week.note ? week.note : <span className={styles.none}>—</span>}
                    </td>
                    <td className={styles.util}>
                      {needs.length > 0 ? (
                        needs.map((need) => (
                          <span key={need} className={styles.buy}>
                            <i aria-hidden="true" />
                            <span>{need}</span>
                          </span>
                        ))
                      ) : (
                        <span className={styles.none}>—</span>
                      )}
                    </td>
                  </>
                );

                if (band) {
                  return (
                    <tr key={week.index}>
                      <th scope="row" className={styles.weekHead}>
                        <span className={styles.weekHeadInner}>
                          <b>{week.label}</b>
                          {week.starts_on && <span>{week.starts_on.slice(5)}</span>}
                        </span>
                      </th>
                      <td
                        colSpan={patrols.length}
                        rowSpan={layout.bandSpan.get(week.index) ?? 1}
                        className={styles.bandCell}
                      >
                        <PlanEntryChip
                          entry={band}
                          meta="budget"
                          isTroopWide
                          onSelect={onSelectEvent}
                        />
                        {hiddenNote}
                      </td>
                      {utilCells}
                    </tr>
                  );
                }

                // A week under a band the previous row is spanning into. It has no
                // cells of its own, so a swallowed count has nowhere else to go —
                // this is exactly the row that used to lose it.
                if (layout.bandWeeks.has(week.index)) {
                  return (
                    <tr key={week.index}>
                      <th scope="row" className={styles.weekHead}>
                        <span className={styles.weekHeadInner}>
                          <b>{week.label}</b>
                          {week.starts_on && <span>{week.starts_on.slice(5)}</span>}
                          {hiddenNote}
                        </span>
                      </th>
                      {utilCells}
                    </tr>
                  );
                }

                return (
                  <tr key={week.index}>
                    <th scope="row" className={styles.weekHead}>
                      <span className={styles.weekHeadInner}>
                        <b>{week.label}</b>
                        {week.starts_on && <span>{week.starts_on.slice(5)}</span>}
                        {/* Two cells competing for one slot land here, on a week
                            with no band at all — the shape that lost the count. */}
                        {hiddenNote}
                      </span>
                    </th>
                    {patrols.map((patrol) => {
                      const key = cellKey(week.index, patrol.id);
                      if (layout.covered.has(key)) return null;

                      const entry = layout.placed.get(key);
                      return (
                        <td
                          key={patrol.id}
                          className={styles.cell}
                          rowSpan={entry && entry.span > 1 ? entry.span : undefined}
                        >
                          {entry ? (
                            <PlanEntryChip
                              entry={entry.cell}
                              patrol={patrol}
                              patrolIndex={patrolIndex.get(patrol.id) ?? 0}
                              meta="budget"
                              onSelect={onSelectEvent}
                            />
                          ) : (
                            <span className={styles.none}>—</span>
                          )}
                        </td>
                      );
                    })}
                    {utilCells}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
