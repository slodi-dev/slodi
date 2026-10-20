import { useId, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Minus, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { MIN_MINUTES } from "@/components/plan/bench/benchState";
import { STATUS_LABEL, type PlanStatus } from "@/services/plan.service";
import {
  SWAP_BLOCKS,
  differences,
  type CardLidur,
  type CardPatch,
  type TroopVersion,
} from "./cardModel";
import type { LaneItem, LaneModel, SplitModel } from "./labBench";
import styles from "./SplitGridLab.module.css";

/**
 * The editor on the back of a turned card (K2). Every change is applied at once through the
 * reducer's `lanePatch`; there is no Save button to forget, and removing is the only step with
 * an Afturkalla.
 */

const STATUSES: PlanStatus[] = ["confirmed", "draft", "tentative", "unknown"];
const MAX_MINUTES = 120;
const STEP = 5;

export type CardActions = {
  patch: (patch: CardPatch) => void;
  swap: (blockId: string) => void;
  reset: () => void;
  remove: () => void;
  moveTo: (toLane: number) => void;
  reorder: (to: number) => void;
  close: () => void;
};

export interface EditorContext {
  model: SplitModel;
  lane: LaneModel;
  li: LaneItem;
  troop: TroopVersion | undefined;
  actions: CardActions;
}

const item = (ctx: EditorContext) => ctx.li.item as CardLidur;

/** Lengd: − 15 mín +. Steps of five, never under five minutes. */
function MinutesField({ ctx }: { ctx: EditorContext }) {
  const { minutes, name } = item(ctx);
  const set = (next: number) =>
    ctx.actions.patch({ minutes: Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, next)) });
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>Lengd</span>
      <span className={styles.stepper} role="group" aria-label={`Lengd ${name}`}>
        <button
          type="button"
          className={styles.stepButton}
          aria-label={`Styttra um ${STEP} mín`}
          disabled={minutes <= MIN_MINUTES}
          onClick={() => set(minutes - STEP)}
        >
          <Minus aria-hidden="true" />
        </button>
        <output className={styles.stepValue} aria-live="polite">
          {minutes} mín
        </output>
        <button
          type="button"
          className={styles.stepButton}
          aria-label={`Lengra um ${STEP} mín`}
          disabled={minutes >= MAX_MINUTES}
          onClick={() => set(minutes + STEP)}
        >
          <Plus aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}

/** Staða: four words as a radio group, the same order as everywhere on the bench. */
function StatusField({ ctx }: { ctx: EditorContext }) {
  const name = useId();
  const { status } = item(ctx);
  return (
    <fieldset className={styles.field}>
      <legend className={styles.fieldLabel}>Staða</legend>
      <span className={styles.segments}>
        {STATUSES.map((s) => (
          <label key={s} className={styles.segment} data-state={s}>
            <input
              type="radio"
              name={name}
              checked={status === s}
              onChange={() => ctx.actions.patch({ status: s })}
            />
            <span>{STATUS_LABEL[s]}</span>
          </label>
        ))}
      </span>
    </fieldset>
  );
}

function LeaderField({ ctx }: { ctx: EditorContext }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        Hver stýrir
      </label>
      <input
        id={id}
        className={styles.input}
        value={item(ctx).leader ?? ""}
        placeholder="Nafn foringja"
        autoComplete="off"
        onChange={(e) => ctx.actions.patch({ leader: e.target.value || null })}
      />
    </div>
  );
}

function NoteField({ ctx }: { ctx: EditorContext }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        Aðlögun fyrir flokkinn
      </label>
      <textarea
        id={id}
        className={styles.input}
        rows={2}
        value={item(ctx).note ?? ""}
        placeholder="T.d. styttri leið, annar staður…"
        onChange={(e) => ctx.actions.patch({ note: e.target.value || null })}
      />
    </div>
  );
}

/** Búnaður: what this flokkur needs for it. Starts as the bank block's own list. */
function GearField({ ctx }: { ctx: EditorContext }) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const gear = item(ctx).gear ?? [];
  const add = () => {
    const name = draft.trim();
    if (!name || gear.some((g) => g.toLocaleLowerCase("is") === name.toLocaleLowerCase("is"))) {
      setDraft("");
      return;
    }
    ctx.actions.patch({ gear: [...gear, name] });
    setDraft("");
  };
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        Búnaður
      </label>
      {gear.length > 0 && (
        <ul className={styles.gear} aria-label="Búnaður">
          {gear.map((g) => (
            <li key={g} className={styles.gearItem}>
              {g}
              <button
                type="button"
                className={styles.gearRemove}
                aria-label={`Taka ${g} af lista`}
                onClick={() => ctx.actions.patch({ gear: gear.filter((x) => x !== g) })}
              >
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <span className={styles.inline}>
        <input
          id={id}
          className={styles.input}
          value={draft}
          placeholder="Bæta við búnaði"
          autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className={styles.quiet} onClick={add} disabled={!draft.trim()}>
          Bæta við
        </button>
      </span>
    </div>
  );
}

/** Another block from the bank, in this flokkur only. A native select: the phone's own picker. */
function SwapField({ ctx }: { ctx: EditorContext }) {
  const id = useId();
  const current = item(ctx);
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        Skipta út fyrir aðra blokk
      </label>
      <select
        id={id}
        className={styles.input}
        value=""
        onChange={(e) => e.target.value && ctx.actions.swap(e.target.value)}
      >
        <option value="">Veldu blokk úr bankanum…</option>
        {SWAP_BLOCKS.filter((b) => b.id !== current.block_id).map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} · {b.minutes} mín
          </option>
        ))}
      </select>
    </div>
  );
}

