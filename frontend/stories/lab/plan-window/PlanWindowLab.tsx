"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import type { PatrolAccent } from "@/services/plan.service";
import { PATROL_ACCENTS, resolvePatrolId } from "@/components/plan/planEntries";
import { countIs } from "@/lib/format";
import {
  CHECK_LABEL,
  entryName,
  sliceWindow,
  whenLabel,
  windowSeason,
  type Check,
  type WindowEntry,
  type WindowGrid,
} from "./windowEntries";
import { rhythmText, StatusGlyph, TYPE_LABEL, TypeIcon, type Rhythm } from "./planFamily";
import styles from "./PlanWindowLab.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────── */

/**
 * - `spjold`: index cards, one fundur at a time, tabbed by date like a card box.
 * - `verkefni`: a to-do list; each fundur's open items are the content.
 * - `rod`: a strip of the next few side by side, readiness as a tally.
 * - `naest`: the next fundur big, the rest as a short list under it.
 */
export type WindowLook = "spjold" | "verkefni" | "rod" | "naest";

export interface PlanWindowLabProps {
  look: WindowLook;
  data: WindowGrid;
  today?: Date;
  /** How many fundir ahead the window holds. */
  ahead?: number;
  defaultPatrolId?: string;
  onSelect?: (eventId: string) => void;
}

/* ── Shared pieces ─────────────────────────────────────────────────────────── */

function accentStyle(accent: PatrolAccent): CSSProperties {
  return {
    "--pw-flag": `var(--sl-color-patrol-${accent})`,
    "--pw-flag-fg": `var(--sl-color-patrol-${accent}-foreground)`,
  } as CSSProperties;
}

function PatrolFlag({ name }: { name: string }) {
  return (
    <span className={styles.flag} aria-hidden="true">
      {name.charAt(0)}
    </span>
  );
}

/**
 * Readiness as a tally: one stroke per thing that is settled, the fifth across the gate.
 * A missing stroke is a faint dotted placeholder. A closed gate means the fundur is ready;
 * the text beside it always says the same, so the tally is never the only cue.
 */
function Tally({ checks, size = "md" }: { checks: Check[]; size?: "sm" | "md" }) {
  const verticals = checks.length === 5 ? checks.slice(0, 4) : checks;
  const diagonal = checks.length === 5 ? checks[4] : null;
  const complete = checks.every((c) => c.ok);
  return (
    <svg
      className={styles.tally}
      data-size={size}
      data-complete={complete || undefined}
      viewBox="0 0 40 28"
      aria-hidden="true"
    >
      {verticals.map((check, i) => (
        <line
          key={check.key}
          x1={6 + i * 8}
          y1={3}
          x2={6 + i * 8}
          y2={25}
          data-ok={check.ok || undefined}
        />
      ))}
      {diagonal && <line x1={1} y1={22} x2={35} y2={6} data-ok={diagonal.ok || undefined} />}
    </svg>
  );
}

function readyCount(entry: WindowEntry): string {
  return entry.open.length === 0
    ? "Allt klárt"
    : `${entry.checks.length - entry.open.length} af ${entry.checks.length} klár`;
}

