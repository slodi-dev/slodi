/**
 * The split band on a phone: M3b · Ruled log, picked from M1–M4 and M3a–d (MDX, section 9).
 * The desktop K2 grid squeezed onto a phone shows one and a half flokkar and cuts the second
 * column's cards mid-word; a run sheet reads top to bottom with one thumb and needs no sideways
 * scrolling at all.
 *
 * The sheet, top to bottom:
 * - the flokkar (crest, name, total, "ræður lengd" or the wait);
 * - a strip that stays at the top while the sheet scrolls: the crests in track order, so the
 *   tracks below can be read without scrolling back up;
 * - one group per start time: the time in a mono margin, a gutter with one track per flokkur,
 *   then one ruled 48px line per start ("Eldfæri og prímus", "Ernir · 20 mín · til 20:15");
 * - the track is the H6 cord, run down the sheet: a bead where a liður starts, solid for as long
 *   as it lasts, dashed while the flokkur waits, so liðir of different lengths read as parallel
 *   cords and a 60-min liður visibly runs past the others' starts;
 * - under a time's lines, the flokkar still busy from an earlier start, as crests with their end
 *   ("til 20:40"); a reader hears the liður names;
 * - a waiting flokkur's line, with "+ Bæta við";
 * - "Lok" under a closing rule.
 * A tap opens the card's back as a sheet from the bottom (SplitGridLab's PhoneSheet). Split,
 * merge, Afturkalla and every edit are the band's own. Nothing on a phone is dragged: the rows
 * are times, not places.
 */
import type { CSSProperties } from "react";
import { Plus } from "lucide-react";
import { BlockMinutes } from "@/components/plan/bench/BlockCard";
import { Stamp } from "@/components/plan/calendar/Stamp";
import type { PatrolAccent } from "@/services/plan.service";
import { Crest } from "./laneHeaders";
import { at, type LaneItem, type LaneModel, type SplitModel } from "./labBench";
import styles from "./phoneLayouts.module.css";

/** The band's own width at or under which the run sheet takes over from the grid, in px. */
export const PHONE_MAX_WIDTH = 620;

/** What the band hands the run sheet: the card's behaviour and the lane colours. */
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

type Start = { kind: "start"; lane: LaneModel; li: LaneItem };
type Wait = { kind: "wait"; lane: LaneModel; minutes: number };
type Row = Start | Wait;
/** A flokkur in the middle of a liður that started before this time. */
type Continue = { lane: LaneModel; li: LaneItem };
type TimeGroup = { minute: number; rows: Row[]; continuing: Continue[] };
/** One line of a group: a wait, or a liður starting for one flokkur or several at once. */
type LogEntry = Wait | { kind: "shared"; starts: Start[] };
type TrackState = "start" | "busy" | "wait" | "none";

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

/** Where a flokkur's cord is at a time: starting a liður, in one, waiting, or done. */
function trackAt(lane: LaneModel, group: TimeGroup, model: SplitModel): TrackState {
  if (group.rows.some((row) => row.kind === "start" && row.lane === lane)) return "start";
  if (group.continuing.some((item) => item.lane === lane)) return "busy";
  if (group.minute >= lane.used && group.minute < model.duration) return "wait";
  return "none";
}

/**
 * A card's button props, with when it ends added to its name, so a reader hears the span the
 * line shows ("Ernir kl. 19:55: Eldfæri og prímus, 20 mín, staðfest, til 20:15").
 */
function cardProps(parts: PhoneParts, model: SplitModel, lane: LaneModel, li: LaneItem) {
  const props = parts.itemProps(lane, li);
  return { ...props, "aria-label": `${props["aria-label"]}, ${untilText(model, li)}` };
}

/** "70 mín" over "ræður lengd" or "30 mín bið": two short lines, never a dangling "·". */
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
      {state && <span className={lane.longest ? styles.leads : undefined}>{state}</span>}
    </span>
  );
}