/** Færa til: every other flokkur by name, then earlier and later in this one. */
function MoveRow({ ctx }: { ctx: EditorContext }) {
  const { model, lane, li, actions } = ctx;
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>Færa til</span>
      <span className={styles.moveRow}>
        {model.lanes
          .filter((other) => other.laneIndex !== lane.laneIndex)
          .map((other) => (
            <button
              key={other.patrolId}
              type="button"
              className={styles.moveTo}
              style={{
                ["--lane" as string]: `var(--sl-color-patrol-${other.accent})`,
              }}
              // The name after a colon, so it never has to be declined after "til".
              aria-label={`Færa ${li.item.name} í annan flokk: ${other.name}`}
              title={other.name}
              onClick={() => actions.moveTo(other.laneIndex)}
            >
              <span className={styles.nameClamp}>{other.name}</span>
            </button>
          ))}
        <button
          type="button"
          className={styles.quiet}
          disabled={li.index === 0}
          aria-label={`Færa ${li.item.name} framar`}
          onClick={() => actions.reorder(li.index - 1)}
        >
          <ArrowUp aria-hidden="true" /> Fyrr
        </button>
        <button
          type="button"
          className={styles.quiet}
          disabled={li.index === lane.items.length - 1}
          aria-label={`Færa ${li.item.name} aftar`}
          onClick={() => actions.reorder(li.index + 1)}
        >
          <ArrowDown aria-hidden="true" /> Síðar
        </button>
      </span>
    </div>
  );
}

/**
 * "Breytt fyrir Refi": what differs from the sveit's version, side by side, and the way back.
 * Nothing when the card is the sveit's version or has none.
 */
function DiffBlock({ ctx }: { ctx: EditorContext }) {
  const diffs = differences(item(ctx), ctx.troop);
  if (!ctx.troop || diffs.length === 0) return null;
  return (
    <div className={styles.diff}>
      <p className={styles.diffTitle}>Breytt fyrir þennan flokk</p>
      <dl className={styles.diffList}>
        {diffs.map((d) => (
          <div key={d.field} className={styles.diffRow}>
            <dt>{d.label}</dt>
            <dd>
              {d.mine} <span className={styles.diffTroop}>(sveitin: {d.troop})</span>
            </dd>
          </div>
        ))}
      </dl>
      <button type="button" className={styles.quiet} onClick={ctx.actions.reset}>
        <RotateCcw aria-hidden="true" /> Nota útgáfu sveitarinnar
      </button>
    </div>
  );
}

function RemoveButton({ ctx }: { ctx: EditorContext }) {
  return (
    <button type="button" className={styles.dangerQuiet} onClick={ctx.actions.remove}>
      <Trash2 aria-hidden="true" /> Fjarlægja úr flokknum
    </button>
  );
}

/** The whole editor on the card's back: heading and Lokið, the changes, then every field. */
export function CardEditor({
  ctx,
  headingId,
  heading,
}: {
  ctx: EditorContext;
  headingId?: string;
  /** Replaces the default heading (the block's name). */
  heading?: ReactNode;
}) {
  return (
    <div className={styles.editor}>
      <div className={styles.editorHead}>
        <h4 id={headingId} className={styles.editorTitle} tabIndex={-1}>
          {heading ?? ctx.li.item.name}
        </h4>
        <button type="button" className={styles.quiet} onClick={ctx.actions.close}>
          Lokið
        </button>
      </div>
      <DiffBlock ctx={ctx} />
      <div className={styles.editorGrid}>
        <MinutesField ctx={ctx} />
        <StatusField ctx={ctx} />
        <LeaderField ctx={ctx} />
        <NoteField ctx={ctx} />
        <GearField ctx={ctx} />
        <SwapField ctx={ctx} />
      </div>
      {/* The moves and remove together: on a phone's sheet they stay at its foot, under the thumb. */}
      <div className={styles.editorActions}>
        <MoveRow ctx={ctx} />
        <div className={styles.editorFoot}>
          <RemoveButton ctx={ctx} />
        </div>
      </div>
    </div>
  );
}
