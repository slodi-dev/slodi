import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Backpack,
  Ban,
  CalendarClock,
  Check,
  ClipboardList,
  Flag,
  Flame,
  FlameKindling,
  Hourglass,
  MessageSquareText,
  Mountain,
  PartyPopper,
  Pencil,
  Tent,
  TentTree,
  ThumbsUp,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import PlanEntryChip from "@/components/plan/PlanEntryChip";
import gridStyles from "@/components/plan/PlanGrid.module.css";
import { accentVarFor, isWeekDone, parseWeekStart } from "@/components/plan/planEntries";
import {
  STATUS_LABEL,
  cellKey,
  type EventType,
  type Patrol,
  type PlanStatus,
  type PlanWeek,
} from "@/services/plan.service";
import { countIs, formatIcelandicDateShort } from "@/lib/format";
import {
  GEAR,
  LAB_TODAY,
  exceptionOf,
  gatherGear,
  patrolInitial,
  sortGear,
  usualSlots,
  type Exception,
  type GatheredGear,
  type GearState,
  type LabBand,
  type LabCell,
  type LabEndurmat,
  type LabGridData,
  type LabSeason,
  type UsualSlot,
  type WeekSide,
} from "./planGridLabData";
import styles from "./PlanGridLab.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────── */

/**
 * The picked direction is A · Two columns (Endurmat and Búnaður). These are its variations,
 * which differ in the fundur element in each cell, plus the side-column touches that suit it:
 *
 * - `chip`: A as picked, with today's PlanEntryChip (for reference).
 * - `stada`: A1 · Staða. Status first, like the Dagatal's picked look.
 * - `merki`: A2 · Merki. Each fundur is a scout patch: sewn on once it's decided.
 * - `vardeldur`: A3 · Varðeldur. A fire that grows as the liðir are decided, with a tally.
 * - `stimpill`: A4 · Stimpill. A passport stamp once ready; a dotted empty stamp until then.
 */
export type FundurLook = "chip" | "stada" | "merki" | "vardeldur" | "stimpill";

export const LOOK_NAME: Record<FundurLook, string> = {
  chip: "A · Two columns (current chip)",
  stada: "A1 · Staða",
  merki: "A2 · Merki",
  vardeldur: "A3 · Varðeldur",
  stimpill: "A4 · Stimpill",
};

export interface PlanGridLabProps {
  look: FundurLook;
  season: LabSeason;
  /** Opens a liður on the bench. The real app would navigate to `/plan/bekkur#<lidurId>`. */
  onOpenLidur?: (lidurId: string) => void;
  onSelectEvent?: (eventId: string) => void;
}

/* ── Copy ──────────────────────────────────────────────────────────────────── */

/** Short weekday names; lib/format.ts has no weekday helper yet. */
const WEEKDAY = ["mán.", "þri.", "mið.", "fim.", "fös.", "lau.", "sun."];
const STATE_LABEL: Record<GearState, string> = { eigum: "Eigum", vantar: "Vantar", ovist: "Óvíst" };
const TONE_LABEL = { positive: "Gekk vel", corrective: "Laga næst" } as const;

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

/** `Vasaljós ×12`, `Eldsneyti · 4 brúsar`, `Sjúkrakassi`. */
export function gearLabel({ item, qty }: GatheredGear): string {
  if (item.consumable && item.unit)
    return `${item.name} · ${countIs(qty, item.unit[0], item.unit[1])}`;
  return qty > 1 ? `${item.name} ×${qty}` : item.name;
}

/** An ISO date as a local day, so it doesn't move west of UTC. */
function localDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function weekDate(week: PlanWeek): string {
  const start = parseWeekStart(week);
  return start ? formatIcelandicDateShort(start) : "";
}

const slotText = (s: UsualSlot) => `${WEEKDAY[s.weekday]} ${s.clock}`;

/* ── What one fundur element needs to know ─────────────────────────────────── */

interface EntryInfo {
  entry: LabCell | LabBand;
  /** The flokkar it is for. Empty for the whole sveit. */
  patrols: { patrol: Patrol; index: number }[];
  exception: Exception;
  past: boolean;
  hasEndurmat: boolean;
  decided: number;
  items: number;
  /** Minutes over the fundur's budget; 0 when on or under, and for multi-day events. */
  over: number;
}

