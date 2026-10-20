import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { DragOverlay, useDndMonitor, useDraggable } from "@dnd-kit/core";
import { MessageSquareText, UserRound } from "lucide-react";
import {
  BlockKindLine,
  BlockMarker,
  BlockMinutes,
  blockCardStyles,
} from "@/components/plan/bench/BlockCard";
import { MIN_MINUTES } from "@/components/plan/bench/benchState";
import { dragId, readDrag } from "@/components/plan/bench/dnd";
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
  pointOf,
  previewFundur,
  sameSpot,
  spotAt,
  useFollowPointer,
  type CardDrag,
  type DropSpot,
} from "./cardDrag";
import { CardEditor, type CardActions, type EditorContext } from "./CardEditor";
import { LaneHeader, type HeaderLook } from "./laneHeaders";
import { PhoneArea, type PhoneParts } from "./phoneLayouts";
import { PHONE_MAX_WIDTH, type PhoneLook } from "./phoneLooks";
import {
  SWAP_BLOCKS,
  blockOf,
  differences,
  resetPatch,
  swapPatch,
  troopKeyOf,
  troopVersions,
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
 * The split band built from the bank's own cards, editable per flokkur: K2 · Flip it over.
 * The form is the current SplitGrid's (time down the side, a column per flokkur, "Lengsti
 * flokkur ræður", the merge proposal), and each liður is the BlockPalette card it came from.
 * Pressing a card turns it over: its back is the whole editor, lifted above the grid, which
 * stays exactly as it was, so the time axis and the other columns never move while you edit.
 */
export interface SplitGridLabProps {
  data: PlanBenchData;
  fundurId?: string;
  band?: BandId;
  /** Open the merge confirmation straight away. */
  defaultMergeOpen?: boolean;
  /** Open this liður's card straight away (by name and flokkur). */
  defaultOpen?: { patrolId: string; name: string };
  /** How each column's flokkur is shown at its top (laneHeaders.tsx). */
  header?: HeaderLook;
  /**
   * The layout once the band is phone-narrow (phoneLayouts.tsx). Without it a narrow band is
   * the desktop grid scrolled sideways, as K2 has it today; wider than a phone it is always the
   * desktop grid.
   */
  phone?: PhoneLook;
}

/* ── Root ──────────────────────────────────────────────────────────────────── */

export default function SplitGridLab({ data, ...props }: SplitGridLabProps) {
  return (
    <LabBench data={data}>
      <SplitBand {...props} />
    </LabBench>
  );
}

/** What the grid and the card get from the band: the model, the move paths and the edits. */
type Ctx = {
  model: SplitModel;
  selected: string | null;
  hintId: string;
  troop: Map<string, TroopVersion>;
  itemProps: (lane: LaneModel, li: LaneItem) => ItemProps;
  editorFor: (lane: LaneModel, li: LaneItem) => EditorContext;
  addTo: (lane: LaneModel) => void;
  /** The card being dragged, and where it would land (null: outside, it goes back). */
  drag: CardDrag | null;
  spot: DropSpot | null;
  header: HeaderLook;
  /** The phone layout in use, once the band is phone-narrow. */
  phone: PhoneLook | null;
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
  fundurId = LAB_FUNDUR,
  band = "kjarni",
  defaultMergeOpen = false,
  defaultOpen,
  header = "h6",
  phone,
}: Omit<SplitGridLabProps, "data">) {
  const { state, dispatch } = useLabBench();
  const fundur = state.data.fundir.find((f) => f.event_id === fundurId);
  const baseModel = fundur ? splitModel(fundur, band, state.data.patrols) : null;
  const selected = state.laneSelected;

  /*
   * A drag draws the result while it is going on: the card out of its column and in at the
   * spot under the pointer, so every time and total on screen is what the drop will give.
   */
  const [drag, setDrag] = useState<CardDrag | null>(null);
  const [spot, setSpot] = useState<DropSpot | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const touchTarget = useRef<EventTarget | null>(null);
  const dragRef = useRef<CardDrag | null>(null);
  const spotRef = useRef<DropSpot | null>(null);
  const model =
    fundur && drag
      ? splitModel(previewFundur(fundur, band, drag, spot), band, state.data.patrols)
      : baseModel;

  const rootRef = useRef<HTMLDivElement>(null);
  const workAreaRef = useRef<HTMLDivElement>(null);
  const narrow = useNarrow(rootRef, PHONE_MAX_WIDTH);
  const phoneLook = phone && narrow ? phone : null;
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
   * flokkar have). Changing one flokkur's card never quietly redefines the sveit's.
   */
  const [troop] = useState<Map<string, TroopVersion>>(() =>
    troopVersions(
      baseModel?.lanes.map((lane) => lane.items.map((li) => li.item as CardLidur)) ?? []
    )
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
    // An open card that moved keeps its back open: focus stays in the editor.
    if (id.startsWith("back:")) {
      const back = rootRef.current?.querySelector<HTMLElement>(
        `[data-back-for="${CSS.escape(id.slice(5))}"] h4`
      );
      back?.focus();
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

  const say = (text: string) => setSaid((s) => ({ text, seq: s.seq + 1 }));

  const endDrag = () => {
    dragRef.current = null;
    spotRef.current = null;
    setDrag(null);
    setSpot(null);
    setDragStart(null);
  };

  /** Letting go: a move through the reducer, with Afturkalla; outside the grid, nothing. */
  const drop = () => {
    const moving = dragRef.current;
    const to = spotRef.current;
    endDrag();
    if (!moving || !fundur || !baseModel) return;
    if (!to) {
      say(`Sleppt utan flokkanna. ${moving.name} er á sínum stað.`);
      return;
    }
    // In its own column a card can't land past its own last place.
    const laneLength = baseModel.lanes[to.lane]?.items.length ?? 0;
    const index = Math.min(to.index, to.lane === moving.fromLane ? laneLength - 1 : laneLength);
    if (to.lane === moving.fromLane && index === moving.fromIndex) {
      say(`${moving.name} er á sínum stað.`);
      return;
    }
    setUndo({
      fundur,
      text: `${moving.name} var færður.`,
      restored: `Færslan afturkölluð. ${moving.name} er aftur á sínum stað.`,
    });
    if (to.lane === moving.fromLane) {
      dispatch({
        t: "laneMove",
        fundurId,
        band,
        laneIndex: to.lane,
        id: moving.id,
        to: to.index,
      });
    } else {
      dispatch({
        t: "laneMoveAcross",
        fundurId,
        band,
        fromLane: moving.fromLane,
        toLane: to.lane,
        id: moving.id,
        toIndex: to.index,
      });
      // The reducer selects a moved liður, and in the lab selected means open: it lands closed.
      dispatch({ t: "laneSelect", id: null });
    }
    focusTarget.current = moving.id;
  };

  useDndMonitor({
    onDragStart: ({ active, activatorEvent }) => {
      const payload = readDrag(active);
      if (payload?.kind !== "lane" || payload.fundurId !== fundurId || payload.band !== band) {
        return;
      }
      const li = baseModel?.lanes[payload.laneIndex]?.items.find(
        (entry) => entry.item.id === payload.lidur.id
      );
      if (!li) return;
      const picked: CardDrag = {
        id: li.item.id,
        name: li.item.name,
        minutes: li.item.minutes,
        fromLane: payload.laneIndex,
        fromIndex: li.index,
      };
      dragRef.current = picked;
      spotRef.current = { lane: picked.fromLane, index: picked.fromIndex };
      setDrag(picked);
      setSpot(spotRef.current);
      setDragStart(pointOf(activatorEvent));
      touchTarget.current = activatorEvent?.target ?? null;
      // An open back covers its neighbours, so a drag closes it: the card travels as its front.
      if (selected) dispatch({ t: "laneSelect", id: null });
      say(
        `Liður tekinn upp: ${picked.name}, ${picked.minutes} mín. Dragðu hann upp, niður eða á annan flokk og slepptu. Escape hættir við.`
      );
    },
    onDragEnd: () => drop(),
    onDragCancel: () => {
      const moving = dragRef.current;
      endDrag();
      if (moving) say(`Hætt við. ${moving.name} er á sínum stað.`);
    },
  });

  useFollowPointer(
    drag !== null,
    dragStart,
    (x, y) => {
      const root = rootRef.current;
      const moving = dragRef.current;
      if (!root || !moving) return;
      const next = spotAt(root, x, y, moving.id);
      if (sameSpot(next, spotRef.current)) return;
      spotRef.current = next;
      setSpot(next);
    },
    touchTarget.current
  );

  // Where it would land, said once per new spot (not for the spot it was picked up from).
  const lastSaid = useRef<string>("");
  useEffect(() => {
    if (!drag) {
      lastSaid.current = "";
      return;
    }
    const key = spot ? `${spot.lane}:${spot.index}` : "out";
    if (!lastSaid.current) {
      lastSaid.current = key;
      return;
    }
    if (key === lastSaid.current || !model) return;
    lastSaid.current = key;
    if (!spot) {
      say("Utan flokkanna. Slepptu til að hætta við.");
      return;
    }
    const lane = model.lanes[spot.lane];
    const li = lane?.items.find((entry) => entry.item.id === drag.id);
    if (!lane || !li) return;
    say(`${lane.name}: ${li.index + 1}. af ${lane.items.length}, hefst ${at(model, li.start)}.`);
    // `model` is rebuilt from `spot` every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, spot]);

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
    focusTarget.current = selected === li.item.id ? `back:${li.item.id}` : li.item.id;
  };

  const reorder = (lane: LaneModel, li: LaneItem, to: number) => {
    if (to < 0 || to >= lane.items.length) return;
    dispatch({ t: "laneMove", fundurId, band, laneIndex: lane.laneIndex, id: li.item.id, to });
    focusTarget.current = li.item.id;
  };

  /** One card's change, in its own lane. */
  const patchOne = (lane: LaneModel, id: string, patch: CardPatch) =>
    dispatch({ t: "lanePatch", fundurId, band, laneIndex: lane.laneIndex, id, patch });

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
      // From the card's back a move gets Afturkalla, as a drop does; ← → on a card don't need
      // it, since the opposite arrow puts it back.
      moveTo: (toLane) => {
        const to = model.lanes[toLane];
        if (!to || toLane === lane.laneIndex) return;
        setUndo({
          fundur,
          text: `${li.item.name} var færður í annan flokk: ${to.name}.`,
          restored: `Færslan afturkölluð. ${li.item.name} er aftur hjá sínum flokki (${lane.name}).`,
        });
        moveTo(lane, li, toLane);
      },
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

  const ctx: Ctx = {
    model,
    selected,
    hintId,
    troop,
    itemProps,
    editorFor,
    addTo,
    drag,
    spot,
    header,
    phone: phoneLook,
  };
  const dragged = drag ? findSelected(model, drag.id) : null;

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${blockCardStyles.kindScope}`}
      data-split-band
      data-header={header}
      data-phone={phoneLook ?? undefined}
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

      {phoneLook ? (
        <>
          <PhoneArea look={phoneLook} model={model} parts={phoneParts(ctx)} />
          <PhoneSheet ctx={ctx} />
        </>
      ) : (
        <FlipArea ctx={ctx} areaRef={workAreaRef} />
      )}

      {/* The card in the hand: its front, lifted, with the times it would get where it is. */}
      <DragOverlay dropAnimation={null}>
        {dragged ? (
          <div
            className={`${blockCardStyles.card} ${styles.card} ${styles.lifted}`}
            data-status={dragged.li.item.status}
            data-tight={dragged.li.item.minutes < 15 || undefined}
            data-short={dragged.li.item.minutes < 20 || undefined}
            data-tiny={dragged.li.item.minutes < 10 || undefined}
          >
            <CardFace ctx={ctx} li={dragged.li} />
          </div>
        ) : null}
      </DragOverlay>

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
          {phoneLook ? (
            PHONE_HINT
          ) : (
            <>
              Smelltu á spjald til að breyta því · dragðu það upp, niður eða á annan flokk (í síma:
              haltu inni fyrst) · ↑ ↓ breyta röð · ← → færa milli flokka
            </>
          )}
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

/**
 * Whether the band is at most `max` px wide: the JS side of the container queries, because a
 * phone layout is a different tree, not only different CSS. Measured before paint, so a phone
 * never shows the desktop grid first.
 */
function useNarrow(ref: RefObject<HTMLElement | null>, max: number): boolean {
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setNarrow(el.getBoundingClientRect().width <= max);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, max]);
  return narrow;
}

/** What a card does on a phone; the keys still work with a keyboard. */
const PHONE_HINT =
  "Ýttu á lið til að opna spjaldið hans: þar er lengd, röð (Fyrr, Síðar) og Færa til · ↑ ↓ ← → á lyklaborði";

/** The card's behaviour, handed to the phone layouts so their lines open the same cards. */
function phoneParts(ctx: Ctx): PhoneParts {
  return {
    itemProps: ctx.itemProps,
    laneVars,
    selected: ctx.selected,
    addTo: ctx.addTo,
    changed: (li) => {
      const card = li.item as CardLidur;
      return differences(card, ctx.troop.get(troopKeyOf(card))).length > 0;
    },
  };
}

/**
 * On a phone the card's back is a sheet from the bottom of the screen instead of a panel over
 * the grid: the grid can't spare the width, and a thumb reaches the bottom half. A native
 * modal `<dialog>`, so focus stays in it and the page behind is inert; Escape, Lokið and a tap
 * on the dimmed page close it, and focus goes back to the card.
 */
function PhoneSheet({ ctx }: { ctx: Ctx }) {
  const picked = findSelected(ctx.model, ctx.selected);
  const ref = useRef<HTMLDialogElement>(null);
  const openId = picked?.li.item.id ?? null;
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && openId && !dialog.open) dialog.showModal();
  }, [openId]);
  if (!picked) return null;
  const close = () => ctx.editorFor(picked.lane, picked.li).actions.close();
  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      style={laneVars(picked.lane.accent)}
      aria-label={`${picked.lane.name}: ${picked.li.item.name}`}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <span className={styles.sheetGrip} aria-hidden="true" />
      <CardBack ctx={ctx} lane={picked.lane} li={picked.li} />
    </dialog>
  );
}

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
    ["--lane-subtle" as string]: `var(--sl-color-patrol-${accent}-subtle)`,
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

/* ── The card ──────────────────────────────────────────────────────────────── */

/**
 * Moves focus to an editor's heading, so a screen reader hears what opened. Only when the
 * leader opened it from inside this band: a story that starts with a card open doesn't pull
 * the Docs page down to it.
 */
function takeFocus(editor: HTMLElement | null) {
  const band = editor?.closest("[data-split-band]");
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
      <BlockMarker kind={card.kind} theme={card.theme} image={block?.image} small />
      <span className={styles.cardText}>
        {/* The length first, sharp in body ink; the clock times after it, quieter. */}
        <span className={styles.cardTime}>
          <BlockMinutes minutes={li.item.minutes} hidden />
          <span className={styles.cardClock}>
            {li.clock ? `${li.clock}–${li.clockEnd}` : `+${li.start}–${li.start + li.item.minutes}`}
          </span>
        </span>
        <span className={`${blockCardStyles.title} ${styles.cardTitle}`} title={li.item.name}>
          {li.item.name}
        </span>
        {/* Under 20 minutes the picture carries the kind, and the room goes to who leads it. */}
        {li.item.minutes >= 20 && <BlockKindLine kind={card.kind} theme={card.theme} />}
        {!tight && (card.leader || card.note) && (
          <span className={styles.cardMeta}>
            {card.leader && (
              <span className={styles.cardMetaItem}>
                <UserRound aria-hidden="true" />
                <span className={styles.cardMetaText}>{card.leader}</span>
              </span>
            )}
            {card.note && (
              <span className={styles.cardMetaItem} title={card.note}>
                <MessageSquareText aria-hidden="true" />
                <span className={styles.cardMetaText}>{card.note}</span>
              </span>
            )}
          </span>
        )}
      </span>
      <span className={styles.cardStamp}>
        <Stamp entry={{ id: li.item.id, status: li.item.status, type: "flokks" }} size="sm" />
      </span>
      {changed && (
        <span className={styles.changedDot} title="Breytt fyrir þennan flokk" aria-hidden="true" />
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
      data-tight={li.item.minutes < 15 || undefined}
      data-short={li.item.minutes < 20 || undefined}
      data-tiny={li.item.minutes < 10 || undefined}
      {...listeners}
      {...ctx.itemProps(lane, li)}
    >
      <CardFace ctx={ctx} li={li} />
    </button>
  );
}

/**
 * One liður's place in its column: exactly as tall as the liður is long, open or not. While its
 * card is dragged the slot is where it would land, with the time it would start.
 */
function CardSlot({ ctx, lane, li }: { ctx: Ctx; lane: LaneModel; li: LaneItem }) {
  const landing = ctx.drag?.id === li.item.id;
  return (
    <div
      className={styles.slot}
      data-slot-id={li.item.id}
      data-landing={landing || undefined}
      style={{ ["--min" as string]: li.item.minutes }}
    >
      <CardButton ctx={ctx} lane={lane} li={li} />
      {landing && (
        <span className={styles.landing} aria-hidden="true">
          {ctx.spot ? (
            <>
              <span className={styles.landingTime}>hefst {at(ctx.model, li.start)}</span>
              <span className={styles.landingMin}>{li.item.minutes} mín</span>
            </>
          ) : (
            <span className={styles.landingTime}>fer aftur hingað</span>
          )}
        </span>
      )}
    </div>
  );
}

/**
 * The back of the card. The front's picture and name stay at the top so it is still the same
 * card; below them, the whole editor on a plain surface.
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
      data-back-for={li.item.id}
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
              <span className={`${styles.backWho} ${styles.nameClamp}`} title={lane.name}>
                {lane.name}
              </span>
              {li.item.name}
            </span>
          </span>
        }
      />
    </section>
  );
}

/**
 * The grid with the open card's back lifted above it. The back is placed over its own card
 * (moved left when it would run off the right edge, full width on a phone), and the area grows
 * underneath it so it never covers the summary below. Nothing in the grid moves.
 */
function FlipArea({ ctx, areaRef }: { ctx: Ctx; areaRef: RefObject<HTMLDivElement | null> }) {
  const picked = findSelected(ctx.model, ctx.selected);
  const backRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const openId = picked?.li.item.id ?? null;

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!openId || !area) {
      setPlace(null);
      return;
    }
    const measure = () => {
      const front = area.querySelector<HTMLElement>(
        `button[data-lidur-id="${CSS.escape(openId)}"]`
      );
      if (!front) return;
      const a = area.getBoundingClientRect();
      const f = front.getBoundingClientRect();
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const width = Math.min(a.width, Math.max(f.width, BACK_WIDTH_REM * rem));
      const left = Math.min(Math.max(f.left - a.left, 0), a.width - width);
      const next = {
        top: Math.round(f.top - a.top),
        left: Math.round(left),
        width: Math.round(width),
        height: Math.round(backRef.current?.offsetHeight ?? 0),
      };
      setPlace((prev) => (prev && samePlace(prev, next) ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    if (backRef.current) observer.observe(backRef.current);
    const scroller = area.querySelector("[data-scroller]");
    scroller?.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      scroller?.removeEventListener("scroll", measure);
    };
    // The card moves when its lane or position changes; the model is rebuilt every render.
  }, [openId, picked?.lane.laneIndex, picked?.li.index, areaRef]);

  return (
    <div
      ref={areaRef}
      className={styles.workArea}
      style={place ? { minHeight: place.top + place.height } : undefined}
    >
      <Columns ctx={ctx} />
      {picked && (
        <div
          ref={backRef}
          className={styles.lift}
          data-placed={place ? true : undefined}
          style={place ? { top: place.top, left: place.left, width: place.width } : undefined}
        >
          <CardBack ctx={ctx} lane={picked.lane} li={picked.li} />
        </div>
      )}
    </div>
  );
}

/** The back is at least this wide (in rem), so its fields fit even over a narrow column. */
const BACK_WIDTH_REM = 24;

type Place = { top: number; left: number; width: number; height: number };

function samePlace(a: Place, b: Place) {
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

/* ── The grid ──────────────────────────────────────────────────────────────── */

/**
 * Time down the side and one column per flokkur, as SplitGrid has it. Closed cards are exactly
 * as tall as they are long (`--ppm` per minute), so the columns stay level with the axis and
 * with each other. On a phone the columns scroll sideways with snap and the axis stays pinned.
 */
function Columns({ ctx }: { ctx: Ctx }) {
  const { model } = ctx;
  const shown = model.lanes;
  const span = Math.max(model.duration, 15);
  const ticks: number[] = [];
  for (let m = 0; m <= span; m += 15) ticks.push(m);

  return (
    <div className={styles.columnsWrap}>
      {model.lanes.length > 2 && (
        <p className={styles.swipe}>
          Strjúktu til hliðar til að sjá alla {countIs(model.lanes.length, "flokk", "flokka")}.
        </p>
      )}
      <div className={styles.scroller} data-scroller>
        <div
          className={styles.grid}
          style={{ ["--span" as string]: span, ["--n" as string]: shown.length }}
        >
          <div className={styles.axisHead} aria-hidden="true">
            kl.
          </div>
          {shown.map((lane) => (
            <LaneHeader
              key={lane.patrolId}
              look={ctx.header}
              lane={lane}
              model={model}
              laneStyle={laneVars(lane.accent)}
            />
          ))}
          <div className={styles.axis} aria-hidden="true">
            {ticks.map((m) => (
              <span key={m} className={styles.tick} style={{ top: `calc(var(--ppm) * ${m})` }}>
                {at(model, m)}
              </span>
            ))}
          </div>
          {shown.map((lane) => (
            <LaneColumn key={lane.patrolId} ctx={ctx} lane={lane} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LaneColumn({ ctx, lane }: { ctx: Ctx; lane: LaneModel }) {
  const { model } = ctx;
  const span = Math.max(model.duration, 15);
  const rest = span - lane.used;
  const ref = useRef<HTMLDivElement>(null);
  const over =
    !!ctx.drag && ctx.spot?.lane === lane.laneIndex && ctx.drag.fromLane !== lane.laneIndex;
  useSlideIntoPlace(ref, ctx.drag !== null);

  return (
    <div
      ref={ref}
      className={styles.lane}
      data-lane-col={lane.laneIndex}
      data-over={over || undefined}
      data-longest={(lane.longest && !model.balanced) || undefined}
      style={{ ...laneVars(lane.accent), ["--used" as string]: lane.used }}
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

/**
 * While a card is dragged, the cards it passes slide to their new place instead of jumping
 * (FLIP: measure, then animate from the old position). Off under reduced motion; the Web
 * Animations API leaves no transform behind, so the text is as sharp as before.
 */
function useSlideIntoPlace(ref: RefObject<HTMLDivElement | null>, dragging: boolean) {
  const tops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const column = ref.current;
    if (!column) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();
    for (const slot of column.querySelectorAll<HTMLElement>("[data-slot-id]")) {
      const id = slot.dataset.slotId as string;
      const top = slot.offsetTop;
      next.set(id, top);
      const before = tops.current.get(id);
      if (dragging && !still && before !== undefined && before !== top) {
        slot.animate([{ transform: `translateY(${before - top}px)` }, { transform: "none" }], {
          duration: 160,
          easing: "cubic-bezier(0.2, 0.7, 0.3, 1)",
        });
      }
    }
    tops.current = next;
  });
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
