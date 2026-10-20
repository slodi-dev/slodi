/**
 * The split band on a phone, stacked by time: one timeline down the page, at each time what
 * every flokkur starts then. The desktop K2 grid squeezed onto a phone shows one and a half
 * flokkar and cuts the second column's cards mid-word (see the MDX, section 9); a timeline reads
 * top to bottom with one thumb and needs no sideways scrolling at all.
 *
 * Five looks of the same function (phoneLooks.ts): `m3`, the first version, and its styles
 * M3a–d. Every look has the same parts:
 * - a legend of the flokkar (crest, name, total, "ræður lengd" or the wait);
 * - at each start time, every flokkur's liður that starts then; a tap opens its card's back as
 *   a sheet from the bottom (SplitGridLab's PhoneSheet), with length, Fyrr / Síðar and Færa til;
 * - where a flokkur is done before the band, its wait, with "+ Bæta við";
 * - "Lok" at the band's end.
 * Split, merge, Afturkalla and every edit are the band's own; a look only decides how the
 * timeline is drawn. Nothing on a phone is dragged: the rows are times, not places.
 *
 * Every look keeps H6's identity: the ringed crest and the flokkur's colour as a cord or edge,
 * with its 10% wash under primary text, never coloured text on the page.
 */
import { useId, useState, type CSSProperties } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { BlockMarker, BlockMinutes } from "@/components/plan/bench/BlockCard";
import { Stamp } from "@/components/plan/calendar/Stamp";
import { countIs } from "@/lib/format";
import type { PatrolAccent } from "@/services/plan.service";
import type { CardLidur } from "./cardModel";
import { Crest } from "./laneHeaders";
import { at, type LaneItem, type LaneModel, type SplitModel } from "./labBench";
import type { PhoneLook } from "./phoneLooks";
import styles from "./phoneLayouts.module.css";

/** What the band hands a phone layout: the card's behaviour and the lane colours. */
export type PhoneParts = {
  /** A card's button props: its name, open on press, ↑ ↓ ← → (SplitGridLab's itemProps). */
  itemProps: (lane: LaneModel, li: LaneItem) => Record<string, unknown>;
  laneVars: (accent: PatrolAccent) => CSSProperties;
  selected: string | null;
  addTo: (lane: LaneModel) => void;
  /** Whether a card differs from the sveit's version. */
  changed: (li: LaneItem) => boolean;
};

type AreaProps = { model: SplitModel; parts: PhoneParts };

export function PhoneArea({ look, ...props }: AreaProps & { look: PhoneLook }) {
  if (look === "m3a") return <Rail {...props} />;
  if (look === "m3b") return <RuledLog {...props} />;
  if (look === "m3c") return <CardRows {...props} />;
  if (look === "m3d") return <Threads {...props} />;
  return <FirstVersion {...props} />;
}

/* ── Shared ── */

type Start = { kind: "start"; lane: LaneModel; li: LaneItem };
type Wait = { kind: "wait"; lane: LaneModel; minutes: number };
type Row = Start | Wait;
type TimeGroup = { minute: number; rows: Row[] };

/**
 * The band as a timeline: every minute at which something starts (a liður, or a flokkur's
 * wait), in time order, and what starts then, in flokkur order.
 */
function timeGroups(model: SplitModel): TimeGroup[] {
  const byMinute = new Map<number, Row[]>();
  const put = (minute: number, row: Row) =>
    byMinute.set(minute, [...(byMinute.get(minute) ?? []), row]);
  for (const lane of model.lanes) {
    for (const li of lane.items) put(li.start, { kind: "start", lane, li });
    if (lane.idle > 0) put(lane.used, { kind: "wait", lane, minutes: lane.idle });
  }
  return [...byMinute.keys()]
    .sort((a, b) => a - b)
    .map((minute) => ({
      minute,
      rows: byMinute.get(minute)!.sort((a, b) => a.lane.laneIndex - b.lane.laneIndex),
    }));
}

/** "70 mín · ræður lengd" or "45 mín · 30 mín bið". */
function LaneNums({ lane, model }: { lane: LaneModel; model: SplitModel }) {
  const state =
    model.balanced || model.duration === 0
      ? null
      : lane.longest
        ? "ræður lengd"
        : `${lane.idle} mín bið`;
  return (
    <span className={styles.nums}>
      <span className={styles.num} data-lane-total={lane.patrolId}>
        {lane.used} mín
      </span>
      {state && (
        <>
          <span aria-hidden="true">·</span>
          <span className={lane.longest ? styles.leads : styles.waits}>{state}</span>
        </>
      )}
    </span>
  );
}

