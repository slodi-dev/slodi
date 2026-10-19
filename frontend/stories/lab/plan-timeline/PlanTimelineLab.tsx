"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Patrol, PatrolAccent, PlanGrid, PlanWeek } from "@/services/plan.service";
import { PATROL_ACCENTS, parseWeekStart, resolvePatrolId } from "@/components/plan/planEntries";
import { countIs, formatIcelandicDateShort, formatIcelandicMonthYear } from "@/lib/format";
import { rhythmText, StatusGlyph, TYPE_LABEL, TypeIcon, type Rhythm } from "./planFamily";
import {
  entryName,
  gapWeeksAfter,
  isDated,
  timelineSeason,
  todayPosition,
  whenLabel,
  type TimelineEntry,
} from "./timelineEntries";
import styles from "./PlanTimelineLab.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────── */

/**
 * - `slod`: the season as a trail; routine fundir are small waypoints, exceptions are camps.
 * - `kvardi`: a ruler; weeks are ticks, fundir hang off them, exceptions as tags.
 * - `dagbok`: a paper diary, a ruled line per week; the usual time is a ditto mark.
 * - `brautir`: a swimlane per flokkur on one time axis; routine pale, exceptions vivid.
 */
export type TimelineLook = "slod" | "kvardi" | "dagbok" | "brautir";

export interface PlanTimelineLabProps {
  look: TimelineLook;
  data: PlanGrid;
  /** Injectable so stories are not tied to the day they run. */
  today?: Date;
  /** The flokkur shown first. Defaults to the first one. */
  defaultPatrolId?: string;
  /** Opening a fundur, which the real view hands to the bench. */
  onSelect?: (eventId: string) => void;
}

/* ── Shared pieces ─────────────────────────────────────────────────────────── */

function accentOf(patrol: Patrol | undefined, index: number): PatrolAccent {
  return patrol?.accent ?? PATROL_ACCENTS[index % PATROL_ACCENTS.length];
}

/** The two custom properties every patrol-coloured mark reads: the vivid fill and its text. */
function accentStyle(accent: PatrolAccent): CSSProperties {
  return {
    "--tl-flag": `var(--sl-color-patrol-${accent})`,
    "--tl-flag-fg": `var(--sl-color-patrol-${accent}-foreground)`,
  } as CSSProperties;
}

/** A swallow-tailed pennant with the flokkur's initial: identity, never status. */
function PatrolFlag({
  name,
  accent,
  size = "md",
}: {
  name: string;
  accent: PatrolAccent;
  size?: "sm" | "md";
}) {
  return (
    <span className={styles.flag} data-size={size} style={accentStyle(accent)} aria-hidden="true">
      {name.charAt(0)}
    </span>
  );
}

/** Status for what is ahead; the past is reference, so it drops the mark (as in Staða). */
function Status({ entry, tone }: { entry: TimelineEntry; tone?: "inherit" }) {
  return entry.isDone ? null : <StatusGlyph status={entry.status} tone={tone} />;
}

/** What makes this fundur not the usual one: its type, or that it moved. */
function Exception({ entry }: { entry: TimelineEntry }) {
  if (entry.type !== "flokks") {
    return (
      <span className={styles.kind}>
        <TypeIcon type={entry.type} size={14} /> {TYPE_LABEL[entry.type]}
      </span>
    );
  }
  if (entry.moved && entry.day) {
    return <span className={styles.moved}>Breyttur tími: {fullWhen(entry)}</span>;
  }
  return null;
}

/** "fös 30. okt.–sun 1. nóv. kl. 17:00": the full when, for an exception. */
function fullWhen(entry: TimelineEntry): string {
  return whenLabel(entry) + (entry.clock ? ` kl. ${entry.clock}` : "");
}

/** A routine fundur only needs its date: the time is the rhythm, said once at the top. */
function shortWhen(entry: TimelineEntry): string {
  return entry.day ? formatIcelandicDateShort(entry.day) : whenLabel(entry);
}