function exceptionText(ex: Exception): string | null {
  if (!ex) return null;
  if (ex.kind === "cancelled") return "Fellur niður";
  if (ex.kind === "moved") return `Færður · ${WEEKDAY[ex.weekday]} ${ex.clock}`;
  if (ex.kind === "multiday") return `${WEEKDAY[ex.fromDay]}–${WEEKDAY[ex.toDay]}`;
  return `${WEEKDAY[ex.weekday]} ${ex.clock}`;
}

/** The whole story in one sentence, for the element's accessible name. */
function spokenName(info: EntryInfo): string {
  const { entry, patrols, exception, past, hasEndurmat } = info;
  const who = patrols.length ? patrols.map((p) => p.patrol.name).join(" og ") : "Öll sveitin";
  const parts = [`${who}: ${entry.title}`];
  if (entry.starts_at) {
    const day = formatIcelandicDateShort(localDay(entry.starts_at));
    if (exception?.kind === "multiday" && entry.ends_at) {
      parts.push(`${day} til ${formatIcelandicDateShort(localDay(entry.ends_at))}`);
    } else {
      parts.push(`${day} kl. ${entry.starts_at.slice(11, 16)}`);
    }
  }
  if (exception?.kind === "cancelled") parts.push(`fellur niður: ${exception.reason}`);
  else {
    if (exception?.kind === "moved") parts.push("færður af venjulegum fundartíma");
    parts.push(past ? "lokið" : STATUS_LABEL[entry.status].toLowerCase());
    if (!past && info.items) parts.push(`ákveðnir liðir ${info.decided} af ${info.items}`);
    if (info.over > 0) parts.push(`${countIs(info.over, "mínúta", "mínútur")} umfram`);
  }
  if (hasEndurmat) parts.push("endurmat frá síðast");
  return parts.join(", ");
}

/** The flokkur's ramp as local aliases (`--pc`, `--pc-fg`); the whole sveit wears the inverse surface. */
function patrolVars(info: EntryInfo): CSSProperties {
  const [first, second] = info.patrols;
  if (!first) {
    return {
      "--pc": "var(--sl-color-surface-inverse)",
      "--pc-fg": "var(--sl-color-text-inverse)",
      "--pc2": "var(--sl-color-surface-inverse)",
    } as CSSProperties;
  }
  const ramp = (p: { patrol: Patrol; index: number }) => accentVarFor(p.patrol, p.index);
  return {
    "--pc": ramp(first),
    "--pc-fg": ramp(first).replace(/\)$/, "-foreground)"),
    "--pc2": ramp(second ?? first),
  } as CSSProperties;
}

function PatrolChips({ info }: { info: EntryInfo }) {
  const list = info.patrols.length ? info.patrols : [null];
  return (
    <span className={styles.chips} aria-hidden="true">
      {list.map((p, i) => (
        <span
          key={p?.patrol.id ?? "sveit"}
          className={styles.chip}
          style={i === 1 ? ({ "--pc": "var(--pc2)" } as CSSProperties) : undefined}
        >
          {patrolInitial(p?.patrol)}
        </span>
      ))}
    </span>
  );
}

function ExceptionFlag({ info }: { info: EntryInfo }) {
  const text = exceptionText(info.exception);
  if (!text || !info.exception) return null;
  const Icon =
    info.exception.kind === "cancelled"
      ? Ban
      : info.exception.kind === "moved"
        ? CalendarClock
        : TYPE_ICON[info.entry.type];
  return (
    <span className={styles.flag} data-kind={info.exception.kind}>
      <Icon aria-hidden="true" />
      {text}
    </span>
  );
}

function Minutes({ info }: { info: EntryInfo }) {
  const { actual_minutes: actual, planned_minutes: planned } = info.entry;
  // Nothing decided yet: the minutes are a placeholder, not a plan.
  if (!actual || !planned || planned > 600 || info.decided === 0) return null;
  return (
    <span className={styles.minutes} data-over={info.over > 0 || undefined}>
      {actual}/{planned} mín
    </span>
  );
}

function EndurmatMark({ info }: { info: EntryInfo }) {
  return info.hasEndurmat ? (
    <MessageSquareText aria-hidden="true" className={styles.endurMark} />
  ) : null;
}

/* ── The fundur elements ───────────────────────────────────────────────────── */

interface ElementProps {
  info: EntryInfo;
  onSelect?: (eventId: string) => void;
}

