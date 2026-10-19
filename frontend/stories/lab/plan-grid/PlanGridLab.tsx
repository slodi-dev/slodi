import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Backpack,
  Check,
  ChevronDown,
  CircleHelp,
  MessageSquareText,
  Pin,
  ThumbsUp,
  Wrench,
  X,
} from "lucide-react";
import Modal from "@/components/Modal/Modal";
import PlanEntryChip from "@/components/plan/PlanEntryChip";
import gridStyles from "@/components/plan/PlanGrid.module.css";
import { accentVarFor, parseWeekStart } from "@/components/plan/planEntries";
import {
  cellKey,
  type PlanBand,
  type PlanCell,
  type PlanGrid,
  type PlanWeek,
} from "@/services/plan.service";
import { countIs, formatIcelandicDateShort } from "@/lib/format";
import {
  GEAR,
  gatherGear,
  sortGear,
  type GatheredGear,
  type GearState,
  type LabEndurmat,
  type LabReminder,
  type LabSeason,
  type WeekSide,
} from "./planGridLabData";
import styles from "./PlanGridLab.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────── */

/**
 * - `dalkar`: A · two columns, re-sourced: Endurmat and Búnaður.
 * - `minnismidi`: B · ATH holds reminders and endurmat; Búnaður has a three-way state per item.
 * - `vikan`: C · one quiet "Vikan" cell with counts; the details open in a dialog.
 * - `spjald`: D · the same cell picks a week; a docked panel beside the grid holds the details.
 */
export type PlanGridLook = "dalkar" | "minnismidi" | "vikan" | "spjald";

export interface PlanGridLabProps {
  look: PlanGridLook;
  season: LabSeason;
  /** Opens a liður on the bench. The real app would navigate to `/plan/bekkur#<lidurId>`. */
  onOpenLidur?: (lidurId: string) => void;
  onSelectEvent?: (eventId: string) => void;
  /** C and D: the week open at first. */
  defaultWeek?: number;
}

/* ── Copy ──────────────────────────────────────────────────────────────────── */

const STATES: GearState[] = ["eigum", "vantar", "ovist"];
const STATE_LABEL: Record<GearState, string> = { eigum: "Eigum", vantar: "Vantar", ovist: "Óvíst" };
const STATE_ICON: Record<GearState, typeof Check> = { eigum: Check, vantar: X, ovist: CircleHelp };
const NEXT_STATE: Record<GearState, GearState> = {
  vantar: "eigum",
  eigum: "ovist",
  ovist: "vantar",
};
const TONE_LABEL = { positive: "Gekk vel", corrective: "Laga næst" } as const;

/** `Vasaljós ×12`, `Eldsneyti · 4 brúsar`, `Sjúkrakassi`. */
export function gearLabel({ item, qty }: GatheredGear): string {
  if (item.consumable && item.unit)
    return `${item.name} · ${countIs(qty, item.unit[0], item.unit[1])}`;
  return qty > 1 ? `${item.name} ×${qty}` : item.name;
}

/** An ISO date (`YYYY-MM-DD`) as a local day, so it doesn't move west of UTC. */
function localDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function weekDate(week: PlanWeek): string {
  const start = parseWeekStart(week);
  return start ? formatIcelandicDateShort(start) : "";
}

const vantarName = (n: number) => `Vantar ${countIs(n, "hlut", "hluti")}`;

/* ── State ─────────────────────────────────────────────────────────────────── */

type GearStateMap = Record<number, Record<string, GearState>>;