/** The flokkar, each with its crest, name, total and wait. `grid` lines them up two across. */
function Legend({ model, parts, grid = false }: AreaProps & { grid?: boolean }) {
  return (
    <ul className={grid ? styles.legendGrid : styles.legend} aria-label="Flokkarnir">
      {model.lanes.map((lane) => (
        <li key={lane.patrolId} className={styles.legendItem} style={parts.laneVars(lane.accent)}>
          <Crest name={lane.name} size="1.75rem" />
          <span className={styles.legendText}>
            <span className={styles.oneLine} title={lane.name}>
              {lane.name}
            </span>
            <LaneNums lane={lane} model={model} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The wait's accessible name: what it is, then what the button does. */
function waitLabel(row: Wait): string {
  return row.lane.items.length === 0
    ? `Ekkert skráð. Bæta verkefni við (${row.lane.name})`
    : `${row.minutes} mín bið. Bæta verkefni við (${row.lane.name})`;
}

function waitText(row: Wait): string {
  return row.lane.items.length === 0 ? "Ekkert skráð" : `${row.minutes} mín bið`;
}

function StatusStamp({ li }: { li: LaneItem }) {
  return <Stamp entry={{ id: li.item.id, status: li.item.status, type: "flokks" }} size="sm" />;
}

function ChangedDot({ parts, li }: { parts: PhoneParts; li: LaneItem }) {
  return parts.changed(li) ? (
    <span className={styles.changedDot} title="Breytt fyrir þennan flokk" aria-hidden="true" />
  ) : null;
}

/** "Lok · allir koma saman" at the band's end. */
function endText(model: SplitModel): string {
  return model.lanes.length > 1 ? "Lok · allir koma saman" : "Lok";
}

/* ── M3 · the first version ── */

/**
 * At each time a row with what every flokkur starts then, as a short card line with its crest
 * and the flokkur's name; a flokkur done before the band gets a wait line.
 */
function FirstVersion({ model, parts }: AreaProps) {
  return (
    <div className={styles.area} data-look="m3">
      <Legend model={model} parts={parts} />
      <ol className={styles.timeline} aria-label="Tímalína">
        {timeGroups(model).map(({ minute, rows }) => (
          <li key={minute} className={styles.timeRow}>
            <span className={styles.time}>{at(model, minute)}</span>
            <ul className={styles.timeItems}>
              {rows.map((row) =>
                row.kind === "start" ? (
                  <li key={row.li.item.id}>
                    <button
                      type="button"
                      className={styles.line}
                      style={parts.laneVars(row.lane.accent)}
                      data-status={row.li.item.status}
                      data-on={parts.selected === row.li.item.id || undefined}
                      {...parts.itemProps(row.lane, row.li)}
                    >
                      <Crest name={row.lane.name} size="1.75rem" />
                      <span className={styles.lineText}>
                        <span className={styles.lineTitle}>{row.li.item.name}</span>
                        <span className={styles.lineMeta}>
                          <BlockMinutes minutes={row.li.item.minutes} hidden />
                          <span className={styles.oneLine}>{row.lane.name}</span>
                        </span>
                      </span>
                      <StatusStamp li={row.li} />
                      <ChangedDot parts={parts} li={row.li} />
                    </button>
                  </li>
                ) : (
                  <li key={`wait-${row.lane.patrolId}`}>
                    <button
                      type="button"
                      className={styles.waitLine}
                      style={parts.laneVars(row.lane.accent)}
                      aria-label={waitLabel(row)}
                      onClick={() => parts.addTo(row.lane)}
                    >
                      <Crest name={row.lane.name} size="1.75rem" />
                      <span className={styles.lineText}>
                        <span className={styles.oneLine}>{row.lane.name}</span>
                        <span className={styles.lineMeta}>{waitText(row)} · + Bæta við</span>
                      </span>
                    </button>
                  </li>
                )
              )}
            </ul>
          </li>
        ))}
        <li className={styles.timeRow} data-end>
          <span className={styles.time}>{at(model, model.duration)}</span>
          <span className={styles.endNote}>{endText(model)}</span>
        </li>
      </ol>
    </div>
  );
}

/* ── M3a · Rail ── */

/**
 * A time rail down the left with a stop at every start time. A stop folds to one line, its
 * flokkar's crests and what starts there; open the stops you are working on. The first stop is
 * open to begin with, and so is the stop of the card in the sheet, so a Fyrr or Síðar that
 * carries a card to another time never hides it.
 */
function Rail({ model, parts }: AreaProps) {
  const groups = timeGroups(model);
  const baseId = useId();
  const [open, setOpen] = useState<Set<number>>(() => new Set(groups[0] ? [groups[0].minute] : []));
  const allOpen = groups.every((group) => open.has(group.minute));
  const holdsSelected = (group: TimeGroup) =>
    group.rows.some((row) => row.kind === "start" && row.li.item.id === parts.selected);
  const toggle = (minute: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(minute)) next.delete(minute);
      else next.add(minute);
      return next;
    });

  return (
    <div className={styles.area} data-look="m3a">
      <Legend model={model} parts={parts} grid />
      <div className={styles.railBar}>
        <span className={styles.railCount}>
          {countIs(groups.length, "tímasetning", "tímasetningar")}
        </span>
        <button
          type="button"
          className={styles.quietButton}
          onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map((g) => g.minute)))}
        >
          {allOpen ? "Fella allt saman" : "Opna allt"}
        </button>
      </div>
      <ol className={styles.rail} aria-label="Tímalína">
        {groups.map((group) => {
          const isOpen = open.has(group.minute) || holdsSelected(group);
          const panelId = `${baseId}-${group.minute}`;
          const starts = group.rows.filter((row): row is Start => row.kind === "start");
          const waits = group.rows.length - starts.length;
          return (
            <li key={group.minute} className={styles.stop} data-open={isOpen || undefined}>
              <span className={styles.stopTime}>{at(model, group.minute)}</span>
              <button
                type="button"
                className={styles.stopHead}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(group.minute)}
              >
                <span className={styles.stopCrests} aria-hidden="true">
                  {group.rows.map((row) => (
                    <span key={row.lane.patrolId} style={parts.laneVars(row.lane.accent)}>
                      <Crest name={row.lane.name} size="1.375rem" />
                    </span>
                  ))}
                </span>
                <span className={styles.stopSummary}>
                  <span className={styles.oneLine}>
                    {starts.length > 0
                      ? starts.map((row) => row.li.item.name).join(" · ")
                      : group.rows.map((row) => row.lane.name).join(" · ")}
                  </span>
                  <span className={styles.stopCount}>
                    {[
                      starts.length > 0 ? countIs(starts.length, "liður", "liðir") : null,
                      waits > 0 ? countIs(waits, "flokkur bíður", "flokkar bíða") : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <ChevronDown className={styles.chevron} aria-hidden="true" />
              </button>
              {isOpen && (
                <ul id={panelId} className={styles.stopItems}>
                  {group.rows.map((row) =>
                    row.kind === "start" ? (
                      <li key={row.li.item.id}>
                        <button
                          type="button"
                          className={styles.line}
                          style={parts.laneVars(row.lane.accent)}
                          data-status={row.li.item.status}
                          data-on={parts.selected === row.li.item.id || undefined}
                          {...parts.itemProps(row.lane, row.li)}
                        >
                          <Crest name={row.lane.name} size="1.75rem" />
                          <span className={styles.lineText}>
                            <span className={styles.lineTitle}>{row.li.item.name}</span>
                            <span className={styles.lineMeta}>
                              <BlockMinutes minutes={row.li.item.minutes} hidden />
                              <span className={styles.oneLine}>{row.lane.name}</span>
                            </span>
                          </span>
                          <StatusStamp li={row.li} />
                          <ChangedDot parts={parts} li={row.li} />
                        </button>
                      </li>
                    ) : (
                      <li key={`wait-${row.lane.patrolId}`}>
                        <button
                          type="button"
                          className={styles.waitLine}
                          style={parts.laneVars(row.lane.accent)}
                          aria-label={waitLabel(row)}
                          onClick={() => parts.addTo(row.lane)}
                        >
                          <Crest name={row.lane.name} size="1.75rem" />
                          <span className={styles.lineText}>
                            <span className={styles.oneLine}>{row.lane.name}</span>
                            <span className={styles.lineMeta}>{waitText(row)}</span>
                          </span>
                          <span className={styles.addMark}>
                            <Plus aria-hidden="true" /> Bæta við
                          </span>
                        </button>
                      </li>
                    )
                  )}
                </ul>
              )}
            </li>
          );
        })}
        <li className={styles.stop} data-end>
          <span className={styles.stopTime}>{at(model, model.duration)}</span>
          <span className={styles.stopEnd}>{endText(model)}</span>
        </li>
      </ol>
    </div>
  );
}

/* ── M3b · Ruled log ── */

/**
 * A run sheet. Times in a mono margin, written once per time; one ruled 48px line per start
 * with the crest, the name, the length and the stamp; the flokkur's colour as a narrow edge.
 * Flokkar that start the same liður at the same time (right after "Skipta á flokka", or a
 * station two flokkar share) share one line, with one crest button each.
 */
function RuledLog({ model, parts }: AreaProps) {
  return (
    <div className={styles.area} data-look="m3b">
      <Legend model={model} parts={parts} grid />
      <ol className={styles.log} aria-label="Tímalína">
        {timeGroups(model).map(({ minute, rows }) => (
          <li key={minute} className={styles.logGroup}>
            <span className={styles.logTime}>{at(model, minute)}</span>
            <ul className={styles.logLines}>
              {shared(rows).map((entry) =>
                entry.kind === "wait" ? (
                  <li key={`wait-${entry.lane.patrolId}`}>
                    <button
                      type="button"
                      className={styles.logWait}
                      style={parts.laneVars(entry.lane.accent)}
                      aria-label={waitLabel(entry)}
                      onClick={() => parts.addTo(entry.lane)}
                    >
                      <Crest name={entry.lane.name} size="1.375rem" />
                      <span className={styles.logTitle}>
                        <span className={styles.oneLine}>{entry.lane.name}</span>
                      </span>
                      <span className={styles.logMeta}>{waitText(entry)}</span>
                      <Plus className={styles.logPlus} aria-hidden="true" />
                    </button>
                  </li>
                ) : entry.starts.length === 1 ? (
                  <li key={entry.starts[0].li.item.id}>
                    <LogLine start={entry.starts[0]} parts={parts} />
                  </li>
                ) : (
                  <li key={entry.starts[0].li.item.id} className={styles.logShared}>
                    <span className={styles.logTitle}>
                      <span className={styles.oneLine}>{entry.starts[0].li.item.name}</span>
                    </span>
                    <span className={styles.logMeta}>
                      <BlockMinutes minutes={entry.starts[0].li.item.minutes} hidden />
                    </span>
                    <span className={styles.logSharedCrests}>
                      {entry.starts.map((start) => (
                        <button
                          key={start.li.item.id}
                          type="button"
                          className={styles.logCrest}
                          style={parts.laneVars(start.lane.accent)}
                          data-on={parts.selected === start.li.item.id || undefined}
                          {...parts.itemProps(start.lane, start.li)}
                        >
                          <Crest name={start.lane.name} size="1.75rem" />
                          <ChangedDot parts={parts} li={start.li} />
                        </button>
                      ))}
                    </span>
                  </li>
                )
              )}
            </ul>
          </li>
        ))}
        <li className={styles.logGroup} data-end>
          <span className={styles.logTime}>{at(model, model.duration)}</span>
          <span className={styles.logEnd}>{endText(model)}</span>
        </li>
      </ol>
    </div>
  );
}

type LogEntry = Wait | { kind: "shared"; starts: Start[] };

/** The same liður (name, length, status) starting at the same time for several flokkar. */
function shared(rows: Row[]): LogEntry[] {
  const entries: LogEntry[] = [];
  const keyOf = (start: Start) =>
    `${start.li.item.name}|${start.li.item.minutes}|${start.li.item.status}`;
  for (const row of rows) {
    if (row.kind === "wait") {
      entries.push(row);
      continue;
    }
    const same = entries.find(
      (entry): entry is { kind: "shared"; starts: Start[] } =>
        entry.kind === "shared" && keyOf(entry.starts[0]) === keyOf(row)
    );
    if (same) same.starts.push(row);
    else entries.push({ kind: "shared", starts: [row] });
  }
  return entries;
}

function LogLine({ start, parts }: { start: Start; parts: PhoneParts }) {
  const { lane, li } = start;
  return (
    <button
      type="button"
      className={styles.logLine}
      style={parts.laneVars(lane.accent)}
      data-status={li.item.status}
      data-on={parts.selected === li.item.id || undefined}
      {...parts.itemProps(lane, li)}
    >
      <Crest name={lane.name} size="1.375rem" />
      <span className={styles.logTitle}>
        <span className={styles.oneLine}>{li.item.name}</span>
      </span>
      <span className={styles.logMeta}>
        <BlockMinutes minutes={li.item.minutes} hidden />
      </span>
      <StatusStamp li={li} />
      <ChangedDot parts={parts} li={li} />
    </button>
  );
}

/* ── M3c · Cards in rows ── */

/** Two across, or three when the flokkar come in threes or there are five or more. */
function columnsFor(count: number): 2 | 3 {
  return count === 3 || count >= 5 ? 3 : 2;
}

/**
 * At each time a row of small bank cards, in the same flokkur order every time, so a flokkur
 * keeps its place all the way down. A flokkur still busy with an earlier liður keeps its place
 * as a faint "heldur áfram"; one that is done and waiting gets a wait card; after that its
 * place is left empty. The time stays pinned while its row scrolls by.
 */
function CardRows({ model, parts }: AreaProps) {
  const groups = timeGroups(model);
  const columns = columnsFor(model.lanes.length);
  return (
    <div
      className={styles.area}
      data-look="m3c"
      style={{ ["--cards" as string]: columns } as CSSProperties}
    >
      <Legend model={model} parts={parts} grid />
      <ol className={styles.cardTimeline} aria-label="Tímalína">
        {groups.map(({ minute, rows }) => (
          <li key={minute} className={styles.cardGroup}>
            <h4 className={styles.cardTime}>{at(model, minute)}</h4>
            <ul className={styles.cardRow}>
              {model.lanes.map((lane) => {
                const row = rows.find((entry) => entry.lane.laneIndex === lane.laneIndex);
                if (row?.kind === "start") {
                  return (
                    <li key={lane.patrolId}>
                      <MiniCard start={row} parts={parts} />
                    </li>
                  );
                }
                if (row?.kind === "wait") {
                  return (
                    <li key={lane.patrolId}>
                      <button
                        type="button"
                        className={styles.miniWait}
                        style={parts.laneVars(lane.accent)}
                        aria-label={waitLabel(row)}
                        onClick={() => parts.addTo(lane)}
                      >
                        <span className={styles.miniHead}>
                          <Crest name={lane.name} size="1.375rem" />
                          <span className={styles.miniFlokkur}>{lane.name}</span>
                        </span>
                        <span className={styles.miniTitle}>{waitText(row)}</span>
                        <span className={styles.addMark}>
                          <Plus aria-hidden="true" /> Bæta við
                        </span>
                      </button>
                    </li>
                  );
                }
                const busy = lane.items.find(
                  (li) => li.start < minute && li.start + li.item.minutes > minute
                );
                return (
                  <li
                    key={lane.patrolId}
                    className={styles.miniGap}
                    style={parts.laneVars(lane.accent)}
                    aria-hidden="true"
                    data-busy={busy ? true : undefined}
                  >
                    {busy && (
                      <span className={styles.miniGapText}>
                        <span className={styles.oneLine}>{lane.name}</span>
                        <span className={styles.oneLine}>heldur áfram</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
        <li className={styles.cardGroup} data-end>
          <h4 className={styles.cardTime}>{at(model, model.duration)}</h4>
          <p className={styles.cardEnd}>{endText(model)}</p>
        </li>
      </ol>
    </div>
  );
}

/** The bank card, small: crest and flokkur on top, the picture and name, the clock and stamp. */
function MiniCard({ start, parts }: { start: Start; parts: PhoneParts }) {
  const { lane, li } = start;
  const card = li.item as CardLidur;
  return (
    <button
      type="button"
      className={styles.mini}
      style={parts.laneVars(lane.accent)}
      data-status={li.item.status}
      data-on={parts.selected === li.item.id || undefined}
      {...parts.itemProps(lane, li)}
    >
      <span className={styles.miniHead}>
        <Crest name={lane.name} size="1.375rem" />
        <span className={styles.miniFlokkur}>{lane.name}</span>
      </span>
      <span className={styles.miniBody}>
        <span className={styles.miniPic}>
          <BlockMarker kind={li.item.kind} theme={card.theme} small />
        </span>
        <span className={styles.miniTitle}>{li.item.name}</span>
      </span>
      <span className={styles.miniFoot}>
        <BlockMinutes minutes={li.item.minutes} hidden />
        <StatusStamp li={li} />
      </span>
      <ChangedDot parts={parts} li={li} />
    </button>
  );
}

/* ── M3d · Threads ── */

/** A flokkur's cord at a minute: carrying a liður, waiting for the others, or done. */
function cordAt(lane: LaneModel, minute: number, model: SplitModel): "busy" | "wait" | "none" {
  if (minute < lane.used) return "busy";
  if (minute < model.duration) return "wait";
  return "none";
}

/**
 * Every flokkur is a cord down the left, in flokkur order, like branches of a tree: they split
 * off the sveit at the top and join it again at Lok. A liður is a bead on its own cord with its
 * name beside it; while a flokkur waits for the others its cord is dashed. One line per start,
 * in time order, so a screen reader hears a plain timeline; the cords are decoration.
 */
function Threads({ model, parts }: AreaProps) {
  const lanes = model.lanes;
  /**
   * The cords beside one line. `fork` draws the split at the top (cords from the middle down,
   * off one bar) or the join at Lok (cords from the top to the middle, into one bar).
   */
  const cords = (
    minute: number,
    bead: { lane: number; wait: boolean } | null,
    fork?: "top" | "bottom"
  ) => (
    <span className={styles.cords} data-fork={fork} aria-hidden="true">
      {lanes.map((lane) => (
        <span
          key={lane.patrolId}
          className={styles.cord}
          style={parts.laneVars(lane.accent)}
          data-state={fork ? "busy" : cordAt(lane, minute, model)}
        >
          {bead?.lane === lane.laneIndex && (
            <span className={styles.bead} data-wait={bead.wait || undefined} />
          )}
        </span>
      ))}
    </span>
  );

  return (
    <div
      className={styles.area}
      data-look="m3d"
      style={{ ["--threads" as string]: lanes.length } as CSSProperties}
    >
      <Legend model={model} parts={parts} grid />
      <ol className={styles.threadList} aria-label="Tímalína">
        <li className={styles.threadFork} aria-hidden="true">
          <span className={styles.threadTime} />
          {cords(0, null, "top")}
          <span className={styles.threadNote}>Sveitin skiptist</span>
        </li>
        {timeGroups(model).map(({ minute, rows }) =>
          rows.map((row, i) => (
            <li
              key={row.kind === "start" ? row.li.item.id : `wait-${row.lane.patrolId}`}
              className={styles.thread}
              data-first={i === 0 || undefined}
            >
              <span className={styles.threadTime}>{i === 0 ? at(model, minute) : ""}</span>
              {cords(minute, { lane: row.lane.laneIndex, wait: row.kind === "wait" })}
              {row.kind === "start" ? (
                <button
                  type="button"
                  className={styles.threadItem}
                  style={parts.laneVars(row.lane.accent)}
                  data-status={row.li.item.status}
                  data-on={parts.selected === row.li.item.id || undefined}
                  {...parts.itemProps(row.lane, row.li)}
                >
                  <span className={styles.lineText}>
                    <span className={styles.lineTitle}>{row.li.item.name}</span>
                    <span className={styles.lineMeta}>
                      <BlockMinutes minutes={row.li.item.minutes} hidden />
                      <span className={styles.oneLine}>{row.lane.name}</span>
                    </span>
                  </span>
                  <StatusStamp li={row.li} />
                  <ChangedDot parts={parts} li={row.li} />
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.threadWait}
                  style={parts.laneVars(row.lane.accent)}
                  aria-label={waitLabel(row)}
                  onClick={() => parts.addTo(row.lane)}
                >
                  <span className={styles.lineText}>
                    <span className={styles.oneLine}>{row.lane.name}</span>
                    <span className={styles.lineMeta}>{waitText(row)}</span>
                  </span>
                  <span className={styles.addMark}>
                    <Plus aria-hidden="true" /> Bæta við
                  </span>
                </button>
              )}
            </li>
          ))
        )}
        <li className={styles.threadFork} data-end>
          <span className={styles.threadTime}>{at(model, model.duration)}</span>
          {cords(model.duration, null, "bottom")}
          <span className={styles.threadNote}>{endText(model)}</span>
        </li>
      </ol>
    </div>
  );
}