function ElementButton({
  info,
  className,
  onSelect,
  children,
}: ElementProps & { className: string; children: ReactNode }) {
  const { entry, exception, past } = info;
  return (
    <button
      type="button"
      className={`${styles.el} ${className}`}
      style={patrolVars(info)}
      data-status={entry.status}
      data-past={past || undefined}
      data-exception={exception?.kind}
      data-troop={info.patrols.length === 0 || undefined}
      aria-label={spokenName(info)}
      onClick={() => onSelect?.(entry.event_id)}
    >
      {children}
    </button>
  );
}

/** A1 · Staða: the state is the first thing you read; the flokkur is a small initial. */
function StadaElement(props: ElementProps) {
  const { info } = props;
  const cancelled = info.exception?.kind === "cancelled";
  const Glyph = cancelled ? Ban : info.past ? Check : STATUS_GLYPH[info.entry.status];
  const word = cancelled ? "Fellur niður" : info.past ? "Lokið" : STATUS_LABEL[info.entry.status];
  return (
    <ElementButton {...props} className={styles.stada}>
      <span className={styles.stState} aria-hidden="true">
        {Glyph === "?" ? <b className={styles.q}>?</b> : <Glyph />}
        {word}
        <EndurmatMark info={info} />
      </span>
      <span className={styles.elTitle}>{info.entry.title}</span>
      {!cancelled && <ExceptionFlag info={info} />}
      <span className={styles.meta} aria-hidden="true">
        <PatrolChips info={info} />
        {!info.past && !cancelled && info.items > 0 && (
          <span>
            {info.decided}/{info.items} liðir
          </span>
        )}
        {!info.past && !cancelled && <Minutes info={info} />}
      </span>
    </ElementButton>
  );
}

/** A2 · Merki: a patch sewn on once decided, outlined while in drög, an empty ring while "?". */
function MerkiElement(props: ElementProps) {
  const { info } = props;
  const cancelled = info.exception?.kind === "cancelled";
  const Icon = TYPE_ICON[info.entry.type];
  const fill = cancelled
    ? "cancelled"
    : info.past || info.entry.status === "confirmed"
      ? "sewn"
      : info.entry.status === "unknown"
        ? "empty"
        : "outline";
  const sub = cancelled ? "Fellur niður" : info.past ? "Lokið" : STATUS_LABEL[info.entry.status];
  return (
    <ElementButton {...props} className={styles.merki}>
      <span className={styles.patch} data-fill={fill} aria-hidden="true">
        {fill === "empty" ? <b className={styles.q}>?</b> : <Icon />}
      </span>
      <span className={styles.mkText} aria-hidden="true">
        <span className={styles.elTitle}>{info.entry.title}</span>
        <span className={styles.mkSub}>
          {sub}
          <EndurmatMark info={info} />
        </span>
        {!cancelled && <ExceptionFlag info={info} />}
      </span>
    </ElementButton>
  );
}

/** How big the fire is: 0 kindling only, 1 a small flame, 2 burning, 3 everything decided. */
function fireLevel(info: EntryInfo): number {
  if (!info.items || info.decided === 0) return 0;
  if (info.decided >= info.items) return 3;
  return info.decided / info.items < 0.5 ? 1 : 2;
}

/** A3 · Varðeldur: the fire grows as liðir are decided; a tally and the minutes say exactly. */
function VardeldurElement(props: ElementProps) {
  const { info } = props;
  const cancelled = info.exception?.kind === "cancelled";
  const level = cancelled ? 0 : info.past ? 3 : fireLevel(info);
  const Fire = level === 0 ? FlameKindling : Flame;
  return (
    <ElementButton {...props} className={styles.vardeldur}>
      <span className={styles.fire} data-level={level} aria-hidden="true">
        <Fire />
      </span>
      <span className={styles.vdText} aria-hidden="true">
        <span className={styles.elTitle}>{info.entry.title}</span>
        {cancelled ? (
          <span className={styles.flag} data-kind="cancelled">
            <Ban aria-hidden="true" /> Fellur niður
          </span>
        ) : (
          <>
            <ExceptionFlag info={info} />
            <span className={styles.meta}>
              <PatrolChips info={info} />
              {!info.past && info.items > 0 && (
                <span className={styles.tally}>
                  {Array.from({ length: info.items }, (_, i) => (
                    <i key={i} data-on={i < info.decided || undefined} />
                  ))}
                </span>
              )}
              {!info.past && <Minutes info={info} />}
              <EndurmatMark info={info} />
            </span>
          </>
        )}
      </span>
    </ElementButton>
  );
}