/** The flokkar, two across, each with its crest, name (two lines at most), total and wait. */
function Legend({ model, parts }: AreaProps) {
  return (
    <ul className={styles.legend} aria-label="Flokkarnir">
      {model.lanes.map((lane) => (
        <li key={lane.patrolId} className={styles.legendItem} style={parts.laneVars(lane.accent)}>
          <Crest name={lane.name} size="1.5rem" />
          <span className={styles.legendText}>
            <span className={styles.twoLines} title={lane.name}>
              {lane.name}
            </span>
            <LaneNums lane={lane} model={model} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The key that stays at the top while the sheet scrolls: a cap on each track, then the crests
 * in the same order, so a cord far down the sheet can still be told by its colour and place.
 */
function TrackKey({ model, parts }: AreaProps) {
  return (
    <div className={styles.key} aria-hidden="true">
      <span className={styles.keyTime}>kl.</span>
      <span className={styles.tracks}>
        {model.lanes.map((lane) => (
          <span
            key={lane.patrolId}
            className={styles.track}
            style={parts.laneVars(lane.accent)}
            data-state="cap"
          />
        ))}
      </span>
      <span className={styles.keyCrests}>
        {model.lanes.map((lane) => (
          <span key={lane.patrolId} style={parts.laneVars(lane.accent)} title={lane.name}>
            <Crest name={lane.name} size="1.375rem" />
          </span>
        ))}
      </span>
    </div>
  );
}

function StatusStamp({ li }: { li: LaneItem }) {
  return <Stamp entry={{ id: li.item.id, status: li.item.status, type: "flokks" }} size="sm" />;
}

function ChangedDot({ parts, li }: { parts: PhoneParts; li: LaneItem }) {
  return parts.changed(li) ? (
    <span className={styles.changedDot} title="Breytt fyrir þennan flokk" aria-hidden="true" />
  ) : null;
}

/** "Refir · ⏱ 30 mín til 20:10": the flokkur's name gives way first, the times never. */
function LineMeta({ who, model, li }: { who?: string; model: SplitModel; li: LaneItem }) {
  return (
    <span className={styles.lineMeta}>
      {who && (
        <>
          <span className={styles.who}>{who}</span>
          <span aria-hidden="true">·</span>
        </>
      )}
      <BlockMinutes minutes={li.item.minutes} hidden />
      <span className={styles.until}>{untilText(model, li)}</span>
    </span>
  );
}

/** One liður starting for one flokkur: crest, then the title and stamp over the meta line. */
function LogLine({ start, model, parts }: { start: Start; model: SplitModel; parts: PhoneParts }) {
  const { lane, li } = start;
  return (
    <button
      type="button"
      className={styles.line}
      style={parts.laneVars(lane.accent)}
      data-status={li.item.status}
      data-on={parts.selected === li.item.id || undefined}
      {...cardProps(parts, model, lane, li)}
    >
      <Crest name={lane.name} size="1.5rem" />
      <span className={styles.lineText}>
        <span className={styles.titleRow}>
          <span className={styles.lineTitle}>{li.item.name}</span>
          <span className={styles.marks}>
            <ChangedDot parts={parts} li={li} />
            <StatusStamp li={li} />
          </span>
        </span>
        <LineMeta who={lane.name} model={model} li={li} />
      </span>
    </button>
  );
}

/** The same liður starting for several flokkar at once: the liður once, a crest button each. */
function SharedLine({
  starts,
  model,
  parts,
}: {
  starts: Start[];
  model: SplitModel;
  parts: PhoneParts;
}) {
  const [first] = starts;
  return (
    <div className={styles.shared}>
      <span className={styles.lineText}>
        <span className={styles.titleRow}>
          <span className={styles.lineTitle}>{first.li.item.name}</span>
          <span className={styles.marks}>
            <StatusStamp li={first.li} />
          </span>
        </span>
        <LineMeta model={model} li={first.li} />
      </span>
      <span className={styles.sharedCrests}>
        {starts.map(({ lane, li }) => (
          <button
            key={li.item.id}
            type="button"
            className={styles.crestButton}
            style={parts.laneVars(lane.accent)}
            data-on={parts.selected === li.item.id || undefined}
            {...cardProps(parts, model, lane, li)}
          >
            <Crest name={lane.name} size="1.75rem" />
            <ChangedDot parts={parts} li={li} />
          </button>
        ))}
      </span>
    </div>
  );
}

/** A flokkur done before the band: its wait, and a button that fills it. */
function WaitLine({ row, parts }: { row: Wait; parts: PhoneParts }) {
  const empty = row.lane.items.length === 0;
  return (
    <button
      type="button"
      className={styles.wait}
      style={parts.laneVars(row.lane.accent)}
      aria-label={`${empty ? "Ekkert skráð" : `${row.minutes} mín bið`}. Bæta verkefni við (${row.lane.name})`}
      onClick={() => parts.addTo(row.lane)}
    >
      <Crest name={row.lane.name} size="1.5rem" />
      <span className={styles.lineText}>
        <span className={styles.lineTitle} data-quiet>
          {empty ? "Ekkert skráð" : `${row.minutes} mín bið`}
        </span>
        <span className={styles.lineMeta}>
          <span className={styles.who}>{row.lane.name}</span>
        </span>
      </span>
      <span className={styles.add}>
        <Plus aria-hidden="true" />
        Bæta við
      </span>
    </button>
  );
}

/**
 * Every flokkur still busy at this time, as its crest and when it ends ("Áfram til [crest]
 * 20:40"), wrapping rather than cut off. The liður's name is up the sheet where it started; a reader hears it here.
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
  return (
    <div className={styles.continue}>
      <span className={styles.continueLead} aria-hidden="true">
        Áfram til
      </span>
      {continuing.map(({ lane, li }) => (
        <span
          key={lane.patrolId}
          className={styles.continueItem}
          style={parts.laneVars(lane.accent)}
          title={`${lane.name}: ${li.item.name}`}
          aria-hidden="true"
        >
          <Crest name={lane.name} size="1rem" />
          {li.clockEnd ?? at(model, endOf(li))}
        </span>
      ))}
      <span className={styles.srOnly}>
        Heldur áfram:{" "}
        {continuing
          .map(({ lane, li }) => `${lane.name}: ${li.item.name} ${untilText(model, li)}`)
          .join(" · ")}
      </span>
    </div>
  );
}

/** One cord per flokkur beside a group, as the H6 cord: bead, solid, dashed or nothing. */
function Tracks({ model, parts, states }: AreaProps & { states?: TrackState[] }) {
  return (
    <span className={styles.tracks} aria-hidden="true">
      {model.lanes.map((lane, index) => (
        <span
          key={lane.patrolId}
          className={styles.track}
          style={parts.laneVars(lane.accent)}
          data-state={states?.[index] ?? "none"}
        />
      ))}
    </span>
  );
}

/** "Lok · allir koma saman" at the band's end. */
function endText(model: SplitModel): string {
  return model.lanes.length > 1 ? "Lok · allir koma saman" : "Lok";
}

/** The run sheet. */
export function PhoneArea({ model, parts }: AreaProps) {
  return (
    <div
      className={styles.area}
      style={{ ["--tracks" as string]: model.lanes.length } as CSSProperties}
    >
      <Legend model={model} parts={parts} />
      <div className={styles.sheet}>
        <TrackKey model={model} parts={parts} />
        <ol className={styles.log} aria-label="Tímalína">
          {timeGroups(model).map((group) => (
            <li key={group.minute} className={styles.group} data-time={at(model, group.minute)}>
              <span className={styles.time} data-clock>
                {at(model, group.minute)}
              </span>
              <Tracks
                model={model}
                parts={parts}
                states={model.lanes.map((lane) => trackAt(lane, group, model))}
              />
              <ul className={styles.lines}>
                {shared(group.rows).map((entry) => (
                  <li
                    key={
                      entry.kind === "wait"
                        ? `wait-${entry.lane.patrolId}`
                        : entry.starts[0].li.item.id
                    }
                  >
                    {entry.kind === "wait" ? (
                      <WaitLine row={entry} parts={parts} />
                    ) : entry.starts.length === 1 ? (
                      <LogLine start={entry.starts[0]} model={model} parts={parts} />
                    ) : (
                      <SharedLine starts={entry.starts} model={model} parts={parts} />
                    )}
                  </li>
                ))}
                {group.continuing.length > 0 && (
                  <li>
                    <ContinueNote model={model} continuing={group.continuing} parts={parts} />
                  </li>
                )}
              </ul>
            </li>
          ))}
          <li className={styles.group} data-end>
            <span className={styles.time} data-clock>
              {at(model, model.duration)}
            </span>
            <Tracks model={model} parts={parts} />
            <span className={styles.end}>{endText(model)}</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
