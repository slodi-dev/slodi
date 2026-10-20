/**
 * The split band on a phone, stacked by time: one timeline down the page, at each time what
 * every flokkur starts then. The desktop K2 grid squeezed onto a phone shows one and a half
 * flokkar and cuts the second column's cards mid-word (see the MDX, section 9); a timeline reads
 * top to bottom with one thumb and needs no sideways scrolling at all.
 *
 * Five looks of the same function (phoneLooks.ts): `m3`, the first version, and its styles
 * M3a–d. Every look has the same parts:
 * - a legend of the flokkar (crest, name, total, "ræður lengd" or the wait);
 * - at each start time, every flokkur's liður that starts then, with its span ("til 20:10"); a
 *   tap opens its card's back as a sheet from the bottom (SplitGridLab's PhoneSheet), with
 *   length, Fyrr / Síðar and Færa til;
 * - at each start time, the flokkar still busy with a liður that started earlier ("heldur
 *   áfram"): lengths differ, so starts don't line up, and a 60-min liður runs past the others'
 *   starts. A leader glancing at 20:00 sees what every flokkur is doing, not only who starts;
 * - where a flokkur is done before the band, its wait, with "+ Bæta við";
 * - "Lok" at the band's end.
 * Split, merge, Afturkalla and every edit are the band's own; a look only decides how the
 * timeline is drawn. Nothing on a phone is dragged: the rows are times, not places.
 *
 * Every look keeps H6's identity: the ringed crest and the flokkur's colour as a cord or edge,
 * with its 10% wash under primary text, never coloured text on the page.
 */
import { Fragment, useId, useState, type CSSProperties } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { BlockMinutes } from "@/components/plan/bench/BlockCard";
import { Stamp } from "@/components/plan/calendar/Stamp";
import { countIs } from "@/lib/format";
import type { PatrolAccent } from "@/services/plan.service";
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
/** A flokkur in the middle of a liður that started before this time. */
type Continue = { lane: LaneModel; li: LaneItem };
type TimeGroup = { minute: number; rows: Row[]; continuing: Continue[] };

/** The minute a liður ends, from the start of the band. */
function endOf(li: LaneItem): number {
  return li.start + li.item.minutes;
}

/** "til 20:10", or "til +30 mín" on an undated fundur. */
function untilText(model: SplitModel, li: LaneItem): string {
  return `til ${li.clockEnd ?? at(model, endOf(li))}`;
}

/** The flokkar busy at `minute` with a liður that started before it, in flokkur order. */
function continuingAt(model: SplitModel, minute: number): Continue[] {
  return model.lanes.flatMap((lane) => {
    const li = lane.items.find((entry) => entry.start < minute && endOf(entry) > minute);
    return li ? [{ lane, li }] : [];
  });
}

/** "Uglur: Ratleikur um hverfið til 20:40 · Refir: …", for the compact line and the reader. */
function continuingText(model: SplitModel, continuing: Continue[]): string {
  return continuing
    .map(({ lane, li }) => `${lane.name}: ${li.item.name} ${untilText(model, li)}`)
    .join(" · ");
}

/**
 * A card's button props, with when it ends added to its name, so a reader hears the span the
 * row shows ("…, 30 mín, staðfest, til 20:10").
 */
function cardProps(parts: PhoneParts, model: SplitModel, lane: LaneModel, li: LaneItem) {
  const props = parts.itemProps(lane, li);
  return { ...props, "aria-label": `${props["aria-label"]}, ${untilText(model, li)}` };
}

/**
 * The band as a timeline: every minute at which something starts (a liður, or a flokkur's
 * wait), in time order, what starts then, in flokkur order, and who is still busy.
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
      continuing: continuingAt(model, minute),
    }));
}

/**
 * One flokkur still on an earlier liður, as a slim line: crest, flokkur and liður, "heldur
 * áfram til 20:40 · 20 af 60 mín", and a bar along its foot for how far in it is. Not a button: the liður's own
 * card is at the time it started.
 */
function ContinueLine({
  model,
  minute,
  item,
  parts,
}: {
  model: SplitModel;
  minute: number;
  item: Continue;
  parts: PhoneParts;
}) {
  const { lane, li } = item;
  const done = minute - li.start;
  return (
    <span className={styles.continueLine} style={parts.laneVars(lane.accent)}>
      <Crest name={lane.name} size="1.375rem" />
      <span className={styles.lineText}>
        <span className={styles.oneLine}>
          {lane.name} · {li.item.name}
        </span>
        <span className={styles.lineMeta}>
          <span className={styles.oneLine}>
            heldur áfram {untilText(model, li)} · {done} af {li.item.minutes} mín
          </span>
        </span>
      </span>
      <span className={styles.progress} aria-hidden="true">
        <span style={{ width: `${(done / li.item.minutes) * 100}%` }} />
      </span>
    </span>
  );
}