/** A4 · Stimpill: stamped once it's ready (or done); a dotted empty stamp until then. */
function StimpillElement(props: ElementProps) {
  const { info } = props;
  const cancelled = info.exception?.kind === "cancelled";
  const ready = info.past || (info.entry.status === "confirmed" && info.decided >= info.items);
  const left = Math.max(0, info.items - info.decided);
  const word = cancelled ? "Fellur niður" : info.past ? "Lokið" : ready ? "Klárt" : null;
  return (
    <ElementButton
      {...props}
      className={`${styles.stimpill} ${ready || cancelled ? styles.stamped : styles.unstamped}`}
    >
      {word && (
        <span className={styles.stampWord} aria-hidden="true">
          {cancelled ? <Ban /> : <Check />}
          {word}
        </span>
      )}
      <span className={styles.elTitle} aria-hidden="true">
        {info.entry.title}
      </span>
      {!cancelled && <ExceptionFlag info={info} />}
      <span className={styles.meta} aria-hidden="true">
        <PatrolChips info={info} />
        {!ready && !cancelled && (
          <span>
            {info.entry.status === "unknown" && info.decided === 0
              ? "Óákveðið"
              : `${countIs(left, "liður", "liðir")} eftir`}
          </span>
        )}
        <EndurmatMark info={info} />
      </span>
    </ElementButton>
  );
}

const ELEMENT: Record<Exclude<FundurLook, "chip">, (p: ElementProps) => ReactNode> = {
  stada: StadaElement,
  merki: MerkiElement,
  vardeldur: VardeldurElement,
  stimpill: StimpillElement,
};

/** One fundur in the given look. `chip` is today's PlanEntryChip. */
export function FundurElement({
  look,
  info,
  onSelect,
}: {
  look: FundurLook;
  info: EntryInfo;
  onSelect?: (eventId: string) => void;
}) {
  if (look === "chip") {
    const first = info.patrols[0];
    return (
      <PlanEntryChip
        entry={info.entry}
        patrol={first?.patrol}
        patrolIndex={first?.index ?? 0}
        meta="budget"
        isTroopWide={!first}
        onSelect={onSelect}
      />
    );
  }
  const Element = ELEMENT[look];
  return <Element info={info} onSelect={onSelect} />;
}

/* ── Deriving entry info for a season ──────────────────────────────────────── */

/** Every entry's info, keyed by event id. */
export function entryInfos(season: LabSeason): Map<string, EntryInfo> {
  const { grid, sides } = season;
  const slots = usualSlots(grid);
  const withEndurmat = new Set(
    Object.values(sides).flatMap((s) => s.endurmat.map((e) => e.fundurId))
  );
  const weekByIndex = new Map(grid.weeks.map((w) => [w.index, w]));
  const infos = new Map<string, EntryInfo>();

  const add = (entry: LabCell | LabBand, patrols: EntryInfo["patrols"], usual?: UsualSlot) => {
    const week = weekByIndex.get(entry.week_index);
    const actual = entry.actual_minutes ?? 0;
    const planned = entry.planned_minutes ?? 0;
    infos.set(entry.event_id, {
      entry,
      patrols,
      exception: exceptionOf(entry, usual),
      past: week ? isWeekDone(week, LAB_TODAY) : false,
      hasEndurmat: withEndurmat.has(entry.event_id),
      decided: entry.decided_count ?? 0,
      items: entry.item_count ?? 0,
      over: planned && planned <= 600 && actual > planned ? actual - planned : 0,
    });
  };

  for (const band of grid.bands) add(band, []);
  for (const cell of grid.cells) {
    const index = grid.patrols.findIndex((p) => p.id === cell.patrol_id);
    const patrols = grid.patrols
      .slice(index, index + (cell.span_patrols ?? 1))
      .map((patrol, i) => ({ patrol, index: index + i }));
    add(cell, patrols, slots.get(cell.patrol_id));
  }
  return infos;
}

/* ── State ─────────────────────────────────────────────────────────────────── */

interface WeekModel {
  week: PlanWeek;
  side: WeekSide;
  gear: GatheredGear[];
  stateOf: (itemId: string) => GearState;
  setState: (itemId: string, state: GearState) => void;
  vantar: number;
}

/* ── Root ──────────────────────────────────────────────────────────────────── */

