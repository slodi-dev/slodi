/**
 * The marks a fundur wears in every planner lab, so it is recognisably the same thing in the
 * calendar, the timeline and the window:
 *
 * - **Status first**, in the calendar's Staða language: ✓ staðfest (success), ✎ drög (info),
 *   ⧗ óvíst (warning), "?" óákveðið (neutral, dashed). A glyph always sits with the colour.
 * - **The type** for anything that is not the weekly fundur, with the calendar's icons: a tent
 *   for an útilega, a mountain for a dagsferð, and so on.
 * - **The rhythm**: most weeks a flokkur meets at the same time on the same evening, so that is
 *   said once, and only a fundur that breaks it says when it is.
 *
 * Kept as a copy in plan-timeline/ too, so either lab can be promoted or deleted on its own.
 */
import type { LucideIcon } from "lucide-react";
import {
  Check,
  ClipboardList,
  Flag,
  Hourglass,
  Mountain,
  PartyPopper,
  Pencil,
  Tent,
  TentTree,
  Users,
} from "lucide-react";
import { formatIcelandicDateShort } from "@/lib/format";
import { STATUS_LABEL, type EventType, type PlanStatus } from "@/services/plan.service";
import styles from "./planFamily.module.css";

export const TYPE_LABEL: Record<EventType, string> = {
  skipulags: "Skipulagsfundur",
  sveitar: "Sveitarfundur",
  flokks: "Flokksfundur",
  uppskeru: "Uppskeruhátíð",
  utilega: "Útilega",
  dagsferd: "Dagsferð",
  mot: "Mót",
};

const TYPE_ICON: Record<EventType, LucideIcon> = {
  flokks: Flag,
  sveitar: Users,
  skipulags: ClipboardList,
  utilega: Tent,
  dagsferd: Mountain,
  mot: TentTree,
  uppskeru: PartyPopper,
};

const STATUS_GLYPH: Record<PlanStatus, LucideIcon | "?"> = {
  confirmed: Check,
  draft: Pencil,
  tentative: Hourglass,
  unknown: "?",
};

/**
 * ✓ ✎ ⧗ or "?", in the status's own text colour. `withWord` adds "Drög", "Óvíst"…
 * `tone="inherit"` takes the surrounding text colour instead, for marks on a patrol or
 * inverse fill, where the status colours would not reach AA.
 */
export function StatusGlyph({
  status,
  withWord = false,
  tone = "status",
}: {
  status: PlanStatus;
  withWord?: boolean;
  tone?: "status" | "inherit";
}) {
  const Glyph = STATUS_GLYPH[status];
  return (
    <span className={styles.status} data-status={status} data-tone={tone}>
      <span className={styles.glyph} aria-hidden="true">
        {Glyph === "?" ? "?" : <Glyph size={13} strokeWidth={2.75} />}
      </span>
      {withWord && <span className={styles.word}>{STATUS_LABEL[status]}</span>}
    </span>
  );
}

export function TypeIcon({ type, size = 15 }: { type: EventType; size?: number }) {
  const Icon = TYPE_ICON[type];
  return <Icon className={styles.typeIcon} size={size} strokeWidth={2.25} aria-hidden="true" />;
}

/* ── Rhythm ── */

const WEEKDAY_SHORT = ["mán", "þri", "mið", "fim", "fös", "lau", "sun"];
const WEEKDAY_DATIVE_PLURAL = [
  "mánudögum",
  "þriðjudögum",
  "miðvikudögum",
  "fimmtudögum",
  "föstudögum",
  "laugardögum",
  "sunnudögum",
];

/** Monday is 0, as Icelandic weeks start on mánudagur. */
const weekdayOf = (day: Date) => (day.getDay() + 6) % 7;

export type Rhythm = { weekday: number; clock: string | null };

type RhythmEntry = {
  type: EventType;
  isTroopWide: boolean;
  day: Date | null;
  clock: string | null;
};

/**
 * The flokkur's usual slot: the weekday and time most of its own flokksfundir share. Null
 * when there is no clear habit (fewer than three dated fundir, or no slot holding half).
 */
export function rhythmOf(entries: RhythmEntry[]): Rhythm | null {
  const counts = new Map<string, number>();
  const weekly = entries.filter((e) => e.type === "flokks" && !e.isTroopWide && e.day);
  for (const e of weekly) {
    const key = `${weekdayOf(e.day as Date)}|${e.clock ?? ""}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!best || best[1] < 3 || best[1] * 2 < weekly.length) return null;
  const [weekday, clock] = best[0].split("|");
  return { weekday: Number(weekday), clock: clock || null };
}

/** "á þriðjudögum kl. 19:30". */
export function rhythmText(rhythm: Rhythm): string {
  return `á ${WEEKDAY_DATIVE_PLURAL[rhythm.weekday]}${rhythm.clock ? ` kl. ${rhythm.clock}` : ""}`;
}

/** The weekly flokksfundur at its usual time: the part of the plan that needs no attention. */
export function isRoutine(entry: RhythmEntry, rhythm: Rhythm | null): boolean {
  if (entry.type !== "flokks" || entry.isTroopWide) return false;
  if (!rhythm || !entry.day) return true;
  return weekdayOf(entry.day) === rhythm.weekday && entry.clock === rhythm.clock;
}

/** A flokksfundur moved off its usual evening or time. */
export function isMoved(entry: RhythmEntry, rhythm: Rhythm | null): boolean {
  return entry.type === "flokks" && !entry.isTroopWide && !isRoutine(entry, rhythm);
}

/** The last day of a multi-day event, from its start and planned length; null if one day. */
export function lastDay(
  startsAt: string | null | undefined,
  plannedMinutes: number | null | undefined
): Date | null {
  if (!startsAt || !plannedMinutes) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(startsAt);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const end = new Date(y, mo - 1, d, h, mi + plannedMinutes);
  const startDay = new Date(y, mo - 1, d);
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return endDay.getTime() > startDay.getTime() ? endDay : null;
}

/** "fös 30. okt.", or a span: "fös 30. okt.–sun 1. nóv.". */
export function dayLabel(day: Date, until: Date | null = null): string {
  const one = (d: Date) => `${WEEKDAY_SHORT[weekdayOf(d)]} ${formatIcelandicDateShort(d)}`;
  return until ? `${one(day)}–${one(until)}` : one(day);
}

/** "mið kl. 18:00", for a fundur that moved. */
export function slotLabel(day: Date, clock: string | null): string {
  return `${WEEKDAY_SHORT[weekdayOf(day)]}${clock ? ` kl. ${clock}` : ""}`;
}