function EntryButton({
  entry,
  onSelect,
  className,
  children,
}: {
  entry: TimelineEntry;
  onSelect?: (id: string) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${styles.entry} ${className ?? ""}`}
      aria-label={entryName(entry)}
      data-done={entry.isDone || undefined}
      data-status={entry.status}
      data-troop={entry.isTroopWide || undefined}
      data-routine={entry.routine || undefined}
      onClick={() => onSelect?.(entry.id)}
    >
      {children}
    </button>
  );
}

/** The leader's question, answered before any direction draws anything. */
function Summary({
  entries,
  dated,
  rhythm,
}: {
  entries: TimelineEntry[];
  dated: boolean;
  rhythm: Rhythm | null;
}) {
  const done = entries.filter((e) => e.isDone).length;
  const ahead = entries.length - done;
  const next = entries.find((e) => !e.isDone);
  const exceptions = entries.filter((e) => !e.isDone && !e.routine).length;
  return (
    <div className={styles.summary}>
      <p>
        {next ? (
          <>
            <span className={styles.summaryLead}>Næst:</span> {next.title}
            {dated && <span className={styles.summaryWhen}> · {fullWhen(next)}</span>}
          </>
        ) : (
          <span className={styles.summaryLead}>Ekkert skráð framundan.</span>
        )}
      </p>
      <p className={styles.summaryCount}>
        {rhythm && <>Vikulegur fundur {rhythmText(rhythm)} · </>}
        {dated
          ? `${countIs(done, "fundur búinn", "fundir búnir")}, ${ahead} framundan, þar af ${countIs(exceptions, "frávik", "frávik")}`
          : `${countIs(entries.length, "fundur", "fundir")} á blaði, engar dagsetningar`}
      </p>
    </div>
  );
}

function monthKey(entry: TimelineEntry): string {
  const date = entry.day ?? entry.weekStart;
  return date ? formatIcelandicMonthYear(date) : "";
}

const todayLabel = (now: Date) => `Í dag · ${formatIcelandicDateShort(now)}`;

/* ── A · Slóð (trail) ──────────────────────────────────────────────────────── */

type TrailRow =
  | { kind: "month"; label: string }
  | { kind: "entry"; entry: TimelineEntry; isNext: boolean }
  | { kind: "gap"; weeks: number; ahead: boolean }
  | { kind: "today" };

function trailRows(entries: TimelineEntry[], dated: boolean): TrailRow[] {
  const rows: TrailRow[] = [];
  const firstAhead = entries.findIndex((e) => !e.isDone);
  let month = "";
  entries.forEach((entry, i) => {
    if (dated && i === firstAhead) rows.push({ kind: "today" });
    const key = monthKey(entry);
    if (key && key !== month) rows.push({ kind: "month", label: key });
    month = key;
    rows.push({ kind: "entry", entry, isNext: i === firstAhead });
    const gap = gapWeeksAfter(entry, entries[i + 1]);
    if (gap > 0) rows.push({ kind: "gap", weeks: gap, ahead: !entries[i + 1]?.isDone });
  });
  if (dated && firstAhead === -1) rows.push({ kind: "today" });
  return rows;
}

function Trail({ entries, dated, now, flag, onSelect }: LookProps) {
  const rows = trailRows(entries, dated);
  const firstAhead = entries.findIndex((e) => !e.isDone);
  const todayAt = rows.findIndex((r) => r.kind === "today");
  return (
    <ol className={styles.trail}>
      {rows.map((row, i) => {
        // Rows before the today marker are the walked part of the path.
        const walked = dated && todayAt !== -1 && i < todayAt;
        const part = walked ? "walked" : "ahead";
        switch (row.kind) {
          case "month":
            return (
              <li key={`m-${row.label}`} className={styles.trailMonth} data-part={part}>
                <span className={styles.trailRail} aria-hidden="true" />
                <span className={styles.trailMonthLabel}>{row.label}</span>
              </li>
            );
          case "gap":
            return (
              <li
                key={`g-${i}`}
                className={styles.trailGap}
                data-part={row.ahead ? "ahead" : "walked"}
              >
                <span className={styles.trailRail} aria-hidden="true" />
                <span>{countIs(row.weeks, "vika", "vikur")} án fundar</span>
              </li>
            );
          case "today":
            return (
              <li key="today" className={styles.trailToday} data-part="today">
                <span className={styles.trailRail} aria-hidden="true">
                  {flag}
                </span>
                <span className={styles.todayLabel}>{todayLabel(now)}</span>
                {firstAhead === -1 && (
                  <span className={styles.trailNothing}>Ekkert skráð framundan.</span>
                )}
              </li>
            );
          case "entry": {
            const { entry, isNext } = row;
            const quiet = entry.routine && !isNext;
            return (
              <li
                key={entry.id}
                className={styles.trailStop}
                data-part={part}
                data-next={isNext || undefined}
                data-quiet={quiet || undefined}
              >
                <span className={styles.trailRail} aria-hidden="true">
                  {entry.type === "flokks" ? (
                    <span
                      className={styles.waypoint}
                      data-done={entry.isDone || undefined}
                      data-status={entry.status}
                      data-moved={entry.moved || undefined}
                    />
                  ) : (
                    // An exception is a camp on the route, not a dot: its type's icon.
                    <span
                      className={styles.camp}
                      data-done={entry.isDone || undefined}
                      data-status={entry.status}
                      data-troop={entry.isTroopWide || undefined}
                    >
                      <TypeIcon type={entry.type} size={15} />
                    </span>
                  )}
                </span>
                <EntryButton entry={entry} onSelect={onSelect} className={styles.trailEntry}>
                  {isNext && <span className={styles.overline}>Næst</span>}
                  {quiet ? (
                    <span className={styles.trailQuiet}>
                      <span className={styles.trailQuietWhen}>{shortWhen(entry)}</span>
                      <span className={styles.title}>{entry.title}</span> <Status entry={entry} />
                    </span>
                  ) : (
                    <>
                      <span className={styles.title}>
                        {entry.title} <Status entry={entry} />
                      </span>
                      <span className={styles.meta}>
                        <Exception entry={entry} />
                        {!entry.moved && fullWhen(entry)}
                        {entry.spanWeeks > 1 && ` · ${entry.spanWeeks} vikur`}
                        {entry.isTroopWide && <span className={styles.troop}>Öll sveitin</span>}
                      </span>
                    </>
                  )}
                </EntryButton>
              </li>
            );
          }
        }
      })}
    </ol>
  );
}

/* ── B · Kvarði (ruler) ────────────────────────────────────────────────────── */

/** Scroll a horizontal axis so today sits a week in from the left edge. */
function useScrollToToday(position: number | null, firstIndex: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scroller = ref.current;
    const tick = scroller?.querySelector<HTMLElement>("[data-week-tick]");
    if (!scroller || !tick || position === null) return;
    scroller.scrollLeft = Math.max(0, (Math.floor(position) - firstIndex - 1) * tick.offsetWidth);
  }, [position, firstIndex]);
  return ref;
}

function WeekAxis({ weeks, className }: { weeks: PlanWeek[]; className: string }) {
  let month = "";
  return (
    <div className={className} aria-hidden="true">
      {weeks.map((week) => {
        const start = parseWeekStart(week);
        const label = start ? formatIcelandicMonthYear(start) : "";
        const monthStart = label !== month;
        month = label;
        return (
          <span
            key={week.index}
            className={styles.tick}
            data-week-tick
            data-month-start={monthStart || undefined}
          >
            {monthStart && label && <span className={styles.tickMonth}>{label}</span>}
            <span className={styles.tickDate}>
              {start ? formatIcelandicDateShort(start) : week.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function TodayLine({
  position,
  firstIndex,
  label,
}: {
  position: number | null;
  firstIndex: number;
  label: string;
}) {
  if (position === null) return null;
  return (
    <span
      className={styles.todayLine}
      style={{ "--tl-at": position - firstIndex } as CSSProperties}
    >
      <span className={styles.todayLabel}>{label}</span>
    </span>
  );
}

function Ruler({ entries, weeks, now, onSelect }: LookProps) {
  const firstIndex = weeks[0]?.index ?? 1;
  const position = todayPosition(weeks, now);
  const ref = useScrollToToday(position, firstIndex);
  return (
    <div ref={ref} className={styles.scroller}>
      <div className={styles.ruler} style={{ "--tl-weeks": weeks.length } as CSSProperties}>
        <WeekAxis weeks={weeks} className={styles.rulerAxis} />
        <TodayLine position={position} firstIndex={firstIndex} label={todayLabel(now)} />
        <ol className={styles.hangers}>
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={styles.hanger}
              data-done={entry.isDone || undefined}
              data-status={entry.status}
              data-routine={entry.routine || undefined}
              style={{
                gridColumn: `${entry.week.index - firstIndex + 1} / span ${entry.spanWeeks}`,
              }}
            >
              <EntryButton entry={entry} onSelect={onSelect} className={styles.hangerLabel}>
                {entry.routine ? (
                  <span className={styles.title}>
                    {entry.title} <Status entry={entry} />
                  </span>
                ) : (
                  <>
                    <Exception entry={entry} />
                    <span className={styles.title}>
                      {entry.title}{" "}
                      <Status
                        entry={entry}
                        tone={entry.isTroopWide && !entry.isDone ? "inherit" : undefined}
                      />
                    </span>
                    {entry.type !== "flokks" && (
                      <span className={styles.meta}>{fullWhen(entry)}</span>
                    )}
                  </>
                )}
              </EntryButton>
            </li>
          ))}
        </ol>
      </div>
      {position !== null && entries.every((e) => e.isDone) && (
        <p className={styles.axisNothing}>Ekkert skráð framundan.</p>
      )}
    </div>
  );
}

/* ── C · Dagbók (diary) ────────────────────────────────────────────────────── */

function Diary({ entries, weeks, now, dated, rhythm, onSelect }: LookProps) {
  const byWeek = new Map<number, TimelineEntry[]>();
  /** Weeks a spanning entry runs on into, so the diary can write "framhald". */
  const continued = new Map<number, TimelineEntry>();
  for (const entry of entries) {
    byWeek.set(entry.week.index, [...(byWeek.get(entry.week.index) ?? []), entry]);
    for (let w = 1; w < entry.spanWeeks; w++) continued.set(entry.week.index + w, entry);
  }
  const position = todayPosition(weeks, now);
  const currentWeek = position === null ? null : Math.floor(position);

  const months: { label: string; weeks: PlanWeek[] }[] = [];
  for (const week of weeks) {
    const start = parseWeekStart(week);
    const label = start ? formatIcelandicMonthYear(start) : "";
    const last = months[months.length - 1];
    if (last && last.label === label) last.weeks.push(week);
    else months.push({ label, weeks: [week] });
  }

  return (
    <div className={styles.diary}>
      {rhythm && (
        <p className={styles.diaryKey}>
          <span className={styles.ditto} aria-hidden="true">
            〃
          </span>{" "}
          = venjulegur tími, {rhythmText(rhythm)}
        </p>
      )}
      {months.map((month) => (
        <section
          key={month.label || "undated"}
          className={styles.diaryMonth}
          aria-label={month.label || undefined}
        >
          {month.label && <h3 className={styles.diaryMonthTitle}>{month.label}</h3>}
          <ol className={styles.diaryWeeks}>
            {month.weeks.map((week) => {
              const start = parseWeekStart(week);
              const own = byWeek.get(week.index) ?? [];
              const carried = continued.get(week.index);
              const isToday = currentWeek === week.index;
              const past = dated && currentWeek !== null && week.index < currentWeek;
              return (
                <li
                  key={week.index}
                  className={styles.diaryWeek}
                  data-past={past || undefined}
                  data-today={isToday || undefined}
                >
                  <span className={styles.diaryGutter}>
                    <span className={styles.diaryWeekNo}>{week.label}</span>
                    {start && (
                      <span className={styles.diaryDate}>{formatIcelandicDateShort(start)}</span>
                    )}
                    {isToday && <span className={styles.diaryTodayTab}>Í dag</span>}
                  </span>
                  <span className={styles.diaryLines}>
                    {own.map((entry) => (
                      <EntryButton
                        key={entry.id}
                        entry={entry}
                        onSelect={onSelect}
                        className={styles.diaryLine}
                      >
                        <span className={styles.diaryClock}>
                          {entry.routine && rhythm ? (
                            <span className={styles.ditto}>〃</span>
                          ) : entry.type !== "flokks" ? (
                            <TypeIcon type={entry.type} size={16} />
                          ) : (
                            (entry.clock ?? "–")
                          )}
                        </span>
                        <span className={styles.diaryText}>
                          <span className={styles.title}>
                            {entry.title} <Status entry={entry} />
                          </span>
                          {!entry.routine && (
                            <span className={styles.meta}>
                              <Exception entry={entry} />
                              {entry.type !== "flokks" && fullWhen(entry)}
                              {entry.isTroopWide && (
                                <span className={styles.troop}>Öll sveitin</span>
                              )}
                            </span>
                          )}
                        </span>
                      </EntryButton>
                    ))}
                    {carried && (
                      <span className={styles.diaryCarried}>framhald: {carried.title}</span>
                    )}
                    {week.note && <span className={styles.diaryNote}>ATH: {week.note}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

/* ── D · Brautir (swimlanes) ───────────────────────────────────────────────── */

function Lanes({ data, entries, weeks, now, activePatrolId, onSelect }: LookProps) {
  const firstIndex = weeks[0]?.index ?? 1;
  const position = todayPosition(weeks, now);
  const ref = useScrollToToday(position, firstIndex);
  const shared = entries.filter((e) => e.isTroopWide);
  const lanes = data.patrols.map((patrol, index) => ({
    patrol,
    accent: accentOf(patrol, index),
    active: patrol.id === activePatrolId,
    entries: (patrol.id === activePatrolId
      ? entries
      : timelineSeason(data, patrol.id, now).entries
    ).filter((e) => !e.isTroopWide),
  }));
  // The chosen flokkur first, so it stays the subject; the others are context below it.
  lanes.sort((a, b) => Number(b.active) - Number(a.active));

  const block = (entry: TimelineEntry, accent?: PatrolAccent) => {
    // A routine block is pale; anything else is the flokkur's full colour or the inverse.
    const onFill =
      !entry.isDone && (!entry.routine || entry.isTroopWide) && entry.status !== "unknown";
    return (
      <li
        key={entry.id}
        className={styles.block}
        style={{
          gridColumn: `${entry.week.index - firstIndex + 1} / span ${entry.spanWeeks}`,
          ...(accent ? accentStyle(accent) : {}),
        }}
      >
        <EntryButton entry={entry} onSelect={onSelect} className={styles.blockButton}>
          <span className={styles.title}>
            <Status entry={entry} tone={onFill ? "inherit" : undefined} />{" "}
            {entry.type !== "flokks" && <TypeIcon type={entry.type} size={13} />} {entry.title}
          </span>
        </EntryButton>
      </li>
    );
  };

  return (
    <div ref={ref} className={styles.scroller}>
      <div className={styles.lanes} style={{ "--tl-weeks": weeks.length } as CSSProperties}>
        <span className={styles.laneCorner} aria-hidden="true" />
        <WeekAxis weeks={weeks} className={styles.lanesAxis} />
        <TodayLine position={position} firstIndex={firstIndex} label={todayLabel(now)} />

        <h3 className={styles.laneHead} data-troop>
          Öll sveitin
        </h3>
        <ol className={styles.lane} data-troop aria-label="Öll sveitin">
          {shared.map((entry) => block(entry))}
        </ol>

        {lanes.map((lane) => (
          <Fragment key={lane.patrol.id}>
            <h3 className={styles.laneHead} data-active={lane.active || undefined}>
              <PatrolFlag name={lane.patrol.name} accent={lane.accent} size="sm" />
              <span className={styles.laneName}>{lane.patrol.name}</span>
            </h3>
            <ol
              className={styles.lane}
              data-active={lane.active || undefined}
              aria-label={lane.patrol.name}
            >
              {lane.entries.map((entry) => block(entry, lane.accent))}
            </ol>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/* ── The lab component ─────────────────────────────────────────────────────── */

interface LookProps {
  data: PlanGrid;
  entries: TimelineEntry[];
  rhythm: Rhythm | null;
  weeks: PlanWeek[];
  now: Date;
  dated: boolean;
  activePatrolId: string | null;
  flag: ReactNode;
  onSelect?: (id: string) => void;
}

const LOOKS: Record<TimelineLook, (props: LookProps) => ReactNode> = {
  slod: Trail,
  kvardi: Ruler,
  dagbok: Diary,
  brautir: Lanes,
};

export default function PlanTimelineLab({
  look,
  data,
  today,
  defaultPatrolId,
  onSelect,
}: PlanTimelineLabProps) {
  const now = useMemo(() => today ?? new Date(), [today]);
  const selectId = useId();
  const [patrolId, setPatrolId] = useState<string | null>(defaultPatrolId ?? null);
  const activePatrolId = resolvePatrolId(data, patrolId);
  const patrolIndex = data.patrols.findIndex((p) => p.id === activePatrolId);
  const patrol = data.patrols[patrolIndex];
  const accent = accentOf(patrol, Math.max(0, patrolIndex));

  const { entries, rhythm } = useMemo(
    () => timelineSeason(data, activePatrolId, now),
    [data, activePatrolId, now]
  );
  const dated = isDated(data);

  if (data.patrols.length === 0) {
    return (
      <div className={styles.root} data-look={look}>
        <p className={styles.empty}>Engir flokkar til að sýna enn.</p>
      </div>
    );
  }

  const Look = LOOKS[look];
  const flag = patrol ? <PatrolFlag name={patrol.name} accent={accent} /> : null;

  return (
    <div className={styles.root} data-look={look} style={accentStyle(accent)}>
      <div className={styles.head}>
        {look !== "brautir" && flag}
        <label className={styles.pickerLabel} htmlFor={selectId}>
          Flokkur
        </label>
        <select
          id={selectId}
          className={styles.picker}
          value={activePatrolId ?? ""}
          onChange={(event) => setPatrolId(event.target.value)}
        >
          {data.patrols.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {entries.length === 0 ? (
        <p className={styles.empty}>Ekkert skráð á þennan flokk enn.</p>
      ) : (
        <>
          <Summary entries={entries} dated={dated} rhythm={rhythm} />
          <Look
            data={data}
            entries={entries}
            rhythm={rhythm}
            weeks={data.weeks}
            now={now}
            dated={dated}
            activePatrolId={activePatrolId}
            flag={flag}
            onSelect={onSelect}
          />
        </>
      )}
    </div>
  );
}