export default function PlanGridLab({
  look,
  season,
  onOpenLidur,
  onSelectEvent,
}: PlanGridLabProps) {
  const [gearState, setGearState] = useState(season.initialState);
  const [announcement, setAnnouncement] = useState("");
  const infos = useMemo(() => entryInfos(season), [season]);
  const slots = useMemo(() => usualSlots(season.grid), [season]);

  const models = useMemo(() => {
    const map = new Map<number, WeekModel>();
    for (const week of season.grid.weeks) {
      const side = season.sides[week.index] ?? { endurmat: [], gear: [] };
      const gear = gatherGear(side.gear, GEAR);
      const stateOf = (itemId: string): GearState => gearState[week.index]?.[itemId] ?? "ovist";
      map.set(week.index, {
        week,
        side,
        gear,
        stateOf,
        vantar: gear.filter((g) => stateOf(g.item.id) === "vantar").length,
        setState: (itemId, state) => {
          setGearState((prev) => ({
            ...prev,
            [week.index]: { ...prev[week.index], [itemId]: state },
          }));
          const item = gear.find((g) => g.item.id === itemId);
          if (item) setAnnouncement(`${gearLabel(item)}: ${STATE_LABEL[state].toLowerCase()}`);
        },
      });
    }
    return map;
  }, [season, gearState]);

  return (
    <div className={styles.root} data-look={look}>
      <LabGrid
        grid={season.grid}
        slots={slots}
        renderEntry={(id) => {
          const info = infos.get(id);
          return info ? <FundurElement look={look} info={info} onSelect={onSelectEvent} /> : null;
        }}
        renderSide={(week) => {
          const m = models.get(week.index) as WeekModel;
          return (
            <>
              <td className={styles.side}>
                {m.side.endurmat.length ? (
                  <EndurmatList
                    items={m.side.endurmat}
                    patrols={season.grid.patrols}
                    onOpenLidur={onOpenLidur}
                  />
                ) : (
                  <Nothing />
                )}
              </td>
              <td className={styles.side}>
                {m.gear.length ? <GearChecklist look={look} model={m} /> : <Nothing />}
              </td>
            </>
          );
        }}
      />
      <p role="status" className={styles.srOnly}>
        {announcement}
      </p>
    </div>
  );
}

/* ── The grid ──────────────────────────────────────────────────────────────── */

/**
 * A faithful copy of PlanGrid's table: the same classes, the same band/cell spanning and
 * clipping. Two additions: the flokkur's usual evening under its name, and a joint event of
 * adjacent flokkar spanning their columns (`span_patrols`). The "swallowed cell" notice is left
 * out; the fixtures never trigger it.
 */