/**
 * Every flokkur still busy at this time, on one quiet line: "Heldur áfram Refir til 20:10 ·
 * Uglur til 20:40". The liður's name is up the page where it started; a reader hears it here.
 */
function ContinueNote({
  model,
  continuing,
  parts,
}: {
  model: SplitModel;
  continuing: Continue[];
  parts: PhoneParts;
}) {
  if (continuing.length === 0) return null;
  return (
    <span className={styles.continueNote}>
      <span className={styles.continueCrests} aria-hidden="true">
        {continuing.map(({ lane }) => (
          <span key={lane.patrolId} style={parts.laneVars(lane.accent)}>
            <Crest name={lane.name} size="1.125rem" />
          </span>
        ))}
      </span>
      <span className={styles.twoLines} aria-hidden="true">
        <span className={styles.continueLead}>Heldur áfram</span>{" "}
        {continuing.map(({ lane, li }) => `${lane.name} ${untilText(model, li)}`).join(" · ")}
      </span>
      <span className={styles.srOnly}>Heldur áfram: {continuingText(model, continuing)}</span>
    </span>
  );
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
            <span className={styles.time} data-clock>
              {at(model, minute)}
            </span>
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
                      {...cardProps(parts, model, row.lane, row.li)}
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
          <span className={styles.time} data-clock>
            {at(model, model.duration)}
          </span>
          <span className={styles.endNote}>{endText(model)}</span>
        </li>
      </ol>
    </div>
  );
}

/* ── M3a · Rail ── */

/**
 * A time rail down the left with a stop at every start time. A stop folds to one line, its
 * flokkar's crests, what starts there and a count ("2 byrja · 2 halda áfram"); open the stops
 * you are working on. An open stop lists every flokkur: who starts (cards, with "til 20:10"),
 * who is still on an earlier liður (a slim line with a bar for how far in), and who waits. The first stop is
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
          const busy = group.continuing.length;
          return (
            <li
              key={group.minute}
              className={styles.stop}
              data-open={isOpen || undefined}
              data-time={at(model, group.minute)}
            >
              <span className={styles.stopTime} data-clock>
                {at(model, group.minute)}
              </span>
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
                      starts.length > 0 ? countIs(starts.length, "byrjar", "byrja") : null,
                      busy > 0 ? countIs(busy, "heldur áfram", "halda áfram") : null,
                      waits > 0 ? countIs(waits, "bíður", "bíða") : null,
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
                          {...cardProps(parts, model, row.lane, row.li)}
                        >
                          <Crest name={row.lane.name} size="1.75rem" />
                          <span className={styles.lineText}>
                            <span className={styles.lineTitle}>{row.li.item.name}</span>
                            <span className={styles.lineMeta}>
                              <BlockMinutes minutes={row.li.item.minutes} hidden />
                              <span className={styles.until}>{untilText(model, row.li)}</span>
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
                  {group.continuing.map((item) => (
                    <li key={`busy-${item.lane.patrolId}`}>
                      <ContinueLine model={model} minute={group.minute} item={item} parts={parts} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        <li className={styles.stop} data-end>
          <span className={styles.stopTime} data-clock>
            {at(model, model.duration)}
          </span>
          <span className={styles.stopEnd}>{endText(model)}</span>
        </li>
      </ol>
    </div>
  );
}

/* ── M3b · Ruled log ── */

/** Where a flokkur's track is at a time: starting a liður, in one, waiting, or done. */
function trackAt(lane: LaneModel, group: TimeGroup, model: SplitModel) {
  if (group.rows.some((row) => row.kind === "start" && row.lane === lane)) return "start";
  if (group.continuing.some((item) => item.lane === lane)) return "busy";
  if (group.minute >= lane.used && group.minute < model.duration) return "wait";
  return "none";
}

/**
 * A run sheet. Times in a mono margin, written once per time; one ruled 48px line per start
 * with the crest, the name, the length, "til 20:10" and the stamp. Between the time and the
 * lines, a gutter with a narrow track per flokkur: a solid segment for as long as each liður
 * lasts, with a tick where the next one starts and a dashed run while the flokkur waits, so
 * liðir of different lengths show as parallel edges. Under the time's lines, the flokkar still
 * busy from earlier, on one quiet line. Flokkar that start the same liður at the same time
 * share one line, with one crest button each.
 */