/** The settled items in one phrase: "Dagur, staður og tími klár". */
function settledPhrase(entry: WindowEntry): string | null {
  const ok = entry.checks.filter((c) => c.ok).map((c) => CHECK_LABEL[c.key].toLowerCase());
  if (ok.length === 0) return null;
  const list = ok.length === 1 ? ok[0] : `${ok.slice(0, -1).join(", ")} og ${ok[ok.length - 1]}`;
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} klár`;
}

/** The checklist both the index card and the focus view write out in full. */
function Checklist({ entry }: { entry: WindowEntry }) {
  return (
    <ul className={styles.checklist}>
      {entry.checks.map((check) => (
        <li key={check.key} data-ok={check.ok || undefined}>
          <span className={styles.checkGlyph} aria-hidden="true">
            {check.ok ? "✓" : "○"}
          </span>
          <span className={styles.checkLabel}>{CHECK_LABEL[check.key]}</span>
          <span className={styles.checkText}>{check.text}</span>
        </li>
      ))}
    </ul>
  );
}

function Needs({ entry }: { entry: WindowEntry }) {
  if (entry.needs.length === 0) return null;
  return (
    <p className={styles.needs}>
      <span className={styles.needsLead}>Taka með:</span> {entry.needs.join(", ")}
    </p>
  );
}

/** Status first, in the calendar Staða's marks; the past drops it. */
function Status({ entry }: { entry: WindowEntry }) {
  return entry.isDone ? null : <StatusGlyph status={entry.status} withWord />;
}

/**
 * What makes this fundur not the usual weekly one: its type (with the calendar's icon),
 * that it moved, and whether the whole sveit is on it. Nothing for the routine fundur.
 */
function Exception({ entry }: { entry: WindowEntry }) {
  return (
    <>
      {entry.type !== "flokks" && (
        <span className={styles.kind}>
          <TypeIcon type={entry.type} size={14} /> {TYPE_LABEL[entry.type]}
        </span>
      )}
      {entry.moved && <span className={styles.kind}>Breyttur tími</span>}
      {entry.isTroopWide && <span className={styles.troop}>Öll sveitin</span>}
    </>
  );
}

/** The leader's question, answered first: how much is still open, and over how many fundir. */
function Summary({ ahead, rhythm }: { ahead: WindowEntry[]; rhythm: Rhythm | null }) {
  const open = ahead.reduce((sum, e) => sum + e.open.length, 0);
  const fundir = countIs(ahead.length, "fundi", "fundum");
  const exceptions = ahead.filter((e) => !e.routine).length;
  return (
    <div className={styles.summary}>
      <p>
        {open === 0 ? (
          <span className={styles.summaryLead}>Allt klárt í {fundir} framundan.</span>
        ) : (
          <>
            <span className={styles.summaryLead}>
              {countIs(open, "atriði opið", "atriði opin")}
            </span>{" "}
            í {fundir} framundan.
          </>
        )}
      </p>
      <p className={styles.summaryMeta}>
        {rhythm && <>Vikulegur fundur {rhythmText(rhythm)}. </>}
        {exceptions > 0 && `${countIs(exceptions, "frávik", "frávik")} frá venjunni.`}
      </p>
    </div>
  );
}

/* ── A · Spjöld (index cards) ──────────────────────────────────────────────── */

function Cards({ behind, ahead, onSelect }: LookProps) {
  const all = behind ? [behind, ...ahead] : ahead;
  const [selected, setSelected] = useState(behind ? 1 : 0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const current = all[Math.min(selected, all.length - 1)];
  const index = all.indexOf(current);

  const go = (to: number, focus = false) => {
    const next = Math.max(0, Math.min(all.length - 1, to));
    setSelected(next);
    if (focus) tabs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: all.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    go(moves[event.key], true);
  };

  return (
    <div className={styles.cards}>
      <div
        className={styles.cardTabs}
        role="tablist"
        aria-label="Fundir í glugganum"
        onKeyDown={onKeyDown}
      >
        {all.map((entry, i) => (
          <button
            key={entry.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${i}`}
            aria-controls={`${baseId}-panel`}
            aria-selected={i === index}
            aria-label={entryName(entry)}
            tabIndex={i === index ? 0 : -1}
            className={styles.cardTab}
            data-done={entry.isDone || undefined}
            onClick={() => go(i)}
          >
            {entry.type !== "flokks" && <TypeIcon type={entry.type} size={14} />}
            <span className={styles.cardTabWhen}>
              {entry.day || entry.weekStart
                ? whenLabel(entry).replace(/^Vika frá /, "")
                : entry.week.label}
            </span>
            {entry.isDone ? (
              <span className={styles.cardTabDone}>Búið</span>
            ) : (
              <Tally checks={entry.checks} size="sm" />
            )}
          </button>
        ))}
      </div>

      <div
        key={current.id}
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${index}`}
        className={styles.card}
        data-done={current.isDone || undefined}
        data-more={index < all.length - 1 || undefined}
      >
        <div className={styles.cardHead}>
          <span className={styles.cardWhen}>
            {whenLabel(current)}
            {current.clock && <span className={styles.cardClock}> kl. {current.clock}</span>}
          </span>
          <Exception entry={current} />
          {current.isDone && <span className={styles.stamp}>Búið</span>}
        </div>
        <h3 className={styles.cardTitle}>
          {current.title} <Status entry={current} />
        </h3>
        {!current.isDone && (
          <>
            <Checklist entry={current} />
            <Needs entry={current} />
          </>
        )}
        <button type="button" className={styles.action} onClick={() => onSelect?.(current.id)}>
          Opna fundinn
        </button>
      </div>

      <div className={styles.cardNav}>
        <button
          type="button"
          className={styles.navButton}
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          Fyrri fundur
        </button>
        <span className={styles.cardCount}>
          {index + 1} af {all.length}
        </span>
        <button
          type="button"
          className={styles.navButton}
          disabled={index === all.length - 1}
          onClick={() => go(index + 1)}
        >
          Næsti fundur
        </button>
      </div>
    </div>
  );
}

/* ── B · Verkefni (to-do) ──────────────────────────────────────────────────── */

function Todo({ behind, ahead, onSelect }: LookProps) {
  return (
    <ol className={styles.todo}>
      {behind && (
        <li className={styles.todoBehind}>
          <button
            type="button"
            className={styles.todoHead}
            aria-label={entryName(behind)}
            onClick={() => onSelect?.(behind.id)}
          >
            <span className={styles.todoWhen}>Síðast · {whenLabel(behind)}</span>
            <span className={styles.todoTitle}>{behind.title}</span>
            <span className={styles.todoBadge}>Búið</span>
          </button>
        </li>
      )}
      {ahead.map((entry) => {
        const settled = settledPhrase(entry);
        // The weekly fundur with nothing left to do needs no list: one quiet line.
        const quiet = entry.routine && entry.open.length === 0;
        return (
          <li
            key={entry.id}
            className={styles.todoFundur}
            data-ready={entry.open.length === 0 || undefined}
            data-quiet={quiet || undefined}
          >
            <button
              type="button"
              className={styles.todoHead}
              aria-label={entryName(entry)}
              onClick={() => onSelect?.(entry.id)}
            >
              <span className={styles.todoWhen}>
                {whenLabel(entry)}
                {entry.clock && ` kl. ${entry.clock}`}
              </span>
              <span className={styles.todoTitle}>
                <Exception entry={entry} />
                {entry.title} <Status entry={entry} />
              </span>
              <span className={styles.todoBadge}>{readyCount(entry)}</span>
            </button>
            {!quiet && (
              <>
                <ul className={styles.todoItems}>
                  {entry.open.map((check) => (
                    <li key={check.key} className={styles.todoItem}>
                      <span className={styles.todoBox} aria-hidden="true" />
                      {check.text}
                    </li>
                  ))}
                  {settled && (
                    <li className={styles.todoSettled}>
                      <span aria-hidden="true">✓ </span>
                      {settled}
                    </li>
                  )}
                </ul>
                <Needs entry={entry} />
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ── C · Röð (strip with a tally) ──────────────────────────────────────────── */

function Strip({ behind, ahead, onSelect }: LookProps) {
  const all = behind ? [behind, ...ahead] : ahead;
  return (
    <ol className={styles.strip} style={{ "--pw-count": all.length } as CSSProperties}>
      {all.map((entry) => {
        // "þri 20. okt." → a small weekday, a big day number, the month. A span keeps its tail.
        const [first, ...tail] = whenLabel(entry).split("–");
        const [weekday, day, ...month] = first.split(" ");
        const firstOpen = entry.open[0];
        return (
          <li
            key={entry.id}
            className={styles.stripItem}
            data-done={entry.isDone || undefined}
            data-status={entry.status}
          >
            <button
              type="button"
              className={styles.stripButton}
              aria-label={entryName(entry)}
              onClick={() => onSelect?.(entry.id)}
            >
              <span className={styles.stripDate}>
                {entry.day ? (
                  <>
                    {weekday} <span className={styles.stripDay}>{day}</span> {month.join(" ")}
                    {tail.length > 0 && `–${tail.join("–")}`}
                  </>
                ) : (
                  whenLabel(entry)
                )}
                {entry.clock && <span className={styles.stripClock}> {entry.clock}</span>}
              </span>
              <span className={styles.stripTitle}>
                <Exception entry={entry} />
                {entry.title} <Status entry={entry} />
              </span>
              {entry.isDone ? (
                <span className={styles.stripState}>Búið</span>
              ) : (
                <span className={styles.stripMeter}>
                  <Tally checks={entry.checks} />
                  <span className={styles.stripState}>
                    <strong>{readyCount(entry)}</strong>
                    {firstOpen && <span className={styles.stripMissing}>{firstOpen.text}</span>}
                    {entry.open.length > 1 && (
                      <span className={styles.stripMissing}>
                        og {countIs(entry.open.length - 1, "atriði", "atriði")} í viðbót
                      </span>
                    )}
                  </span>
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ── D · Næst (focus) ──────────────────────────────────────────────────────── */

function Focus({ behind, ahead, onSelect }: LookProps) {
  const [next, ...rest] = ahead;
  return (
    <div className={styles.focus}>
      <section className={styles.focusMain} aria-label="Næsti fundur">
        <p className={styles.overline}>Næsti fundur</p>
        <p className={styles.focusWhen}>
          {whenLabel(next)}
          {next.clock && <span className={styles.focusClock}> kl. {next.clock}</span>}
        </p>
        <h3 className={styles.focusTitle}>
          <button
            type="button"
            className={styles.focusTitleButton}
            aria-label={entryName(next)}
            onClick={() => onSelect?.(next.id)}
          >
            <Exception entry={next} />
            {next.title} <Status entry={next} />
          </button>
        </h3>
        <div className={styles.focusReady}>
          <Tally checks={next.checks} />
          <span>{readyCount(next)}</span>
        </div>
        <Checklist entry={next} />
        <Needs entry={next} />
      </section>

      {rest.length > 0 && (
        <section className={styles.focusRestWrap} aria-label="Svo">
          <h3 className={styles.focusRestTitle}>Svo</h3>
          <ol className={styles.focusRest}>
            {rest.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={styles.focusRow}
                  aria-label={entryName(entry)}
                  onClick={() => onSelect?.(entry.id)}
                >
                  <span className={styles.focusRowWhen}>{whenLabel(entry)}</span>
                  <span className={styles.focusRowTitle}>
                    <Exception entry={entry} />
                    {entry.title} <Status entry={entry} />
                  </span>
                  <span className={styles.focusRowReady}>
                    <Tally checks={entry.checks} size="sm" />
                    {entry.open.length === 0
                      ? "Klár"
                      : `${entry.checks.length - entry.open.length}/${entry.checks.length}`}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {behind && (
        <p className={styles.focusBehind}>
          Síðast:{" "}
          <button
            type="button"
            className={styles.linkish}
            aria-label={entryName(behind)}
            onClick={() => onSelect?.(behind.id)}
          >
            {behind.title}
          </button>{" "}
          · {whenLabel(behind)}
        </p>
      )}
    </div>
  );
}

/* ── The lab component ─────────────────────────────────────────────────────── */

interface LookProps {
  behind: WindowEntry | null;
  ahead: WindowEntry[];
  onSelect?: (id: string) => void;
}

const LOOKS: Record<WindowLook, (props: LookProps) => ReactNode> = {
  spjold: Cards,
  verkefni: Todo,
  rod: Strip,
  naest: Focus,
};

export default function PlanWindowLab({
  look,
  data,
  today,
  ahead = 4,
  defaultPatrolId,
  onSelect,
}: PlanWindowLabProps) {
  const now = useMemo(() => today ?? new Date(), [today]);
  const selectId = useId();
  const [patrolId, setPatrolId] = useState<string | null>(defaultPatrolId ?? null);
  const activePatrolId = resolvePatrolId(data, patrolId);
  const patrolIndex = Math.max(
    0,
    data.patrols.findIndex((p) => p.id === activePatrolId)
  );
  const patrol = data.patrols[patrolIndex];
  const accent = patrol?.accent ?? PATROL_ACCENTS[patrolIndex % PATROL_ACCENTS.length];

  const { entries, rhythm } = useMemo(
    () => windowSeason(data, activePatrolId, now),
    [data, activePatrolId, now]
  );
  const windowed = useMemo(() => sliceWindow(entries, ahead), [entries, ahead]);

  if (data.patrols.length === 0) {
    return (
      <div className={styles.root} data-look={look}>
        <p className={styles.empty}>Engir flokkar til að sýna enn.</p>
      </div>
    );
  }

  const Look = LOOKS[look];
  const { behind } = windowed;

  return (
    <div className={styles.root} data-look={look} style={accentStyle(accent)}>
      <div className={styles.head}>
        {patrol && <PatrolFlag name={patrol.name} />}
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
      ) : windowed.ahead.length === 0 ? (
        <div className={styles.nothing}>
          <p className={styles.summaryLead}>Ekkert skráð framundan hjá þessum flokki.</p>
          {behind && (
            <p className={styles.empty}>
              Síðast:{" "}
              <button
                type="button"
                className={styles.linkish}
                aria-label={entryName(behind)}
                onClick={() => onSelect?.(behind.id)}
              >
                {behind.title}
              </button>{" "}
              · {whenLabel(behind)}
            </p>
          )}
        </div>
      ) : (
        <>
          <Summary ahead={windowed.ahead} rhythm={rhythm} />
          <Look key={activePatrolId} behind={behind} ahead={windowed.ahead} onSelect={onSelect} />
        </>
      )}
    </div>
  );
}