function LabGrid({
  grid,
  slots,
  renderEntry,
  renderSide,
}: {
  grid: LabGridData;
  slots: Map<string, UsualSlot>;
  renderEntry: (eventId: string) => ReactNode;
  renderSide: (week: PlanWeek) => ReactNode;
}) {
  const { patrols, weeks } = grid;
  const layout = useMemo(() => spanLayout(grid), [grid]);

  const weekHead = (week: PlanWeek) => (
    <th scope="row" className={`${gridStyles.weekHead} ${styles.weekHead}`}>
      <span className={gridStyles.weekHeadInner}>
        <b>{week.label}</b>
        {week.starts_on && <span>{weekDate(week)}</span>}
      </span>
    </th>
  );

  return (
    <div className={`${gridStyles.rist} ${styles.rist}`}>
      <div className={gridStyles.scroll}>
        <table className={`${gridStyles.table} ${styles.table}`}>
          <caption className={gridStyles.caption}>
            Dagskrárhringur — vikur niður, flokkar til hliðar. Sveitarbönd spanna alla flokka.
          </caption>
          <thead>
            <tr>
              <th scope="col" className={`${gridStyles.cornerHead} ${styles.cornerHead}`}>
                Vika
              </th>
              {patrols.map((patrol, i) => {
                const slot = slots.get(patrol.id);
                return (
                  <th key={patrol.id} scope="col" className={gridStyles.patrolHead}>
                    <span className={gridStyles.flokk}>
                      <i
                        aria-hidden="true"
                        style={{ ["--c" as string]: accentVarFor(patrol, i) }}
                      />
                      {patrol.name}
                    </span>
                    {slot && (
                      <span className={styles.usual}>
                        <span className={styles.srOnly}>, venjulega </span>
                        {slotText(slot)}
                      </span>
                    )}
                  </th>
                );
              })}
              <th scope="col" className={`${gridStyles.utilHead} ${styles.sideHead}`}>
                Endurmat
              </th>
              <th scope="col" className={`${gridStyles.utilHead} ${styles.sideHead}`}>
                Búnaður
              </th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => {
              const band = layout.bandStart.get(week.index);
              if (band) {
                return (
                  <tr key={week.index}>
                    {weekHead(week)}
                    <td
                      colSpan={patrols.length}
                      rowSpan={layout.bandSpan.get(week.index) ?? 1}
                      className={`${gridStyles.bandCell} ${styles.cell}`}
                    >
                      {renderEntry(band.event_id)}
                    </td>
                    {renderSide(week)}
                  </tr>
                );
              }
              if (layout.bandWeeks.has(week.index)) {
                return (
                  <tr key={week.index}>
                    {weekHead(week)}
                    {renderSide(week)}
                  </tr>
                );
              }
              return (
                <tr key={week.index}>
                  {weekHead(week)}
                  {patrols.map((patrol) => {
                    const key = cellKey(week.index, patrol.id);
                    if (layout.covered.has(key)) return null;
                    const placed = layout.placed.get(key);
                    return (
                      <td
                        key={patrol.id}
                        className={`${gridStyles.cell} ${styles.cell}`}
                        rowSpan={placed && placed.span > 1 ? placed.span : undefined}
                        colSpan={placed && placed.cols > 1 ? placed.cols : undefined}
                      >
                        {placed ? renderEntry(placed.cell.event_id) : <Nothing />}
                      </td>
                    );
                  })}
                  {renderSide(week)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** PlanGrid's spanning rules, condensed, plus column spans for joint events. */
function spanLayout(grid: LabGridData) {
  const { weeks, bands, cells, patrols } = grid;
  const lastWeek = weeks.length ? weeks[weeks.length - 1].index : 0;
  const clip = (start: number, wanted: number, blockers: Set<number>) => {
    const capped = Math.min(Math.max(1, wanted), Math.max(1, lastWeek - start + 1));
    for (let offset = 1; offset < capped; offset++) if (blockers.has(start + offset)) return offset;
    return capped;
  };

  const bandStart = new Map(bands.map((b) => [b.week_index, b]));
  const bandSpan = new Map<number, number>();
  const bandWeeks = new Set<number>();
  for (const [week, band] of bandStart) {
    const span = clip(
      week,
      band.span_weeks,
      new Set([...bandStart.keys()].filter((w) => w !== week))
    );
    bandSpan.set(week, span);
    for (let o = 0; o < span; o++) bandWeeks.add(week + o);
  }

  const placed = new Map<string, { cell: LabCell; span: number; cols: number }>();
  const covered = new Set<string>();
  for (const cell of [...cells].sort((a, b) => a.week_index - b.week_index)) {
    const key = cellKey(cell.week_index, cell.patrol_id);
    if (bandWeeks.has(cell.week_index) || placed.has(key) || covered.has(key)) continue;
    const blockers = new Set([
      ...cells.filter((c) => c.patrol_id === cell.patrol_id && c !== cell).map((c) => c.week_index),
      ...bandWeeks,
    ]);
    const span = clip(cell.week_index, cell.span_weeks, blockers);
    const col = patrols.findIndex((p) => p.id === cell.patrol_id);
    const cols = Math.max(1, Math.min(cell.span_patrols ?? 1, patrols.length - col));
    placed.set(key, { cell, span, cols });
    for (let o = 0; o < span; o++) {
      for (let c = 0; c < cols; c++) {
        if (o === 0 && c === 0) continue;
        covered.add(cellKey(cell.week_index + o, patrols[col + c].id));
      }
    }
  }
  return { bandStart, bandSpan, bandWeeks, placed, covered };
}

function Nothing() {
  return (
    <span className={styles.none}>
      <span aria-hidden="true">—</span>
      <span className={styles.srOnly}>Ekkert</span>
    </span>
  );
}

/* ── Endurmat ──────────────────────────────────────────────────────────────── */

function EndurmatList({
  items,
  patrols,
  onOpenLidur,
  max = 2,
}: {
  items: LabEndurmat[];
  patrols: Patrol[];
  onOpenLidur?: (lidurId: string) => void;
  /** Show this many, and the rest behind "+ N í viðbót". */
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const shown = open ? items : items.slice(0, max);
  const rest = items.length - shown.length;

  return (
    <div className={styles.endurmat}>
      {items.length > 1 && (
        <p className={styles.cellHead}>
          <MessageSquareText aria-hidden="true" />
          {countIs(items.length, "endurmat", "endurmöt")}
        </p>
      )}
      <ul className={styles.notes} id={listId}>
        {shown.map((note) => {
          const Tone = note.tone === "positive" ? ThumbsUp : Wrench;
          const index = patrols.findIndex((p) => p.id === note.patrolId);
          const patrol = patrols[index];
          return (
            <li key={note.id} className={styles.note} data-tone={note.tone}>
              <span className={styles.noteKind}>
                <span
                  className={styles.chip}
                  aria-hidden="true"
                  style={
                    patrol
                      ? ({
                          "--pc": accentVarFor(patrol, index),
                          "--pc-fg": accentVarFor(patrol, index).replace(/\)$/, "-foreground)"),
                        } as CSSProperties)
                      : undefined
                  }
                >
                  {patrolInitial(patrol)}
                </span>
                <span className={styles.srOnly}>{patrol?.name ?? "Öll sveitin"}: </span>
                <Tone aria-hidden="true" />
                {TONE_LABEL[note.tone]}
              </span>
              <button
                type="button"
                className={styles.lidurLink}
                onClick={() => onOpenLidur?.(note.lidurId)}
                aria-label={`Opna ${note.lidurName} á bekknum`}
              >
                {note.lidurName}
              </button>
              <q className={styles.quote}>{note.text}</q>
            </li>
          );
        })}
      </ul>
      {items.length > max && (
        <button
          type="button"
          className={styles.more}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Sýna færri" : `+ ${rest} í viðbót`}
        </button>
      )}
    </div>
  );
}

/* ── Búnaður ───────────────────────────────────────────────────────────────── */

/**
 * The count above the list, in each look's own language. Every form also says it in words
 * for a screen reader: "Vantar 3 hluti".
 */
function KitSummary({
  look,
  gear,
  stateOf,
}: {
  look: FundurLook;
  gear: GatheredGear[];
  stateOf: (id: string) => GearState;
}) {
  const vantar = gear.filter((g) => stateOf(g.item.id) === "vantar").length;
  const owned = gear.filter((g) => stateOf(g.item.id) === "eigum").length;
  const all = owned === gear.length;
  const spoken = all
    ? "Allt til"
    : `${vantar ? `Vantar ${countIs(vantar, "hlut", "hluti")}. ` : ""}${owned} af ${gear.length} til`;

  let visual: ReactNode;
  if (look === "vardeldur") {
    visual = (
      <>
        <span className={styles.kitTally}>
          {sortGear(gear, stateOf).map((g) => (
            <i key={g.item.id} data-state={stateOf(g.item.id)} />
          ))}
        </span>
        <span>
          {owned}/{gear.length} til
        </span>
        {vantar > 0 && <span className={styles.badge}>{vantar} vantar</span>}
      </>
    );
  } else if (look === "stimpill") {
    visual = all ? (
      <span className={styles.kitStamp}>
        <Check /> Allt til
      </span>
    ) : (
      <span className={styles.kitSlot}>
        {vantar > 0 ? `${vantar} vantar` : `${owned}/${gear.length} til`}
      </span>
    );
  } else if (look === "merki") {
    visual = all ? (
      <span className={styles.badgeOk}>
        <Check /> Allt til
      </span>
    ) : vantar > 0 ? (
      <span className={styles.kitPatch}>
        <b>{vantar}</b> vantar
      </span>
    ) : null;
  } else {
    visual = all ? (
      <span className={styles.badgeOk}>
        <Check /> Allt til
      </span>
    ) : vantar > 0 ? (
      <span className={styles.badge}>
        {look === "stada" && <X />}
        {vantar} vantar
      </span>
    ) : null;
  }

  return (
    <p className={styles.cellHead}>
      <Backpack aria-hidden="true" />
      <span aria-hidden="true" className={styles.kitVisual}>
        {visual}
      </span>
      <span className={styles.srOnly}>{spoken}</span>
    </p>
  );
}

/**
 * The week's equipment, gathered from its liðir. A tick means "eigum"; unticked means vantar,
 * and óvíst is the checkbox's mixed state. Vantar floats to the top when the list opens, and
 * what the sveit already had folds away; neither moves while you tick.
 */
function GearChecklist({ look, model }: { look: FundurLook; model: WeekModel }) {
  const { gear, stateOf, setState } = model;
  const [order] = useState(() => sortGear(gear, stateOf).map((g) => g.item.id));
  const [ownedAtOpen] = useState(
    () => new Set(gear.filter((g) => stateOf(g.item.id) === "eigum").map((g) => g.item.id))
  );
  const [showOwned, setShowOwned] = useState(false);
  const listId = useId();
  const byId = new Map(gear.map((g) => [g.item.id, g]));
  const rows = [
    ...order.map((id) => byId.get(id)).filter((g): g is GatheredGear => !!g),
    ...gear.filter((g) => !order.includes(g.item.id)),
  ];
  const visible = showOwned ? rows : rows.filter((g) => !ownedAtOpen.has(g.item.id));

  return (
    <div className={styles.gear}>
      <KitSummary look={look} gear={gear} stateOf={stateOf} />
      <ul className={styles.gearList} id={listId}>
        {visible.map((g) => (
          <GearRow
            key={g.item.id}
            gear={g}
            state={stateOf(g.item.id)}
            onChange={(s) => setState(g.item.id, s)}
          />
        ))}
      </ul>
      {ownedAtOpen.size > 0 && (
        <button
          type="button"
          className={styles.more}
          aria-expanded={showOwned}
          aria-controls={listId}
          onClick={() => setShowOwned((v) => !v)}
        >
          {showOwned
            ? "Fela það sem við eigum"
            : `Sýna ${countIs(ownedAtOpen.size, "hlut", "hluti")} sem við eigum`}
        </button>
      )}
    </div>
  );
}

function GearRow({
  gear,
  state,
  onChange,
}: {
  gear: GatheredGear;
  state: GearState;
  onChange: (state: GearState) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const label = gearLabel(gear);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "ovist";
  }, [state]);
  const whoId = useId();
  const who = gear.sources.map((s) => s.lidurName).join(", ");

  return (
    <li className={styles.gearRow} data-state={state}>
      <span id={whoId} className={styles.srOnly}>
        Fyrir: {who}
      </span>
      <label className={styles.check}>
        <input
          ref={ref}
          type="checkbox"
          checked={state === "eigum"}
          aria-label={`Eigum ${label}`}
          aria-describedby={whoId}
          onChange={(e) => onChange(e.target.checked ? "eigum" : "vantar")}
        />
        <span aria-hidden="true" className={styles.checkText}>
          {label}
          {state !== "eigum" && (
            <em className={styles.stateWord}>{state === "vantar" ? "vantar" : "óvíst"}</em>
          )}
        </span>
      </label>
    </li>
  );
}

/** The close-up: one week's checklist on its own. */
export function GearChecklistCloseUp({
  season,
  week: weekIndex,
  look = "stada",
}: {
  season: LabSeason;
  week: number;
  look?: FundurLook;
}) {
  const [state, setState] = useState(season.initialState[weekIndex] ?? {});
  const [announcement, setAnnouncement] = useState("");
  const week = season.grid.weeks.find((w) => w.index === weekIndex) as PlanWeek;
  const side = season.sides[weekIndex];
  const gear = gatherGear(side.gear, GEAR);
  const stateOf = (id: string): GearState => state[id] ?? "ovist";
  const m: WeekModel = {
    week,
    side,
    gear,
    stateOf,
    vantar: gear.filter((g) => stateOf(g.item.id) === "vantar").length,
    setState: (id, s) => {
      setState((prev) => ({ ...prev, [id]: s }));
      const item = gear.find((g) => g.item.id === id);
      if (item) setAnnouncement(`${gearLabel(item)}: ${STATE_LABEL[s].toLowerCase()}`);
    },
  };
  return (
    <div className={`${styles.root} ${styles.closeUp}`} data-look={look}>
      <h2 className={styles.closeHead}>
        Búnaður · {week.label}
        <span>{weekDate(week)}</span>
      </h2>
      <GearChecklist look={look} model={m} />
      <p role="status" className={styles.srOnly}>
        {announcement}
      </p>
    </div>
  );
}

/** The cell states story: one look's element for a chosen set of fundir, each in a cell-sized box. */
export function ElementStates({
  look,
  season,
  ids,
}: {
  look: FundurLook;
  season: LabSeason;
  ids: { id: string; label: string }[];
}) {
  const infos = useMemo(() => entryInfos(season), [season]);
  return (
    <ul className={`${styles.root} ${styles.states}`} data-look={look}>
      {ids.map(({ id, label }) => {
        const info = infos.get(id);
        return (
          <li key={id} className={styles.stateCell}>
            <span className={styles.stateLabel}>{label}</span>
            {info && <FundurElement look={look} info={info} />}
          </li>
        );
      })}
    </ul>
  );
}