interface WeekModel {
  week: PlanWeek;
  side: WeekSide;
  reminders: LabReminder[];
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
  defaultWeek,
}: PlanGridLabProps) {
  const [gearState, setGearState] = useState<GearStateMap>(season.initialState);
  const [addedReminders, setAddedReminders] = useState<Record<number, LabReminder[]>>({});
  const [announcement, setAnnouncement] = useState("");

  const models = useMemo(() => {
    const map = new Map<number, WeekModel>();
    for (const week of season.grid.weeks) {
      const side = season.sides[week.index] ?? { endurmat: [], reminders: [], gear: [] };
      const gear = gatherGear(side.gear, GEAR);
      const stateOf = (itemId: string): GearState => gearState[week.index]?.[itemId] ?? "ovist";
      map.set(week.index, {
        week,
        side,
        reminders: [...side.reminders, ...(addedReminders[week.index] ?? [])],
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
  }, [season, gearState, addedReminders]);

  const addReminder = (weekIndex: number, text: string, dueOn: string | null) => {
    setAddedReminders((prev) => ({
      ...prev,
      [weekIndex]: [
        ...(prev[weekIndex] ?? []),
        { id: `new-${weekIndex}-${(prev[weekIndex] ?? []).length}`, text, dueOn, by: "Þú" },
      ],
    }));
    setAnnouncement(`Minnismiða bætt við viku ${weekIndex}`);
  };

  const model = (week: PlanWeek) => models.get(week.index) as WeekModel;

  let body: ReactNode;
  if (look === "dalkar") {
    body = (
      <LabGrid
        grid={season.grid}
        onSelectEvent={onSelectEvent}
        sideHeads={["Endurmat", "Búnaður"]}
        sideClass={styles.sideWide}
        renderSide={(week) => {
          const m = model(week);
          return (
            <>
              <td className={styles.side}>
                {m.side.endurmat.length ? (
                  <EndurmatList items={m.side.endurmat} max={2} onOpenLidur={onOpenLidur} />
                ) : (
                  <Nothing />
                )}
              </td>
              <td className={styles.side}>
                {m.gear.length ? <GearChecklist model={m} variant="check" /> : <Nothing />}
              </td>
            </>
          );
        }}
      />
    );
  } else if (look === "minnismidi") {
    body = (
      <LabGrid
        grid={season.grid}
        onSelectEvent={onSelectEvent}
        sideHeads={["ATH", "Búnaður"]}
        sideClass={styles.sideWide}
        renderSide={(week) => {
          const m = model(week);
          const any = m.reminders.length + m.side.endurmat.length > 0;
          return (
            <>
              <td className={styles.side}>
                {any ? (
                  <div className={styles.stack}>
                    {m.reminders.length > 0 && <ReminderList items={m.reminders} compact />}
                    {m.side.endurmat.length > 0 && (
                      <EndurmatList
                        items={m.side.endurmat}
                        max={1}
                        onOpenLidur={onOpenLidur}
                        labelled
                      />
                    )}
                  </div>
                ) : (
                  <Nothing />
                )}
              </td>
              <td className={styles.side}>
                {m.gear.length ? <GearChecklist model={m} variant="cycle" /> : <Nothing />}
              </td>
            </>
          );
        }}
      />
    );
  } else if (look === "vikan") {
    body = (
      <VikanLook
        season={season}
        model={model}
        defaultWeek={defaultWeek}
        onOpenLidur={onOpenLidur}
        onSelectEvent={onSelectEvent}
      />
    );
  } else {
    body = (
      <SpjaldLook
        season={season}
        model={model}
        defaultWeek={defaultWeek}
        onOpenLidur={onOpenLidur}
        onSelectEvent={onSelectEvent}
        onAddReminder={addReminder}
      />
    );
  }

  return (
    <div className={styles.root} data-look={look}>
      {body}
      <p role="status" className={styles.srOnly}>
        {announcement}
      </p>
    </div>
  );
}

/* ── The grid ──────────────────────────────────────────────────────────────── */

/**
 * A faithful copy of PlanGrid's table: the same classes, the same band/cell spanning and
 * clipping, the real PlanEntryChip. Only the side columns are swapped. It leaves out the
 * "swallowed cell" notice, which the lab fixtures never trigger.
 */
function LabGrid({
  grid,
  sideHeads,
  sideClass,
  renderSide,
  onSelectEvent,
}: {
  grid: PlanGrid;
  sideHeads: string[];
  sideClass: string;
  renderSide: (week: PlanWeek) => ReactNode;
  onSelectEvent?: (eventId: string) => void;
}) {
  const { patrols, weeks, bands, cells } = grid;
  const layout = useMemo(() => spanLayout(weeks, bands, cells), [weeks, bands, cells]);

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
              {patrols.map((patrol, i) => (
                <th key={patrol.id} scope="col" className={gridStyles.patrolHead}>
                  <span className={gridStyles.flokk}>
                    <i aria-hidden="true" style={{ ["--c" as string]: accentVarFor(patrol, i) }} />
                    {patrol.name}
                  </span>
                </th>
              ))}
              {sideHeads.map((head) => (
                <th
                  key={head}
                  scope="col"
                  className={`${gridStyles.utilHead} ${styles.sideHead} ${sideClass}`}
                >
                  {head}
                </th>
              ))}
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
                      className={gridStyles.bandCell}
                    >
                      <PlanEntryChip
                        entry={band}
                        meta="budget"
                        isTroopWide
                        onSelect={onSelectEvent}
                      />
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
                  {patrols.map((patrol, i) => {
                    const key = cellKey(week.index, patrol.id);
                    if (layout.covered.has(key)) return null;
                    const entry = layout.placed.get(key);
                    return (
                      <td
                        key={patrol.id}
                        className={gridStyles.cell}
                        rowSpan={entry && entry.span > 1 ? entry.span : undefined}
                      >
                        {entry ? (
                          <PlanEntryChip
                            entry={entry.cell}
                            patrol={patrol}
                            patrolIndex={i}
                            meta="budget"
                            onSelect={onSelectEvent}
                          />
                        ) : (
                          <Nothing />
                        )}
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

/** PlanGrid's spanning rules, condensed: bands clip at the next band, cells at the next cell or band. */
function spanLayout(weeks: PlanWeek[], bands: PlanBand[], cells: PlanCell[]) {
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

  const placed = new Map<string, { cell: PlanCell; span: number }>();
  const covered = new Set<string>();
  for (const cell of [...cells].sort((a, b) => a.week_index - b.week_index)) {
    const key = cellKey(cell.week_index, cell.patrol_id);
    if (bandWeeks.has(cell.week_index) || placed.has(key) || covered.has(key)) continue;
    const blockers = new Set([
      ...cells.filter((c) => c.patrol_id === cell.patrol_id && c !== cell).map((c) => c.week_index),
      ...bandWeeks,
    ]);
    const span = clip(cell.week_index, cell.span_weeks, blockers);
    placed.set(key, { cell, span });
    for (let o = 1; o < span; o++) covered.add(cellKey(cell.week_index + o, cell.patrol_id));
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
  max,
  onOpenLidur,
  labelled,
}: {
  items: LabEndurmat[];
  /** Show this many, and the rest behind "+ N í viðbót". */
  max?: number;
  onOpenLidur?: (lidurId: string) => void;
  /** B: always head the list with "N endurmat", to tell it from the reminders by word and icon. */
  labelled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const shown = max && !open ? items.slice(0, max) : items;
  const rest = items.length - shown.length;

  return (
    <div className={styles.endurmat}>
      {max !== undefined && (labelled || items.length > 1) && (
        <p className={styles.cellHead}>
          <MessageSquareText aria-hidden="true" />
          {countIs(items.length, "endurmat", "endurmöt")}
        </p>
      )}
      <ul className={styles.notes} id={listId}>
        {shown.map((note) => {
          const Tone = note.tone === "positive" ? ThumbsUp : Wrench;
          return (
            <li key={note.id} className={styles.note} data-tone={note.tone}>
              <span className={styles.noteKind}>
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
              {max === undefined && (
                <span className={styles.byline}>
                  {note.by}, {formatIcelandicDateShort(localDay(note.writtenOn))} ·{" "}
                  {note.fundurTitle}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {(rest > 0 || open) && max !== undefined && items.length > max && (
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

/* ── Reminders ─────────────────────────────────────────────────────────────── */

function ReminderList({ items, compact }: { items: LabReminder[]; compact?: boolean }) {
  return (
    <ul className={styles.notes}>
      {items.map((r) => (
        <li key={r.id} className={styles.reminder}>
          {/* In a cell each reminder says "Muna"; under the dialog's "Muna" heading it doesn't. */}
          {compact ? (
            <span className={styles.noteKind}>
              <Pin aria-hidden="true" />
              Muna
              {r.dueOn && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>fyrir {formatIcelandicDateShort(localDay(r.dueOn))}</span>
                </>
              )}
            </span>
          ) : (
            r.dueOn && (
              <span className={styles.noteKind}>
                Fyrir {formatIcelandicDateShort(localDay(r.dueOn))}
              </span>
            )
          )}
          <span className={styles.reminderText}>{r.text}</span>
          {!compact && <span className={styles.byline}>{r.by}</span>}
        </li>
      ))}
    </ul>
  );
}

/* ── Búnaður ───────────────────────────────────────────────────────────────── */

export type GearVariant = "check" | "cycle" | "radio";

/**
 * The week's equipment, gathered from its liðir. Vantar floats to the top when the list
 * opens; it doesn't re-sort while you tick, so an item never jumps out from under a finger.
 */
function GearChecklist({ model, variant }: { model: WeekModel; variant: GearVariant }) {
  const { gear, stateOf, setState, vantar } = model;
  const [order] = useState(() => sortGear(gear, stateOf).map((g) => g.item.id));
  const byId = new Map(gear.map((g) => [g.item.id, g]));
  const rows = [
    ...order.map((id) => byId.get(id)).filter((g): g is GatheredGear => !!g),
    ...gear.filter((g) => !order.includes(g.item.id)),
  ];
  const allOwned = gear.length > 0 && gear.every((g) => stateOf(g.item.id) === "eigum");
  const wide = variant === "radio";
  // In a grid cell, what the sveit already had when the list opened folds away, so a row
  // grows with what is still open rather than with the whole list.
  const [ownedAtOpen] = useState(
    () =>
      new Set(wide ? [] : gear.filter((g) => stateOf(g.item.id) === "eigum").map((g) => g.item.id))
  );
  const [showOwned, setShowOwned] = useState(false);
  const listId = useId();
  const visible = showOwned ? rows : rows.filter((g) => !ownedAtOpen.has(g.item.id));

  return (
    <div className={styles.gear} data-variant={variant}>
      <p className={styles.cellHead}>
        {!wide && <Backpack aria-hidden="true" />}
        {wide && <span>{countIs(gear.length, "hlutur", "hlutir")}</span>}
        {vantar > 0 && (
          <span className={styles.badge} data-testid="vantar-badge">
            <span aria-hidden="true">{vantar} vantar</span>
            <span className={styles.srOnly}>{vantarName(vantar)}</span>
          </span>
        )}
        {allOwned && (
          <span className={styles.badgeOk}>
            <Check aria-hidden="true" />
            Allt til
          </span>
        )}
      </p>
      <ul className={styles.gearList} id={listId}>
        {visible.map((g) => (
          <GearRow
            key={g.item.id}
            gear={g}
            state={stateOf(g.item.id)}
            variant={variant}
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
  variant,
  onChange,
}: {
  gear: GatheredGear;
  state: GearState;
  variant: GearVariant;
  onChange: (state: GearState) => void;
}) {
  const [open, setOpen] = useState(false);
  const sourcesId = useId();
  const name = useId();
  const checkRef = useRef<HTMLInputElement>(null);
  const label = gearLabel(gear);
  const Icon = STATE_ICON[state];

  useEffect(() => {
    if (checkRef.current) checkRef.current.indeterminate = state === "ovist";
  }, [state]);

  const sources = (
    <ul id={sourcesId} className={styles.sources} hidden={!open}>
      {gear.sources.map((s) => (
        <li key={`${s.lidurId}-${s.itemId}`}>
          <b>{s.lidurName}</b>
          {s.qty > 1 && <span> ×{s.qty}</span>}
          <span className={styles.sourceFundur}>{s.fundurTitle}</span>
        </li>
      ))}
    </ul>
  );

  const disclosure = (
    <button
      type="button"
      className={styles.gearName}
      aria-expanded={open}
      aria-controls={sourcesId}
      onClick={() => setOpen((v) => !v)}
    >
      <span>{label}</span>
      <span className={styles.sourceCount}>{countIs(gear.sources.length, "liður", "liðir")}</span>
      <ChevronDown aria-hidden="true" className={styles.chevron} />
    </button>
  );

  if (variant === "check") {
    return (
      <li className={styles.gearRow} data-state={state}>
        <label className={styles.check}>
          <input
            ref={checkRef}
            type="checkbox"
            checked={state === "eigum"}
            aria-label={`Eigum ${label}`}
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

  if (variant === "cycle") {
    const next = NEXT_STATE[state];
    return (
      <li className={`${styles.gearRow} ${styles.cycleRow}`} data-state={state}>
        <button
          type="button"
          className={styles.cycle}
          data-state={state}
          aria-label={`${label}: ${STATE_LABEL[state].toLowerCase()}. Breyta í ${STATE_LABEL[next].toLowerCase()}`}
          onClick={() => onChange(next)}
        >
          <Icon aria-hidden="true" />
        </button>
        {disclosure}
        {sources}
      </li>
    );
  }

  return (
    <li className={styles.gearRow} data-state={state}>
      {disclosure}
      <fieldset className={styles.seg}>
        <legend className={styles.srOnly}>{label}</legend>
        {STATES.map((s) => {
          const SIcon = STATE_ICON[s];
          return (
            <label key={s} className={styles.segOption} data-state={s}>
              <input type="radio" name={name} checked={state === s} onChange={() => onChange(s)} />
              <SIcon aria-hidden="true" />
              {STATE_LABEL[s]}
            </label>
          );
        })}
      </fieldset>
      {sources}
    </li>
  );
}

/* ── C and D: one "Vikan" cell ─────────────────────────────────────────────── */

function weekSummary(m: WeekModel) {
  const parts: { icon: typeof Pin; text: string; tone?: "warn" }[] = [];
  if (m.side.endurmat.length)
    parts.push({
      icon: MessageSquareText,
      text: countIs(m.side.endurmat.length, "endurmat", "endurmöt"),
    });
  if (m.vantar) parts.push({ icon: Backpack, text: `${m.vantar} vantar`, tone: "warn" });
  if (m.reminders.length)
    parts.push({ icon: Pin, text: countIs(m.reminders.length, "minnismiði", "minnismiðar") });
  const spoken = [
    m.side.endurmat.length && countIs(m.side.endurmat.length, "endurmat", "endurmöt"),
    m.vantar && vantarName(m.vantar).toLowerCase(),
    m.reminders.length && countIs(m.reminders.length, "minnismiði", "minnismiðar"),
  ].filter(Boolean);
  const name = `${m.week.label}: ${spoken.length ? spoken.join(", ") : "ekkert skráð"}`;
  return { parts, name };
}

function SummaryLines({ m }: { m: WeekModel }) {
  const { parts } = weekSummary(m);
  if (!parts.length) return <span className={styles.quiet}>Ekkert</span>;
  return (
    <>
      {parts.map((p) => (
        <span key={p.text} className={styles.summaryLine} data-tone={p.tone}>
          <p.icon aria-hidden="true" />
          {p.text}
        </span>
      ))}
    </>
  );
}

function WeekDetail({
  m,
  onOpenLidur,
  onAddReminder,
}: {
  m: WeekModel;
  onOpenLidur?: (lidurId: string) => void;
  onAddReminder?: (text: string, dueOn: string | null) => void;
}) {
  const id = useId();
  return (
    <div className={styles.detail}>
      <section aria-labelledby={`${id}-muna`}>
        <h3 id={`${id}-muna`} className={styles.detailHead}>
          <Pin aria-hidden="true" /> Muna
        </h3>
        {m.reminders.length ? (
          <ReminderList items={m.reminders} />
        ) : (
          <p className={styles.quiet}>Enginn minnismiði.</p>
        )}
        {onAddReminder && <ReminderForm key={m.week.index} onAdd={onAddReminder} />}
      </section>
      <section aria-labelledby={`${id}-endurmat`}>
        <h3 id={`${id}-endurmat`} className={styles.detailHead}>
          <MessageSquareText aria-hidden="true" /> Endurmat frá síðast
        </h3>
        {m.side.endurmat.length ? (
          <EndurmatList items={m.side.endurmat} onOpenLidur={onOpenLidur} />
        ) : (
          <p className={styles.quiet}>Enginn liður vikunnar ber endurmat.</p>
        )}
      </section>
      <section aria-labelledby={`${id}-bunadur`}>
        <h3 id={`${id}-bunadur`} className={styles.detailHead}>
          <Backpack aria-hidden="true" /> Búnaður
        </h3>
        {m.gear.length ? (
          <GearChecklist key={m.week.index} model={m} variant="radio" />
        ) : (
          <p className={styles.quiet}>Liðir vikunnar þurfa engan búnað.</p>
        )}
      </section>
    </div>
  );
}

function ReminderForm({ onAdd }: { onAdd: (text: string, dueOn: string | null) => void }) {
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState("");
  const textId = useId();
  const dueId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError("Skrifaðu minnismiðann fyrst.");
      inputRef.current?.focus();
      return;
    }
    onAdd(text.trim(), due || null);
    setText("");
    setDue("");
    setError("");
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label htmlFor={textId}>Nýr minnismiði</label>
      <input
        ref={inputRef}
        id={textId}
        value={text}
        placeholder="Muna leyfisbréf fyrir útileguna"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          setText(e.target.value);
          if (error && e.target.value.trim()) setError("");
        }}
      />
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <label htmlFor={dueId}>Fyrir (valfrjálst)</label>
      <div className={styles.formRow}>
        <input id={dueId} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <button type="submit" className={styles.primary}>
          Bæta við
        </button>
      </div>
    </form>
  );
}

interface OneCellProps {
  season: LabSeason;
  model: (week: PlanWeek) => WeekModel;
  defaultWeek?: number;
  onOpenLidur?: (lidurId: string) => void;
  onSelectEvent?: (eventId: string) => void;
}

function VikanLook({ season, model, defaultWeek, onOpenLidur, onSelectEvent }: OneCellProps) {
  const [openWeek, setOpenWeek] = useState<number | null>(defaultWeek ?? null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const week = season.grid.weeks.find((w) => w.index === openWeek);

  // The shared Modal neither moves focus in nor gives it back; the lab does both.
  useEffect(() => {
    if (openWeek === null) return;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    dialog?.querySelector<HTMLElement>("button, input")?.focus();
  }, [openWeek]);

  const close = () => {
    setOpenWeek(null);
    openerRef.current?.focus();
  };

  return (
    <>
      <LabGrid
        grid={season.grid}
        onSelectEvent={onSelectEvent}
        sideHeads={["Vikan"]}
        sideClass={styles.sideNarrow}
        renderSide={(w) => {
          const m = model(w);
          const { name } = weekSummary(m);
          return (
            <td className={`${styles.side} ${styles.sideSticky}`}>
              <button
                type="button"
                className={styles.weekButton}
                aria-label={`${name}. Opna vikuna`}
                aria-haspopup="dialog"
                onClick={(e) => {
                  openerRef.current = e.currentTarget;
                  setOpenWeek(w.index);
                }}
              >
                <SummaryLines m={m} />
              </button>
            </td>
          );
        }}
      />
      {week && (
        <Modal open onClose={close} title={`${week.label} · ${weekDate(week) || "ódagsett"}`}>
          <WeekDetail m={model(week)} onOpenLidur={onOpenLidur} />
        </Modal>
      )}
    </>
  );
}

function SpjaldLook({
  season,
  model,
  defaultWeek,
  onOpenLidur,
  onSelectEvent,
  onAddReminder,
}: OneCellProps & { onAddReminder: (week: number, text: string, dueOn: string | null) => void }) {
  const [selected, setSelected] = useState(defaultWeek ?? season.grid.weeks[0]?.index ?? 1);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const week = season.grid.weeks.find((w) => w.index === selected);

  return (
    <div className={styles.dock}>
      <LabGrid
        grid={season.grid}
        onSelectEvent={onSelectEvent}
        sideHeads={["Vikan"]}
        sideClass={styles.sideNarrow}
        renderSide={(w) => {
          const m = model(w);
          const { name } = weekSummary(m);
          return (
            <td
              className={`${styles.side} ${styles.sideSticky}`}
              data-selected={w.index === selected || undefined}
            >
              <button
                type="button"
                className={styles.weekButton}
                aria-label={name}
                aria-pressed={w.index === selected}
                aria-controls="vikuspjald"
                onClick={(e) => {
                  setSelected(w.index);
                  // Stacked under the grid (a phone): take the reader to the panel.
                  const panel = panelRef.current?.getBoundingClientRect();
                  if (panel && panel.top > e.currentTarget.getBoundingClientRect().bottom) {
                    requestAnimationFrame(() => headingRef.current?.focus());
                  }
                }}
              >
                <SummaryLines m={m} />
              </button>
            </td>
          );
        }}
      />
      <aside ref={panelRef} id="vikuspjald" className={styles.panel} aria-labelledby="vikuspjald-h">
        {week && (
          <>
            <h2 id="vikuspjald-h" ref={headingRef} tabIndex={-1} className={styles.panelHead}>
              {week.label}
              <span>{weekDate(week)}</span>
            </h2>
            <WeekDetail
              m={model(week)}
              onOpenLidur={onOpenLidur}
              onAddReminder={(text, due) => onAddReminder(week.index, text, due)}
            />
          </>
        )}
      </aside>
    </div>
  );
}

/** The close-up: one week's checklist on its own, in the full three-way form. */
export function GearChecklistCloseUp({
  season,
  week: weekIndex,
}: {
  season: LabSeason;
  week: number;
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
    reminders: side.reminders,
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
    <div className={`${styles.root} ${styles.closeUp}`}>
      <h2 className={styles.panelHead}>
        Búnaður · {week.label}
        <span>{weekDate(week)}</span>
      </h2>
      <GearChecklist model={m} variant="radio" />
      <p role="status" className={styles.srOnly}>
        {announcement}
      </p>
    </div>
  );
}