function RuledLog({ model, parts }: AreaProps) {
  return (
    <div
      className={styles.area}
      data-look="m3b"
      style={{ ["--tracks" as string]: model.lanes.length } as CSSProperties}
    >
      <Legend model={model} parts={parts} grid />
      <ol className={styles.log} aria-label="Tímalína">
        {timeGroups(model).map((group) => (
          <li key={group.minute} className={styles.logGroup} data-time={at(model, group.minute)}>
            <span className={styles.logTime} data-clock>
              {at(model, group.minute)}
            </span>
            <span className={styles.tracks} aria-hidden="true">
              {model.lanes.map((lane) => (
                <span
                  key={lane.patrolId}
                  className={styles.track}
                  style={parts.laneVars(lane.accent)}
                  data-state={trackAt(lane, group, model)}
                />
              ))}
            </span>
            <ul className={styles.logLines}>
              {shared(group.rows).map((entry) =>
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
                    <LogLine start={entry.starts[0]} model={model} parts={parts} />
                  </li>
                ) : (
                  <li key={entry.starts[0].li.item.id} className={styles.logShared}>
                    <span className={styles.logTitle}>
                      <span className={styles.oneLine}>{entry.starts[0].li.item.name}</span>
                    </span>
                    <span className={styles.logMeta}>
                      <BlockMinutes minutes={entry.starts[0].li.item.minutes} hidden />{" "}
                      {untilText(model, entry.starts[0].li)}
                    </span>
                    <span className={styles.logSharedCrests}>
                      {entry.starts.map((start) => (
                        <button
                          key={start.li.item.id}
                          type="button"
                          className={styles.logCrest}
                          style={parts.laneVars(start.lane.accent)}
                          data-on={parts.selected === start.li.item.id || undefined}
                          {...cardProps(parts, model, start.lane, start.li)}
                        >
                          <Crest name={start.lane.name} size="1.75rem" />
                          <ChangedDot parts={parts} li={start.li} />
                        </button>
                      ))}
                    </span>
                  </li>
                )
              )}
              {group.continuing.length > 0 && (
                <li className={styles.logContinue}>
                  <ContinueNote model={model} continuing={group.continuing} parts={parts} />
                </li>
              )}
            </ul>
          </li>
        ))}
        <li className={styles.logGroup} data-end>
          <span className={styles.logTime} data-clock>
            {at(model, model.duration)}
          </span>
          <span className={styles.tracks} aria-hidden="true" />
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

function LogLine({ start, model, parts }: { start: Start; model: SplitModel; parts: PhoneParts }) {
  const { lane, li } = start;
  return (
    <button
      type="button"
      className={styles.logLine}
      style={parts.laneVars(lane.accent)}
      data-status={li.item.status}
      data-on={parts.selected === li.item.id || undefined}
      {...cardProps(parts, model, lane, li)}
    >
      <Crest name={lane.name} size="1.375rem" />
      <span className={styles.logTitle}>
        <span className={styles.oneLine}>{li.item.name}</span>
      </span>
      <span className={styles.logMeta}>
        <BlockMinutes minutes={li.item.minutes} hidden />
        <span className={styles.until}>{untilText(model, li)}</span>
      </span>
      <StatusStamp li={li} />
      <ChangedDot parts={parts} li={li} />
    </button>
  );
}

/* ── M3c · Cards in rows ── */

/** Up to four flokkar side by side; five or six as two timelines of three, one under the other. */
function laneSets(lanes: LaneModel[]): LaneModel[][] {
  if (lanes.length <= 4) return [lanes];
  const half = Math.ceil(lanes.length / 2);
  return [lanes.slice(0, half), lanes.slice(half)];
}

/** Every minute at which a card or a wait of these flokkar starts or ends: the grid's lines. */
function rowLines(lanes: LaneModel[], model: SplitModel): number[] {
  const lines = new Set([0, model.duration]);
  for (const lane of lanes) {
    for (const li of lane.items) lines.add(li.start).add(endOf(li));
    if (lane.idle > 0) lines.add(lane.used);
  }
  return [...lines].sort((a, b) => a - b);
}

/** Rem of height per minute, and the least a row between two lines gets. */
const REM_PER_MINUTE = 0.3;
const MIN_ROW_REM = 1.75;

/**
 * The flokkar as columns and time running down, so a card is as tall as its liður: Uglur's
 * 60-min Ratleikur runs past Ernir's three 20-min liðir beside it, and at any height you read
 * across what every flokkur is doing. A row between two lines is 0.3rem a minute (at least
 * 1.75rem), and grows if a card needs more. Five or six flokkar are two timelines of three, as
 * six columns on a phone leave a card 50px. The time of every start is in the margin; a reader
 * hears, at each time, who starts and who is still busy.
 */
function CardRows({ model, parts }: AreaProps) {
  return (
    <div className={styles.area} data-look="m3c">
      <Legend model={model} parts={parts} grid />
      {laneSets(model.lanes).map((lanes, set) => (
        <CardGrid
          key={set}
          model={model}
          lanes={lanes}
          parts={parts}
          label={set === 0 ? "Tímalína" : "Tímalína, seinni flokkarnir"}
        />
      ))}
    </div>
  );
}

function CardGrid({
  model,
  lanes,
  parts,
  label,
}: AreaProps & { lanes: LaneModel[]; label: string }) {
  const lines = rowLines(lanes, model);
  const rowOf = (minute: number) => lines.indexOf(minute) + 2;
  const rows = lines
    .slice(1)
    .map(
      (line, i) => `minmax(${Math.max(MIN_ROW_REM, (line - lines[i]) * REM_PER_MINUTE)}rem, auto)`
    );
  const starts = lines.filter(
    (minute) =>
      minute < model.duration &&
      lanes.some(
        (lane) =>
          lane.items.some((li) => li.start === minute) || (lane.idle > 0 && lane.used === minute)
      )
  );
  const columnOf = (lane: LaneModel) => lanes.indexOf(lane) + 2;
  const subset = { ...model, lanes };
  return (
    <ol
      className={styles.cardGrid}
      aria-label={label}
      style={
        {
          ["--cards" as string]: lanes.length,
          gridTemplateRows: `auto ${rows.join(" ")} auto`,
        } as CSSProperties
      }
    >
      <li className={styles.cardHeads} aria-hidden="true">
        {lanes.map((lane) => (
          <span
            key={lane.patrolId}
            className={styles.cardHead}
            style={{ ...parts.laneVars(lane.accent), gridColumn: columnOf(lane) }}
          >
            <Crest name={lane.name} size="1.375rem" />
            <span className={styles.oneLine}>{lane.name}</span>
          </span>
        ))}
      </li>
      {starts.map((minute) => {
        const busy = continuingAt(subset, minute);
        return (
          <Fragment key={minute}>
            <li
              className={styles.cardMark}
              style={{ gridRow: rowOf(minute) }}
              data-time={at(model, minute)}
            >
              <span className={styles.cardTime} data-clock>
                {at(model, minute)}
              </span>
              {busy.length > 0 && (
                <span className={styles.srOnly}>Heldur áfram: {continuingText(model, busy)}</span>
              )}
            </li>
            {lanes.map((lane) => {
              const li = lane.items.find((entry) => entry.start === minute);
              const place = { gridColumn: columnOf(lane) };
              if (li) {
                return (
                  <li
                    key={li.item.id}
                    className={styles.cardCell}
                    style={{ ...place, gridRow: `${rowOf(minute)} / ${rowOf(endOf(li))}` }}
                  >
                    <MiniCard start={{ kind: "start", lane, li }} model={model} parts={parts} />
                  </li>
                );
              }
              if (lane.idle > 0 && lane.used === minute) {
                const row: Wait = { kind: "wait", lane, minutes: lane.idle };
                return (
                  <li
                    key={`wait-${lane.patrolId}`}
                    className={styles.cardCell}
                    style={{ ...place, gridRow: `${rowOf(minute)} / ${rowOf(model.duration)}` }}
                  >
                    <button
                      type="button"
                      className={styles.miniWait}
                      style={parts.laneVars(lane.accent)}
                      aria-label={waitLabel(row)}
                      onClick={() => parts.addTo(lane)}
                    >
                      <span className={styles.miniTitle}>{waitText(row)}</span>
                      <span className={styles.addMark}>
                        <Plus aria-hidden="true" /> Bæta við
                      </span>
                    </button>
                  </li>
                );
              }
              return null;
            })}
          </Fragment>
        );
      })}
      <li
        className={styles.cardMark}
        data-end
        style={{ gridRow: rowOf(model.duration), gridColumn: "1 / -1" }}
      >
        <span className={styles.cardTime} data-clock>
          {at(model, model.duration)}
        </span>
        <span className={styles.cardEnd}>{endText(model)}</span>
      </li>
    </ol>
  );
}

/**
 * The bank card, narrow and as tall as its liður: the flokkur's colour as its top edge, the
 * name, then the clock, "til 20:10" and the stamp at its foot. The column says the flokkur.
 */
function MiniCard({ start, model, parts }: { start: Start; model: SplitModel; parts: PhoneParts }) {
  const { lane, li } = start;
  return (
    <button
      type="button"
      className={styles.mini}
      style={parts.laneVars(lane.accent)}
      data-status={li.item.status}
      data-on={parts.selected === li.item.id || undefined}
      {...cardProps(parts, model, lane, li)}
    >
      <span className={styles.miniTitle}>{li.item.name}</span>
      <span className={styles.miniFoot}>
        <BlockMinutes minutes={li.item.minutes} hidden />
      </span>
      <span className={styles.miniUntil}>
        {untilText(model, li)}
        <StatusStamp li={li} />
      </span>
      <ChangedDot parts={parts} li={li} />
    </button>
  );
}

/* ── M3d · Threads ── */

/** A flokkur's cord at a minute: in a liður, waiting for the others, or done. */
function cordAt(lane: LaneModel, minute: number, model: SplitModel): "busy" | "wait" | "none" {
  if (lane.items.some((li) => li.start <= minute && endOf(li) > minute)) return "busy";
  if (minute < model.duration) return "wait";
  return "none";
}

/** Extra room under a time, for the minutes until the next: a 30-min gap is taller than 5. */
function gapRem(minutes: number): string {
  return `${Math.max(0, minutes - 10) * 0.08}rem`;
}

/**
 * Every flokkur is a cord down the left, in flokkur order, like branches of a tree: they split
 * off the sveit at the top and join it again at Lok. A liður is a bead on its own cord where it
 * starts, and the cord is thick and solid for as long as it lasts, so a 60-min liður is one
 * long run beside the others' beads; while a flokkur waits for the others its cord is thin and
 * dashed. The space under a time grows a little with the minutes until the next, so the page
 * keeps some of the clock's shape without getting long. After each time's starts, one quiet
 * line says who is still busy ("Heldur áfram · Uglur: Ratleikur til 20:40"). A screen reader
 * hears a plain timeline; the cords are decoration.
 */
function Threads({ model, parts }: AreaProps) {
  const lanes = model.lanes;
  const groups = timeGroups(model);
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
        {groups.map(({ minute, rows, continuing }, g) => {
          const time = at(model, minute);
          const next = groups[g + 1]?.minute ?? model.duration;
          const lastStyle = { ["--gap" as string]: gapRem(next - minute) } as CSSProperties;
          const lineCount = rows.length + (continuing.length > 0 ? 1 : 0);
          return (
            <Fragment key={minute}>
              {rows.map((row, i) => (
                <li
                  key={row.kind === "start" ? row.li.item.id : `wait-${row.lane.patrolId}`}
                  className={styles.thread}
                  data-first={i === 0 || undefined}
                  data-time={time}
                  style={i === lineCount - 1 ? lastStyle : undefined}
                >
                  <span className={styles.threadTime} data-clock={i === 0 || undefined}>
                    {i === 0 ? time : ""}
                  </span>
                  {cords(minute, { lane: row.lane.laneIndex, wait: row.kind === "wait" })}
                  {row.kind === "start" ? (
                    <button
                      type="button"
                      className={styles.threadItem}
                      style={parts.laneVars(row.lane.accent)}
                      data-status={row.li.item.status}
                      data-on={parts.selected === row.li.item.id || undefined}
                      {...cardProps(parts, model, row.lane, row.li)}
                    >
                      <span className={styles.lineText}>
                        <span className={styles.lineTitle}>{row.li.item.name}</span>
                        <span className={styles.lineMeta}>
                          <BlockMinutes minutes={row.li.item.minutes} hidden />
                          <span className={styles.until}>{untilText(model, row.li)}</span>
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
              ))}
              {continuing.length > 0 && (
                <li className={styles.threadBusy} data-time={time} style={lastStyle}>
                  <span className={styles.threadTime} />
                  {cords(minute, null)}
                  <ContinueNote model={model} continuing={continuing} parts={parts} />
                </li>
              )}
            </Fragment>
          );
        })}
        <li className={styles.threadFork} data-end>
          <span className={styles.threadTime} data-clock>
            {at(model, model.duration)}
          </span>
          {cords(model.duration, null, "bottom")}
          <span className={styles.threadNote}>{endText(model)}</span>
        </li>
      </ol>
    </div>
  );
}
