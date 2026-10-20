import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useDndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { Link2, MessageSquareText, Pencil, UserRound } from "lucide-react";
import { BlockKindLine, BlockMarker, blockCardStyles } from "@/components/plan/bench/BlockCard";
import { MIN_MINUTES } from "@/components/plan/bench/benchState";
import { dragId } from "@/components/plan/bench/dnd";
import { Stamp } from "@/components/plan/calendar/Stamp";
import { countIs } from "@/lib/format";
import {
  BANDS,
  BAND_KIND,
  BAND_OF,
  STATUS_LABEL,
  type BandId,
  type Fundur,
  type PatrolAccent,
  type PlanBenchData,
} from "@/services/plan.service";
import {
  CardEditor,
  DiffBlock,
  MinutesField,
  StatusField,
  type CardActions,
  type EditorContext,
} from "./CardEditor";
import {
  SWAP_BLOCKS,
  blockOf,
  differences,
  resetPatch,
  swapPatch,
  troopKeyOf,
  troopVersions,
  versionPatch,
  type CardLidur,
  type CardPatch,
  type TroopVersion,
} from "./cardModel";
import {
  LabBench,
  at,
  balanceSentence,
  planMerge,
  splitModel,
  useLabBench,
  type LaneItem,
  type LaneModel,
  type MergeKeep,
  type MergePlan,
  type SplitModel,
} from "./labBench";
import { LAB_FUNDUR } from "./splitGridLabData";
import styles from "./SplitGridLab.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────── */

/**
 * The split band built from the bank's own cards, editable per flokkur. The form is the current
 * SplitGrid's (time down the side, a column per flokkur, "Lengsti flokkur ræður", the merge
 * proposal), and each liður is the BlockPalette card it came from. The four directions differ
 * in how a card is edited:
 *
 * - `face`: K1 · On the card. The open card grows in place with the quick edits on its face
 *   (length, status); "Fleira" opens the rest underneath.
 * - `flip`: K2 · Flip it over. The card turns to its back, which is the whole editor.
 * - `panel`: K3 · Editor panel. The grid stays still; the open card is the header of a panel
 *   beside it (a bottom sheet on a phone).
 * - `sync`: K4 · Follows the sveit. Every card says whether it is the sveit's version or
 *   changed for this flokkur, and an edit can go to this flokkur or to every flokkur that
 *   still follows the sveit.
 */
export type CardLook = "face" | "flip" | "panel" | "sync";

export interface SplitGridLabProps {
  /** Which editing direction to render. */
  look: CardLook;
  data: PlanBenchData;
  fundurId?: string;
  band?: BandId;
  /** Open the merge confirmation straight away. */
  defaultMergeOpen?: boolean;
  /** Open this liður's card straight away (by name and flokkur). */
  defaultOpen?: { patrolId: string; name: string };
}

/* ── Root ──────────────────────────────────────────────────────────────────── */

export default function SplitGridLab({ data, ...props }: SplitGridLabProps) {
  return (
    <LabBench data={data}>
      <SplitBand {...props} />
    </LabBench>
  );
}

/** What every direction gets from the band: the model, the move paths and the card edits. */
type Ctx = {
  look: CardLook;
  model: SplitModel;
  selected: string | null;
  hintId: string;
  troop: Map<string, TroopVersion>;
  itemProps: (lane: LaneModel, li: LaneItem) => ItemProps;
  editorFor: (lane: LaneModel, li: LaneItem) => EditorContext;
  addTo: (lane: LaneModel) => void;
};

type ItemProps = {
  "data-lidur-id": string;
  "aria-label": string;
  "aria-describedby": string;
  "aria-expanded": boolean;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
};

type Undo = { fundur: Fundur; text: string; restored: string };

function SplitBand({
  look,
  fundurId = LAB_FUNDUR,
  band = "kjarni",
  defaultMergeOpen = false,
  defaultOpen,
}: Omit<SplitGridLabProps, "data">) {
  const { state, dispatch } = useLabBench();
  const fundur = state.data.fundir.find((f) => f.event_id === fundurId);
  const model = fundur ? splitModel(fundur, band, state.data.patrols) : null;
  const selected = state.laneSelected;

  const rootRef = useRef<HTMLDivElement>(null);
  const mergeButtonRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const hintId = useId();
  const mergeId = useId();
  const [mergeOpen, setMergeOpen] = useState(defaultMergeOpen);
  // Focus moves into the confirmation only when the leader opened it, not when a story starts
  // with it open (that would scroll a Docs page to it).
  const [mergeOpenedByUser, setMergeOpenedByUser] = useState(false);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [said, setSaid] = useState<{ text: string; seq: number }>({ text: "", seq: 0 });

  /*
   * The sveit's version of each shared liður, taken when the band is first drawn (what most
   * flokkar have). It only changes when an edit is sent to every flokkur that follows it (K4),
   * so changing one flokkur's card never quietly redefines the sveit's.
   */
  const [troop, setTroop] = useState<Map<string, TroopVersion>>(() =>
    troopVersions(model?.lanes.map((lane) => lane.items.map((li) => li.item as CardLidur)) ?? [])
  );

  /*
   * Focus follows a moved liður. The block unmounts from one lane and mounts in another, so
   * without this a second → press lands on nothing and the leader has to find the block again.
   */
  const focusTarget = useRef<string | null>(null);
  useEffect(() => {
    const id = focusTarget.current;
    if (!id) return;
    focusTarget.current = null;
    if (id === "undo") {
      undoRef.current?.focus();
      return;
    }
    rootRef.current?.querySelector<HTMLElement>(`[data-lidur-id="${CSS.escape(id)}"]`)?.focus();
  }, [state.data, state.laneSelected]);

  // A story can start with one card open.
  const openedDefault = useRef(false);
  useEffect(() => {
    if (openedDefault.current || !defaultOpen || !model) return;
    openedDefault.current = true;
    const lane = model.lanes.find((l) => l.patrolId === defaultOpen.patrolId);
    const li = lane?.items.find((entry) => entry.item.name === defaultOpen.name);
    if (li) dispatch({ t: "laneSelect", id: li.item.id });
  }, [defaultOpen, model, dispatch]);

  // UX rule 5: "Afturkalla" stays for at least 8 seconds.
  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  if (!fundur) return null;

  const restore = () => {
    if (!undo) return;
    dispatch({ t: "labRestore", fundur: undo.fundur, text: undo.restored });
    setUndo(null);
  };

  if (!model) {
    return (
      <MergedBand
        fundur={fundur}
        band={band}
        undo={undo}
        onUndo={restore}
        onSplit={() => dispatch({ t: "splitBand", fundurId, band })}
      />
    );
  }

  const plan = planMerge(
    model.lanes.map((lane) => ({
      patrol_id: lane.patrolId,
      items: lane.items.map((li) => li.item),
    }))
  );

  const merge = (keep: MergeKeep) => {
    const dropped = keep === "all" ? 0 : (plan.droppedIfKeep[keep]?.length ?? 0);
    setUndo({
      fundur,
      text: dropped
        ? `Sameinað. ${countIs(dropped, "liður féll", "liðir féllu")} út.`
        : "Sameinað í eina röð. Ekkert féll út.",
      restored: "Sameining afturkölluð. Flokkarnir hafa aftur hver sína dagskrá.",
    });
    setMergeOpen(false);
    dispatch({ t: "labMerge", fundurId, band, keep });
  };

  const moveTo = (lane: LaneModel, li: LaneItem, toLane: number) => {
    if (toLane < 0 || toLane >= model.lanes.length || toLane === lane.laneIndex) return;
    dispatch({
      t: "laneMoveAcross",
      fundurId,
      band,
      fromLane: lane.laneIndex,
      toLane,
      id: li.item.id,
    });
    // The reducer selects a moved liður, and here selected means open. A card moved with ← →
    // stays as it was: closed cards stay closed, an open one follows its card.
    if (selected !== li.item.id) dispatch({ t: "laneSelect", id: null });
    focusTarget.current = li.item.id;
  };

  const reorder = (lane: LaneModel, li: LaneItem, to: number) => {
    if (to < 0 || to >= lane.items.length) return;
    dispatch({ t: "laneMove", fundurId, band, laneIndex: lane.laneIndex, id: li.item.id, to });
    focusTarget.current = li.item.id;
  };

  const say = (text: string) => setSaid((s) => ({ text, seq: s.seq + 1 }));

  /** One card's change, in its own lane. */
  const patchOne = (lane: LaneModel, id: string, patch: CardPatch) =>
    dispatch({ t: "lanePatch", fundurId, band, laneIndex: lane.laneIndex, id, patch });

  /**
   * "Hjá öllum flokkum sem fylgja sveitinni": the same change on every card that is still the
   * sveit's version, and the sveit's version itself. A card already changed for its flokkur is
   * left alone, so one flokkur's adaptation is never overwritten from another column.
   */
  const patchFollowers = (li: LaneItem, patch: CardPatch): number => {
    const key = troopKeyOf(li.item as CardLidur);
    const version = troop.get(key);
    if (!version) return 0;
    let n = 0;
    for (const lane of model.lanes) {
      for (const entry of lane.items) {
        const card = entry.item as CardLidur;
        if (troopKeyOf(card) !== key) continue;
        if (entry.item.id !== li.item.id && differences(card, version).length > 0) continue;
        patchOne(lane, entry.item.id, patch);
        n += 1;
      }
    }
    setTroop((map) => new Map(map).set(key, versionPatch(version, patch)));
    return n;
  };

  const editorFor = (lane: LaneModel, li: LaneItem): EditorContext => {
    const card = li.item as CardLidur;
    const version = troop.get(troopKeyOf(card));
    const actions: CardActions = {
      patch: (patch) => patchOne(lane, li.item.id, patch),
      swap: (blockId) => {
        const block = SWAP_BLOCKS.find((b) => b.id === blockId);
        if (!block) return;
        patchOne(lane, li.item.id, swapPatch(card, block));
        say(`${lane.name}: ${block.name} í stað ${li.item.name}.`);
      },
      reset: () => {
        if (!version) return;
        patchOne(lane, li.item.id, resetPatch(version));
        say(`${lane.name}: ${li.item.name} er aftur eins og hjá sveitinni.`);
      },
      remove: () => {
        setUndo({
          fundur,
          text: `Liðurinn ${li.item.name} var fjarlægður (${lane.name}).`,
          restored: `Liðurinn ${li.item.name} er kominn aftur (${lane.name}).`,
        });
        dispatch({ t: "laneSelect", id: null });
        dispatch({
          t: "laneRemove",
          fundurId,
          band,
          laneIndex: lane.laneIndex,
          id: li.item.id,
        });
        focusTarget.current = "undo";
      },
      moveTo: (toLane) => moveTo(lane, li, toLane),
      reorder: (to) => reorder(lane, li, to),
      close: () => {
        dispatch({ t: "laneSelect", id: null });
        focusTarget.current = li.item.id;
      },
    };
    return { model, lane, li, troop: version, actions };
  };

  const addTo = (lane: LaneModel) =>
    dispatch({
      t: "laneAdd",
      fundurId,
      band,
      laneIndex: lane.laneIndex,
      // Fits the wait it was offered in, as SplitGrid does.
      lidur: {
        name: "Nýtt verkefni",
        kind: BAND_KIND[band],
        minutes: Math.max(MIN_MINUTES, Math.min(15, lane.idle || 15)),
        status: "draft",
        theme: fundur.theme ?? null,
        venue: null,
        endurmat: null,
      },
    });

  const itemProps = (lane: LaneModel, li: LaneItem): ItemProps => ({
    "data-lidur-id": li.item.id,
    "aria-label": itemLabel(lane, li, troop),
    "aria-describedby": hintId,
    "aria-expanded": selected === li.item.id,
    onClick: () => dispatch({ t: "laneSelect", id: selected === li.item.id ? null : li.item.id }),
    onKeyDown: (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        moveTo(lane, li, lane.laneIndex + (e.key === "ArrowLeft" ? -1 : 1));
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        reorder(lane, li, li.index + (e.key === "ArrowUp" ? -1 : 1));
      } else if (e.key === "Escape" && selected) {
        dispatch({ t: "laneSelect", id: null });
      }
    },
  });

  const ctx: Ctx = { look, model, selected, hintId, troop, itemProps, editorFor, addTo };
  const picked = findSelected(model, selected);
  const changed = model.lanes.reduce(
    (n, lane) =>
      n +
      lane.items.filter(
        (li) => differences(li.item as CardLidur, troop.get(troopKeyOf(li.item))).length > 0
      ).length,
    0
  );

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${blockCardStyles.kindScope}`}
      data-look={look}
      lang="is"
    >
      <div className={styles.head}>
        <div className={styles.headText}>
          <h3 className={styles.title}>{model.label}</h3>
          <p className={styles.meta}>
            <span>Skipt á {countIs(model.lanes.length, "flokk", "flokka")}</span>
            <span className={styles.num}>
              {model.duration} mín samhliða
              {model.from ? ` · ${model.from}–${model.to}` : ""}
            </span>
            {look === "sync" && (
              <span data-sync-count>
                {changed === 0
                  ? "Allir fylgja sveitinni"
                  : `${countIs(changed, "spjald breytt", "spjöld breytt")} fyrir flokk`}
              </span>
            )}
          </p>
        </div>
        <button
          ref={mergeButtonRef}
          type="button"
          className={styles.quiet}
          aria-expanded={plan.identical ? undefined : mergeOpen}
          aria-controls={plan.identical ? undefined : mergeId}
          onClick={() => {
            if (plan.identical) return merge("all");
            setMergeOpenedByUser(true);
            setMergeOpen((open) => !open);
          }}
        >
          {plan.identical ? "Sameina í eitt" : "Sameina í eitt…"}
        </button>
      </div>

      {mergeOpen && !plan.identical && (
        <MergePanel
          id={mergeId}
          model={model}
          plan={plan}
          takeFocus={mergeOpenedByUser}
          onCancel={() => {
            setMergeOpen(false);
            mergeButtonRef.current?.focus();
          }}
          onConfirm={merge}
        />
      )}

      <div className={styles.workArea} data-has-panel={(look === "panel" && !!picked) || undefined}>
        <Columns ctx={ctx} />
        {(look === "panel" || look === "sync") && picked && (
          <EditorPanel
            ctx={ctx}
            lane={picked.lane}
            li={picked.li}
            patchFollowers={patchFollowers}
          />
        )}
      </div>

      <div className={styles.toastArea} role="status">
        {undo && (
          <p className={styles.undo}>
            <span>{undo.text}</span>
            <button ref={undoRef} type="button" className={styles.quiet} onClick={restore}>
              Afturkalla
            </button>
          </p>
        )}
      </div>
      <p aria-live="polite" className={styles.srOnly}>
        {said.text}
      </p>

      <div className={styles.foot}>
        <p id={hintId} className={styles.hint}>
          Smelltu á spjald til að breyta því · ← → færa milli flokka · ↑ ↓ breyta röð · eða dragðu á
          annan flokk
        </p>
        <p className={styles.summary} data-balanced={model.balanced || undefined}>
          Ristin er {model.duration} mín
          {model.from ? ` — frá ${model.from} til ${model.to}` : ""}. {balanceSentence(model)}
        </p>
      </div>
    </div>
  );
}

/* ── Shared pieces ─────────────────────────────────────────────────────────── */

function itemLabel(lane: LaneModel, li: LaneItem, troop: Map<string, TroopVersion>): string {
  const when = li.clock ? `kl. ${li.clock}` : `${li.index + 1}. liður`;
  const card = li.item as CardLidur;
  const changed = differences(card, troop.get(troopKeyOf(card))).length > 0;
  return `${lane.name} ${when}: ${li.item.name}, ${li.item.minutes} mín, ${STATUS_LABEL[
    li.item.status
  ].toLowerCase()}${changed ? ", breytt fyrir þennan flokk" : ""}`;
}

function findSelected(model: SplitModel, id: string | null) {
  if (!id) return null;
  for (const lane of model.lanes) {
    const li = lane.items.find((entry) => entry.item.id === id);
    if (li) return { lane, li };
  }
  return null;
}

/** The custom properties a lane's colour comes through. Background and text always as a pair. */
function laneVars(accent: PatrolAccent): CSSProperties {
  return {
    ["--lane" as string]: `var(--sl-color-patrol-${accent})`,
    ["--lane-on" as string]: `var(--sl-color-patrol-${accent}-foreground)`,
  };
}

/** Patrol identity: the vivid colour and the name, always together. */
function PatrolTag({ lane, small = false }: { lane: LaneModel; small?: boolean }) {
  return (
    <span className={styles.tag} data-small={small || undefined} style={laneVars(lane.accent)}>
      {lane.name}
    </span>
  );
}

/** The lane's total, which every direction shows and the play tests read. */
function LaneTotal({ lane }: { lane: LaneModel }) {
  return (
    <span className={styles.num} data-lane-total={lane.patrolId}>
      {lane.used} mín
    </span>
  );
}

/** "ræður lengd" for the lane that sets the band, "15 mín bið" for one that waits. */
function LaneState({ lane, model }: { lane: LaneModel; model: SplitModel }) {
  if (model.balanced || model.duration === 0) return null;
  if (lane.longest) return <span className={styles.leads}>ræður lengd</span>;
  return <span className={styles.waits}>{lane.idle} mín bið</span>;
}

/** A drop target for one lane. Not lit for the lane the drag came from: that drop is refused. */
function useLaneDrop(model: SplitModel, laneIndex: number) {
  const { setNodeRef, isOver } = useDroppable({
    id: dragId.laneDrop(model.fundur.event_id, model.band, laneIndex),
    data: { kind: "lane", fundurId: model.fundur.event_id, band: model.band, laneIndex },
  });
  const { active } = useDndContext();
  const from = active?.data.current as { kind?: string; laneIndex?: number } | undefined;
  const isSource = from?.kind === "lane" && from.laneIndex === laneIndex;
  return { setNodeRef, over: isOver && !isSource };
}

/* ── The card ──────────────────────────────────────────────────────────────── */

/**
 * Moves focus to an editor's heading, so a screen reader hears what opened. Only when the
 * leader opened it from inside this band: a story that starts with a card open doesn't pull
 * the Docs page down to it.
 */
function takeFocus(editor: HTMLElement | null) {
  const band = editor?.closest("[data-look]");
  if (!band || !band.contains(document.activeElement)) return;
  editor?.querySelector<HTMLElement>("h4")?.focus();
}

/**
 * The bank card as a liður: the same picture tile, title and kind line as in BlockPalette, with
 * what the flokkur has made of it (who leads, a note, its status stamp). The whole card is the
 * button: press to open it, ← → to move it, drag it to another flokkur.
 */
function CardFace({ ctx, li }: { ctx: Ctx; li: LaneItem }) {
  const card = li.item as CardLidur;
  const block = blockOf(card);
  const version = ctx.troop.get(troopKeyOf(card));
  const changed = differences(card, version).length > 0;
  const tight = li.item.minutes < 15;
  return (
    <>
      <span className={styles.cardPicture}>
        <BlockMarker kind={card.kind} theme={card.theme} image={block?.image} small />
        <span className={blockCardStyles.cardMinutes}>{li.item.minutes}</span>
      </span>
      <span className={styles.cardText}>
        <span className={styles.cardTime}>
          {li.clock ? `${li.clock}–${li.clockEnd}` : `+${li.start}–${li.start + li.item.minutes}`}
        </span>
        <span className={`${blockCardStyles.title} ${styles.cardTitle}`}>{li.item.name}</span>
        {!tight && <BlockKindLine kind={card.kind} theme={card.theme} />}
        {!tight && (card.leader || card.note) && (
          <span className={styles.cardMeta}>
            {card.leader && (
              <span className={styles.cardMetaItem}>
                <UserRound aria-hidden="true" />
                {card.leader}
              </span>
            )}
            {card.note && (
              <span className={styles.cardMetaItem} title={card.note}>
                <MessageSquareText aria-hidden="true" />
                {ctx.look === "face" || ctx.look === "flip" ? card.note : "Aðlögun"}
              </span>
            )}
          </span>
        )}
      </span>
      <span className={styles.cardStamp}>
        <Stamp entry={{ id: li.item.id, status: li.item.status, type: "flokks" }} size="sm" />
      </span>
      {ctx.look === "sync" ? (
        <span
          className={styles.syncMark}
          data-changed={changed || undefined}
          data-none={!version || undefined}
        >
          {!version ? (
            "Aðeins hér"
          ) : changed ? (
            <>
              <Pencil aria-hidden="true" />
              Breytt
            </>
          ) : (
            <>
              <Link2 aria-hidden="true" />
              Sveitin
            </>
          )}
        </span>
      ) : (
        changed && (
          <span
            className={styles.changedDot}
            title="Breytt fyrir þennan flokk"
            aria-hidden="true"
          />
        )
      )}
    </>
  );
}

/** The card as a focusable, draggable button. */
function CardButton({ ctx, lane, li }: { ctx: Ctx; lane: LaneModel; li: LaneItem }) {
  const { model } = ctx;
  // `listeners` only: there is no KeyboardSensor (dnd.ts), and dnd-kit's `attributes` would add
  // a second role and tab stop to what is already a real button.
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: dragId.lane(li.item.id),
    data: {
      kind: "lane",
      fundurId: model.fundur.event_id,
      band: model.band,
      laneIndex: lane.laneIndex,
      lidur: li.item,
    },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`${blockCardStyles.card} ${styles.card}`}
      data-on={ctx.selected === li.item.id || undefined}
      data-dragging={isDragging || undefined}
      data-status={li.item.status}
      {...listeners}
      {...ctx.itemProps(lane, li)}
    >
      <CardFace ctx={ctx} li={li} />
    </button>
  );
}

/**
 * One liður's place in its column. Closed, it is exactly as tall as the liður is long. Open in
 * K1 and K2, it grows to fit its editor and pushes the rest of that column down: the time
 * scale of that one column pauses while it is being edited, and comes back on "Lokið".
 */
function CardSlot({ ctx, lane, li }: { ctx: Ctx; lane: LaneModel; li: LaneItem }) {
  const open = ctx.selected === li.item.id;
  const inPlace = open && (ctx.look === "face" || ctx.look === "flip");
  return (
    <div
      className={styles.slot}
      data-open={inPlace || undefined}
      data-flipped={(inPlace && ctx.look === "flip") || undefined}
      style={{ ["--min" as string]: li.item.minutes }}
    >
      {ctx.look === "flip" && inPlace ? (
        <CardBack ctx={ctx} lane={lane} li={li} />
      ) : (
        <CardButton ctx={ctx} lane={lane} li={li} />
      )}
      {ctx.look === "face" && inPlace && <QuickEdits ctx={ctx} lane={lane} li={li} />}
    </div>
  );
}

/**
 * K1: the quick edits on the card itself, the two a foringi changes most on the night (length
 * and status), and "Fleira" for the rest.
 */
function QuickEdits({ ctx, lane, li }: { ctx: Ctx; lane: LaneModel; li: LaneItem }) {
  const editor = ctx.editorFor(lane, li);
  const [more, setMore] = useState(false);
  const moreId = useId();
  return (
    <div
      className={styles.quick}
      role="group"
      aria-label={`Breyta ${li.item.name} (${lane.name})`}
      onKeyDown={(e) => {
        if (e.key === "Escape") editor.actions.close();
      }}
    >
      <MinutesField ctx={editor} compact />
      <StatusField ctx={editor} />
      <DiffBlock ctx={editor} />
      <div className={styles.quickFoot}>
        <button
          type="button"
          className={styles.quiet}
          aria-expanded={more}
          aria-controls={moreId}
          onClick={() => setMore((m) => !m)}
        >
          {more ? "Færra" : "Fleira…"}
        </button>
        <button type="button" className={styles.primary} onClick={editor.actions.close}>
          Lokið
        </button>
      </div>
      {more && (
        <div id={moreId}>
          <CardEditor ctx={editor} rest />
        </div>
      )}
    </div>
  );
}

/**
 * K2: the back of the card. The front's picture and name stay at the top so it is still the
 * same card; below them, the whole editor, ruled like the back of a playing card.
 */
function CardBack({ ctx, lane, li }: { ctx: Ctx; lane: LaneModel; li: LaneItem }) {
  const editor = ctx.editorFor(lane, li);
  const headingId = useId();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => takeFocus(ref.current), []);
  const card = li.item as CardLidur;
  return (
    <section
      ref={ref}
      className={styles.back}
      aria-labelledby={headingId}
      data-lidur-id={li.item.id}
      onKeyDown={(e) => {
        if (e.key === "Escape") editor.actions.close();
      }}
    >
      <CardEditor
        ctx={editor}
        headingId={headingId}
        heading={
          <span className={styles.backHead}>
            <BlockMarker kind={card.kind} theme={card.theme} image={blockOf(card)?.image} small />
            <span>
              <span className={styles.backWho}>{lane.name}</span>
              {li.item.name}
            </span>
          </span>
        }
      />
    </section>
  );
}

/**
 * K3 and K4: the editor beside the grid (under it on a phone), with the open card as its
 * header. K4 adds where an edit goes: this flokkur, or every flokkur that follows the sveit.
 */
function EditorPanel({
  ctx,
  lane,
  li,
  patchFollowers,
}: {
  ctx: Ctx;
  lane: LaneModel;
  li: LaneItem;
  patchFollowers: (li: LaneItem, patch: CardPatch) => number;
}) {
  const base = ctx.editorFor(lane, li);
  const [scope, setScope] = useState<"one" | "all">("one");
  const [result, setResult] = useState("");
  const scopeName = useId();
  const headingId = useId();
  const ref = useRef<HTMLElement>(null);

  // A newly opened card gets the panel's attention; moving the same card (← →) keeps focus on it.
  useEffect(() => takeFocus(ref.current), [li.item.id]);
  useEffect(() => setScope("one"), [li.item.id]);

  const followers = (() => {
    if (!base.troop) return 0;
    const key = troopKeyOf(li.item as CardLidur);
    return ctx.model.lanes.reduce(
      (n, l) =>
        n +
        l.items.filter(
          (entry) =>
            troopKeyOf(entry.item as CardLidur) === key &&
            differences(entry.item as CardLidur, base.troop).length === 0
        ).length,
      0
    );
  })();

  const toAll = ctx.look === "sync" && scope === "all" && !!base.troop;
  const editor: EditorContext = toAll
    ? {
        ...base,
        actions: {
          ...base.actions,
          patch: (patch) => {
            const n = patchFollowers(li, patch);
            setResult(`Breytt hjá ${countIs(n, "flokki", "flokkum")}.`);
          },
        },
      }
    : base;

  const card = li.item as CardLidur;
  return (
    <section
      ref={ref}
      className={styles.panel}
      aria-labelledby={headingId}
      onKeyDown={(e) => {
        if (e.key === "Escape") base.actions.close();
      }}
    >
      <CardEditor
        ctx={editor}
        headingId={headingId}
        showDiff={ctx.look !== "sync"}
        heading={
          <span className={styles.backHead}>
            <BlockMarker kind={card.kind} theme={card.theme} image={blockOf(card)?.image} small />
            <span>
              <span className={styles.backWho} style={laneVars(lane.accent)}>
                {lane.name}
                {li.clock ? ` · ${li.clock}–${li.clockEnd}` : ""}
              </span>
              {li.item.name}
            </span>
          </span>
        }
        before={
          ctx.look === "sync" ? (
            <>
              <DiffBlock ctx={base} always />
              {base.troop && (
                <fieldset className={styles.scope}>
                  <legend className={styles.fieldLabel}>Breytingar gilda</legend>
                  <label className={styles.scopeChoice}>
                    <input
                      type="radio"
                      name={scopeName}
                      checked={scope === "one"}
                      onChange={() => setScope("one")}
                    />
                    <span>Aðeins þessi flokkur ({lane.name})</span>
                  </label>
                  <label className={styles.scopeChoice}>
                    <input
                      type="radio"
                      name={scopeName}
                      checked={scope === "all"}
                      onChange={() => setScope("all")}
                    />
                    <span>
                      Hjá öllum sem fylgja sveitinni ({countIs(followers, "flokkur", "flokkar")})
                    </span>
                  </label>
                  <p className={styles.scopeHelp} role="status">
                    {result ||
                      "Flokkur sem hefur sína eigin útgáfu heldur henni, hvað sem þú velur hér."}
                  </p>
                </fieldset>
              )}
            </>
          ) : undefined
        }
      />
    </section>
  );
}

/* ── The grid ──────────────────────────────────────────────────────────────── */

/**
 * Time down the side and one column per flokkur, as SplitGrid has it. Closed cards are exactly
 * as tall as they are long (`--ppm` per minute), so the columns stay level with the axis and
 * with each other. On a phone the columns scroll sideways with snap and the axis stays pinned.
 */
function Columns({ ctx }: { ctx: Ctx }) {
  const { model } = ctx;
  const span = Math.max(model.duration, 15);
  const ticks: number[] = [];
  for (let m = 0; m <= span; m += 15) ticks.push(m);
  const openLane =
    ctx.look === "face" || ctx.look === "flip"
      ? findSelected(model, ctx.selected)?.lane.laneIndex
      : undefined;
  // The column with an open card widens so its editor has room; the rest keep theirs.
  const columns = model.lanes
    .map((lane) =>
      lane.laneIndex === openLane ? "minmax(var(--col-open), 2fr)" : "minmax(var(--col-min), 1fr)"
    )
    .join(" ");

  return (
    <div className={styles.columnsWrap}>
      {model.lanes.length > 2 && (
        <p className={styles.swipe}>
          Strjúktu til hliðar til að sjá alla {countIs(model.lanes.length, "flokk", "flokka")}.
        </p>
      )}
      <div className={styles.scroller}>
        <div
          className={styles.grid}
          style={{
            ["--span" as string]: span,
            gridTemplateColumns: `var(--axis) ${columns}`,
          }}
        >
          <div className={styles.axisHead} aria-hidden="true">
            kl.
          </div>
          {model.lanes.map((lane) => (
            <div key={lane.patrolId} className={styles.laneHead} style={laneVars(lane.accent)}>
              <span className={styles.laneName}>{lane.name}</span>
              <span className={styles.laneNums}>
                <LaneTotal lane={lane} />
                <LaneState lane={lane} model={model} />
              </span>
            </div>
          ))}
          <div className={styles.axis} aria-hidden="true">
            {ticks.map((m) => (
              <span key={m} className={styles.tick} style={{ top: `calc(var(--ppm) * ${m})` }}>
                {at(model, m)}
              </span>
            ))}
          </div>
          {model.lanes.map((lane) => (
            <LaneColumn
              key={lane.patrolId}
              ctx={ctx}
              lane={lane}
              open={lane.laneIndex === openLane}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function LaneColumn({ ctx, lane, open }: { ctx: Ctx; lane: LaneModel; open: boolean }) {
  const { model } = ctx;
  const { setNodeRef, over } = useLaneDrop(model, lane.laneIndex);
  const span = Math.max(model.duration, 15);
  const rest = span - lane.used;

  return (
    <div
      ref={setNodeRef}
      className={styles.lane}
      data-over={over || undefined}
      data-open={open || undefined}
      style={laneVars(lane.accent)}
    >
      {lane.items.map((li) => (
        <CardSlot key={li.item.id} ctx={ctx} lane={lane} li={li} />
      ))}
      {rest > 0 && (
        <button
          type="button"
          className={styles.gap}
          style={{ height: `calc(var(--ppm) * ${rest})` }}
          aria-label={
            lane.items.length === 0
              ? `Ekkert skráð. Bæta verkefni við (${lane.name})`
              : `${rest} mín bið. Bæta verkefni við (${lane.name})`
          }
          onClick={() => ctx.addTo(lane)}
        >
          {lane.items.length === 0 ? "Ekkert skráð · + Bæta við" : `+ ${rest} mín bið`}
        </button>
      )}
    </div>
  );
}

/* ── Merge ─────────────────────────────────────────────────────────────────── */

/**
 * The merge confirmation: what stays, what goes, and what it does to the clock, before
 * anything happens. Only shown when the lanes differ; identical lanes merge at once.
 */
function MergePanel({
  id,
  model,
  plan,
  takeFocus,
  onCancel,
  onConfirm,
}: {
  id: string;
  model: SplitModel;
  plan: MergePlan;
  takeFocus: boolean;
  onCancel: () => void;
  onConfirm: (keep: MergeKeep) => void;
}) {
  const [mode, setMode] = useState<"all" | "one">("all");
  const [laneId, setLaneId] = useState(model.lanes[0].patrolId);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const name = useId();
  const selectId = useId();

  useEffect(() => {
    if (takeFocus) headingRef.current?.focus();
  }, [takeFocus]);

  const allMinutes = plan.all.reduce((sum, e) => sum + e.item.minutes, 0);
  const keptLane = model.lanes.find((lane) => lane.patrolId === laneId) ?? model.lanes[0];
  const dropped = plan.droppedIfKeep[keptLane.patrolId] ?? [];
  const droppedMinutes = dropped.reduce((sum, e) => sum + e.item.minutes, 0);
  const laneOf = (patrolId: string) => model.lanes.find((lane) => lane.patrolId === patrolId);

  const holders = (patrolIds: string[]) =>
    patrolIds.length === model.lanes.length ? (
      <span className={styles.allFlokkar}>allir flokkar</span>
    ) : (
      patrolIds.map((pid) => {
        const lane = laneOf(pid);
        return lane ? <PatrolTag key={pid} lane={lane} small /> : null;
      })
    );

  const longer = allMinutes - model.duration;

  return (
    <section id={id} className={styles.merge} aria-labelledby={`${id}-h`}>
      <h4 id={`${id}-h`} ref={headingRef} tabIndex={-1} className={styles.mergeTitle}>
        Sameina í eina röð?
      </h4>
      <p className={styles.mergeLead}>
        Flokkarnir eru ekki með sömu dagskrá, svo eitthvað breytist. Veldu hvað á að halda.
      </p>

      <fieldset className={styles.choices}>
        <legend className={styles.srOnly}>Hvað á að halda?</legend>
        <label className={styles.choice}>
          <input
            type="radio"
            name={name}
            checked={mode === "all"}
            onChange={() => setMode("all")}
          />
          <span>
            <span className={styles.choiceTitle}>Halda öllu, hvað á eftir öðru</span>
            <span className={styles.choiceHelp}>
              {countIs(plan.all.length, "liður", "liðir")} í einni röð, {allMinutes} mín í stað{" "}
              {model.duration} mín samhliða
              {longer > 0 ? `. Fundurinn lengist um ${longer} mín.` : "."}
            </span>
          </span>
        </label>
        <label className={styles.choice}>
          <input
            type="radio"
            name={name}
            checked={mode === "one"}
            onChange={() => setMode("one")}
          />
          <span>
            <span className={styles.choiceTitle}>Halda einni dagskrá</span>
            <span className={styles.choiceHelp}>
              Allir gera það sem einn flokkur var með. Hitt fellur út.
            </span>
          </span>
        </label>
        {mode === "one" && (
          <div className={styles.pick}>
            <label htmlFor={selectId}>Flokkur</label>
            <select id={selectId} value={laneId} onChange={(e) => setLaneId(e.target.value)}>
              {model.lanes.map((lane) => (
                <option key={lane.patrolId} value={lane.patrolId}>
                  {lane.name} ({lane.used} mín)
                </option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      {mode === "all" ? (
        <div className={styles.preview}>
          <h5 className={styles.previewTitle}>Röðin eftir sameiningu</h5>
          <ol className={styles.previewList}>
            {plan.all.map((entry, i) => (
              <li key={`${entry.item.id}-${i}`}>
                <span className={styles.previewName}>{entry.item.name}</span>
                <span className={styles.num}>{entry.item.minutes} mín</span>
                <span className={styles.holders}>{holders(entry.patrolIds)}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className={styles.preview}>
          <h5 className={styles.previewTitle}>
            Fellur út: {countIs(dropped.length, "liður", "liðir")}
            {droppedMinutes ? ` · ${droppedMinutes} mín` : ""}
          </h5>
          {dropped.length === 0 ? (
            <p className={styles.choiceHelp}>Ekkert. Hinir flokkarnir eru með sömu liði.</p>
          ) : (
            <ul className={`${styles.previewList} ${styles.dropped}`}>
              {dropped.map((entry, i) => (
                <li key={`${entry.item.id}-${i}`}>
                  <span className={styles.previewName}>{entry.item.name}</span>
                  <span className={styles.num}>{entry.item.minutes} mín</span>
                  <span className={styles.holders}>{holders(entry.patrolIds)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={styles.mergeActions}>
        <button type="button" className={styles.quiet} onClick={onCancel}>
          Hætta við
        </button>
        {mode === "one" && dropped.length > 0 ? (
          <button
            type="button"
            className={styles.danger}
            onClick={() => onConfirm(keptLane.patrolId)}
          >
            Sameina og sleppa {countIs(dropped.length, "lið", "liðum")}
          </button>
        ) : (
          <button
            type="button"
            className={styles.primary}
            onClick={() => onConfirm(mode === "all" ? "all" : keptLane.patrolId)}
          >
            Sameina
          </button>
        )}
      </div>
    </section>
  );
}

/** The band after a merge: one list, with Afturkalla while it lasts. */
function MergedBand({
  fundur,
  band,
  undo,
  onUndo,
  onSplit,
}: {
  fundur: Fundur;
  band: BandId;
  undo: { text: string } | null;
  onUndo: () => void;
  onSplit: () => void;
}) {
  const items = fundur.items.filter((item) => BAND_OF[item.kind] === band);
  const minutes = items.reduce((sum, item) => sum + item.minutes, 0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h3 ref={headingRef} tabIndex={-1} className={styles.title}>
            {BANDS.find((b) => b.id === band)?.label ?? band}
          </h3>
          <p className={styles.meta}>
            <span>Ein röð fyrir alla</span>
            <span className={styles.num}>{minutes} mín</span>
          </p>
        </div>
        <button type="button" className={styles.quiet} onClick={onSplit}>
          Skipta á flokka
        </button>
      </div>
      {undo && (
        <div className={styles.undo}>
          <span>{undo.text}</span>
          <button type="button" className={styles.quiet} onClick={onUndo}>
            Afturkalla
          </button>
        </div>
      )}
      <ol className={styles.mergedList}>
        {items.map((item) => (
          <li key={item.id}>
            <span className={styles.previewName}>{item.name}</span>
            <span className={styles.num}>{item.minutes} mín</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
