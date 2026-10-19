import {
  BANDS,
  BAND_KIND,
  BAND_OF,
  type BandId,
  type Fundur,
  type Lidur,
  type PatrolLane,
  type PlanBenchData,
  type PlanStatus,
} from "@/services/plan.service";
import { countIs } from "@/lib/format";

/** Bands in the order they run, so an added block lands in the right one. */
const BAND_ORDER: Record<string, number> = { opnun: 0, kjarni: 1, lok: 2 };

/**
 * Ids for blocks added in this session.
 *
 * A counter rather than `Math.random()` or `Date.now()`: the same fixture must
 * produce the same ids on every render, or React remounts rows that did not
 * actually change and focus jumps out of the list mid-edit.
 */
let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return String(idCounter);
}

/**
 * The bench's single reducer — sc-161 `AssemblyProvider`.
 *
 * The spec's governing principle is that drag-and-drop is an accelerator and
 * never the only path: add, remove, reorder and move must each be reachable by
 * keyboard *and* by an on-screen button. That is only cheap if both paths change
 * the state the same way, so every one of them dispatches an intent here rather
 * than mutating anything itself. A parallel keyboard implementation is the thing
 * that silently drifts out of step with the mouse one.
 *
 * `announcement` is part of the state for the same reason. Grab, move, drop and
 * cancel each have to reach a screen reader (sc-158), and deriving the wording
 * where the change happens is what stops the announcement describing something
 * the reducer did not actually do.
 *
 * ## Why every announcement starts with the noun
 *
 * Icelandic participles agree in gender with their subject, and a block's name
 * is arbitrary text — "Fánastund" is feminine, "Ratleikur" masculine, "Slit"
 * neuter. Writing `${name} fjarlægður` therefore gets the ending wrong for most
 * blocks, and the same action came out masculine in one branch and neuter in
 * another. Leading with `Liður` (masc.) or `Lið` (dat.) puts the agreement on a
 * word we control, and the name follows after a colon in the nominative, where
 * no case is being claimed for it. Patrol names are handled the same way — they
 * are never bent into `úr Refum` / `til Erna`, because they are user data.
 */

export type BenchIntent =
  | { t: "select"; id: string | null }
  | { t: "activate"; fundurId: string }
  | { t: "grab"; id: string | null }
  | { t: "move"; fundurId: string; id: string; to: number }
  | { t: "remove"; fundurId: string; id: string }
  | { t: "duration"; fundurId: string; id: string; minutes: number }
  | { t: "status"; fundurId: string; id: string; status: PlanStatus }
  | {
      t: "add";
      fundurId: string;
      lidur: Omit<Lidur, "id">;
      /** Index within the fundur's items. Omitted means the end of its band. */
      at?: number;
    }
  | { t: "edit"; id: string | null }
  | { t: "patch"; fundurId: string; id: string; patch: Partial<Omit<Lidur, "id">> }
  | { t: "duplicate"; fundurId: string; id: string }
  | { t: "splitBand"; fundurId: string; band: BandId }
  | { t: "mergeBand"; fundurId: string; band: BandId }
  | { t: "laneSelect"; id: string | null }
  | { t: "laneAdd"; fundurId: string; band: BandId; laneIndex: number; lidur?: Omit<Lidur, "id"> }
  | { t: "laneRemove"; fundurId: string; band: BandId; laneIndex: number; id: string }
  | { t: "laneMove"; fundurId: string; band: BandId; laneIndex: number; id: string; to: number }
  | {
      t: "lanePatch";
      fundurId: string;
      band: BandId;
      laneIndex: number;
      id: string;
      patch: Partial<Omit<Lidur, "id">>;
    }
  | {
      t: "laneMoveAcross";
      fundurId: string;
      band: BandId;
      fromLane: number;
      toLane: number;
      id: string;
      /** Where in the target lane. Omitted means "at the end". */
      toIndex?: number;
    }
  | { t: "moveToFundur"; fundurId: string; id: string; toFundurId: string };

export type BenchState = {
  data: PlanBenchData;
  /** The liður under the cursor, if any. */
  selected: string | null;
  /** The fundur being worked on — its sheet is raised. */
  active: string | null;
  /** Keyboard-grabbed liður: ↑↓ now move it rather than moving focus. */
  grabbed: string | null;
  /** The liður whose inline editor is open, if any. */
  editing: string | null;
  /** The verkefni selected inside a split band's grid. */
  laneSelected: string | null;
  /** What to say next, and a counter so repeats still announce. */
  announcement: { text: string; seq: number };
};

/** A liður may not be shorter than a useful block or longer than a fundur. */
export const MIN_MINUTES = 5;
export const MAX_MINUTES = 180;

export function clampMinutes(minutes: number): number {
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, minutes));
}

/**
 * Items, in band order.
 *
 * The sheet renders the beinagrind bands in sequence, so array order and screen
 * order have to agree or every index in this file means something different
 * from what the reader sees. Normalising once on load — stably, so the order
 * within a band is preserved — is what lets `move`, `startTimes` and the row
 * indices all speak about the same list.
 */
function inBandOrder(items: Lidur[]): Lidur[] {
  return BANDS.flatMap((band) => items.filter((item) => BAND_OF[item.kind] === band.id));
}

export function initialBenchState(data: PlanBenchData): BenchState {
  return {
    data: {
      ...data,
      fundir: data.fundir.map((fundur) => ({ ...fundur, items: inBandOrder(fundur.items) })),
    },
    selected: null,
    active: data.fundir[0]?.event_id ?? null,
    grabbed: null,
    editing: null,
    laneSelected: null,
    announcement: { text: "", seq: 0 },
  };
}

function mapFundur(
  data: PlanBenchData,
  fundurId: string,
  fn: (fundur: Fundur) => Fundur
): PlanBenchData {
  return {
    ...data,
    fundir: data.fundir.map((fundur) => (fundur.event_id === fundurId ? fn(fundur) : fundur)),
  };
}

function find(data: PlanBenchData, fundurId: string, id: string): Lidur | undefined {
  return data.fundir.find((f) => f.event_id === fundurId)?.items.find((i) => i.id === id);
}

function say(state: BenchState, text: string): BenchState["announcement"] {
  return { text, seq: state.announcement.seq + 1 };
}

export function benchReducer(state: BenchState, intent: BenchIntent): BenchState {
  switch (intent.t) {
    case "select":
      return { ...state, selected: intent.id };

    case "activate":
      // FundurSheet dispatches this from onFocus, which fires for every focus
      // bubbling out of any row, button or input in the sheet. Returning the
      // same object lets React bail out instead of re-rendering the bench.
      if (state.active === intent.fundurId) return state;
      return { ...state, active: intent.fundurId };

    case "grab": {
      if (intent.id === null) {
        return {
          ...state,
          grabbed: null,
          announcement: state.grabbed ? say(state, "Sleppt.") : state.announcement,
        };
      }
      const lidur = state.data.fundir.flatMap((f) => f.items).find((item) => item.id === intent.id);
      return {
        ...state,
        grabbed: intent.id,
        selected: intent.id,
        announcement: say(
          state,
          `Liður gripinn: ${lidur?.name ?? "ónefndur"}. Notaðu upp og niður til að færa, bil til að sleppa.`
        ),
      };
    }

    case "move": {
      const fundur = state.data.fundir.find((f) => f.event_id === intent.fundurId);
      if (!fundur) return state;
      const from = fundur.items.findIndex((item) => item.id === intent.id);
      if (from < 0) return state;

      /**
       * A move stays inside its own band.
       *
       * Reordering the flat list across a band boundary would move a block on
       * screen only if its *kind* changed too — the sheet groups by band — so
       * the array would quietly disagree with what the leader sees, and the
       * announcement would report a move that never happened. Moving a leikur
       * "up" past Setning is not a reorder, it is a change of kind, and that is
       * a different intent.
       */
      const band = BAND_OF[fundur.items[from].kind];
      const inBand = fundur.items
        .map((item, i) => (BAND_OF[item.kind] === band ? i : -1))
        .filter((i) => i >= 0);
      // Clamping rather than refusing: the edge buttons are disabled, but the
      // keyboard path can ask for an index past the end of the band.
      const to = Math.min(inBand[inBand.length - 1], Math.max(inBand[0], intent.to));
      if (from === to) return state;

      const items = [...fundur.items];
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);

      return {
        ...state,
        data: mapFundur(state.data, intent.fundurId, (f) => ({ ...f, items })),
        announcement: say(
          state,
          `Liður færður í sæti ${to - inBand[0] + 1} af ${inBand.length}: ${moved.name}.`
        ),
      };
    }

    case "remove": {
      const lidur = find(state.data, intent.fundurId, intent.id);
      if (!lidur) return state;
      return {
        ...state,
        data: mapFundur(state.data, intent.fundurId, (f) => ({
          ...f,
          items: f.items.filter((item) => item.id !== intent.id),
        })),
        selected: state.selected === intent.id ? null : state.selected,
        grabbed: state.grabbed === intent.id ? null : state.grabbed,
        announcement: say(state, `Liður fjarlægður: ${lidur.name}.`),
      };
    }

    case "duration": {
      const minutes = clampMinutes(intent.minutes);
      const lidur = find(state.data, intent.fundurId, intent.id);
      if (!lidur || lidur.minutes === minutes) return state;
      return {
        ...state,
        data: mapFundur(state.data, intent.fundurId, (f) => ({
          ...f,
          items: f.items.map((item) => (item.id === intent.id ? { ...item, minutes } : item)),
        })),
        announcement: say(state, `Lengd ${minutes} mínútur: ${lidur.name}.`),
      };
    }

    case "add": {
      const fundur = state.data.fundir.find((f) => f.event_id === intent.fundurId);
      if (!fundur) return state;

      const band = BAND_OF[intent.lidur.kind];

      /**
       * A split band holds its liðir in lanes, not in `items`.
       *
       * Appending to `items` anyway put the block somewhere the sheet does not
       * render — invisible, excluded from the clock, but counted in the header
       * and announced as added. So when the target band is split, the block
       * goes to every lane, which is the same thing splitting itself does: each
       * flokkur now runs it.
       */
      // Length-checked, not truthiness-checked: a band split on a season with
      // no patrols yields an empty lane array, and the branches below have to
      // agree about whether that counts as "split".
      const lanes = fundur.split?.[band]?.length ? fundur.split[band] : undefined;
      if (lanes) {
        const added = lanes.map((lane) => ({
          ...intent.lidur,
          id: `lidur-${lane.patrol_id}-${nextId()}`,
        }));
        return {
          ...state,
          data: mapFundur(state.data, intent.fundurId, (f) => ({
            ...f,
            split: {
              ...f.split,
              [band]: lanes.map((lane, i) => ({ ...lane, items: [...lane.items, added[i]] })),
            },
          })),
          laneSelected: added[0]?.id ?? null,
          active: intent.fundurId,
          announcement: say(
            state,
            `Lið bætt við hjá öllum ${countIs(lanes.length, "flokki", "flokkum")}: ${
              intent.lidur.name
            }.`
          ),
        };
      }

      const id = `lidur-${intent.fundurId}-${nextId()}`;
      const lidur: Lidur = { ...intent.lidur, id };

      // A drop names its own position; a button press does not, and lands at
      // the end of the band.
      const at = intent.at ?? insertIndexForBand(fundur.items, band);
      const items = [...fundur.items];
      items.splice(at, 0, lidur);

      return {
        ...state,
        data: mapFundur(state.data, intent.fundurId, (f) => ({ ...f, items })),
        selected: id,
        active: intent.fundurId,
        announcement: say(state, `Lið bætt við: ${lidur.name}.`),
      };
    }

    case "edit":
      return { ...state, editing: intent.id, selected: intent.id ?? state.selected };

    case "patch": {
      const lidur = find(state.data, intent.fundurId, intent.id);
      if (!lidur) return state;
      return {
        ...state,
        data: mapFundur(state.data, intent.fundurId, (f) => ({
          ...f,
          /*
           * Re-sorted, because the editor can change `kind` — and kind decides
           * which band a liður is in. Without this the list stops being
           * band-contiguous, and `move` clamps against a range that has a
           * foreign block inside it: the splice puts the block back where it
           * started while the announcement claims it moved.
           */
          items: inBandOrder(
            f.items.map((item) => (item.id === intent.id ? { ...item, ...intent.patch } : item))
          ),
        })),
      };
    }

    case "duplicate": {
      const fundur = state.data.fundir.find((f) => f.event_id === intent.fundurId);
      const at = fundur?.items.findIndex((item) => item.id === intent.id) ?? -1;
      if (!fundur || at < 0) return state;

      const copy: Lidur = { ...fundur.items[at], id: `lidur-${intent.fundurId}-${nextId()}` };
      const items = [...fundur.items];
      items.splice(at + 1, 0, copy);

      return {
        ...state,
        data: mapFundur(state.data, intent.fundurId, (f) => ({ ...f, items })),
        selected: copy.id,
        announcement: say(state, `Liður afritaður: ${copy.name}.`),
      };
    }

    case "splitBand": {
      const fundur = state.data.fundir.find((f) => f.event_id === intent.fundurId);
      if (!fundur || fundur.split?.[intent.band]) return state;

      const shared = fundur.items.filter((item) => BAND_OF[item.kind] === intent.band);
      const label = BANDS.find((b) => b.id === intent.band)?.label ?? intent.band;

      /**
       * Every lane starts as a copy of what the band already held.
       *
       * Dealing the existing liðir out one-per-flokkur would be a different
       * operation — that is "these three do different things", not "each
       * flokkur now runs this itself". Copying keeps the plan meaning the same
       * at the moment of the split, and the leader edits from there. An empty
       * band gets one placeholder per lane so there is something to edit.
       */
      const lanes: PatrolLane[] = state.data.patrols.map((patrol) => ({
        patrol_id: patrol.id,
        items:
          shared.length > 0
            ? shared.map((item) => ({ ...item, id: `lidur-${patrol.id}-${nextId()}` }))
            : [
                {
                  id: `lidur-${patrol.id}-${nextId()}`,
                  name: "Nýtt verkefni",
                  kind: BAND_KIND[intent.band],
                  minutes: 15,
                  status: "draft" as PlanStatus,
                  theme: fundur.theme ?? null,
                  venue: null,
                  endurmat: null,
                },
              ],
      }));

      return {
        ...state,
        data: mapFundur(state.data, intent.fundurId, (f) => ({
          ...f,
          // Exclusive: the liðir live in the lanes now, not in both places.
          items: f.items.filter((item) => BAND_OF[item.kind] !== intent.band),
          split: { ...f.split, [intent.band]: lanes },
        })),
        laneSelected: null,
        announcement: say(
          state,
          `Skipt á ${countIs(lanes.length, "flokk", "flokka")}: ${label}. Hver flokkur fær sinn eigin tíma.`
        ),
      };
    }

    case "mergeBand": {
      const fundur = state.data.fundir.find((f) => f.event_id === intent.fundurId);
      const lanes = fundur?.split?.[intent.band];
      if (!fundur || !lanes || lanes.length === 0) return state;

      const label = BANDS.find((b) => b.id === intent.band)?.label ?? intent.band;
      // The first lane wins. Merging is lossy by nature — there is no single
      // list that is three lists at once — so it takes one and says so.
      const restored = lanes[0].items.map((item) => ({
        ...item,
        id: `lidur-${intent.fundurId}-${nextId()}`,
      }));

      return {
        ...state,
        data: mapFundur(state.data, intent.fundurId, (f) => {
          const split = { ...f.split };
          delete split[intent.band];
          return { ...f, items: inBandOrder([...f.items, ...restored]), split };
        }),
        laneSelected: null,
        announcement: say(
          state,
          `Sameinað í eina röð: ${label}. Allir flokkar gera það sama, og dagskráin frá fyrsta flokknum gildir.`
        ),
      };
    }

    case "laneSelect":
      return { ...state, laneSelected: intent.id };

    case "laneAdd": {
      const fundur = state.data.fundir.find((f) => f.event_id === intent.fundurId);
      const lanes = fundur?.split?.[intent.band];
      if (!fundur || !lanes) return state;

      const lane = lanes[intent.laneIndex];
      const patrol = state.data.patrols.find((p) => p.id === lane?.patrol_id);
      if (!lane) return state;

      const added: Lidur = {
        id: `lidur-${lane.patrol_id}-${nextId()}`,
        name: "Nýtt verkefni",
        kind: BAND_KIND[intent.band],
        minutes: 15,
        status: "draft",
        theme: fundur.theme ?? null,
        venue: null,
        endurmat: null,
        ...intent.lidur,
      };

      return {
        ...state,
        data: mapLane(state.data, intent, (items) => [...items, added]),
        laneSelected: added.id,
        announcement: say(
          state,
          `Lið bætt við: ${added.name}. Flokkur: ${patrol?.name ?? "óþekktur"}.`
        ),
      };
    }

    case "laneRemove": {
      const removed = findInLane(state.data, intent);
      if (!removed) return state;
      return {
        ...state,
        data: mapLane(state.data, intent, (items) => items.filter((item) => item.id !== intent.id)),
        laneSelected: state.laneSelected === intent.id ? null : state.laneSelected,
        announcement: say(state, `Liður fjarlægður: ${removed.name}.`),
      };
    }

    case "laneMove": {
      const lane = state.data.fundir.find((f) => f.event_id === intent.fundurId)?.split?.[
        intent.band
      ]?.[intent.laneIndex];
      const moved = lane?.items.find((item) => item.id === intent.id);
      if (!lane || !moved) return state;

      // Clamped and checked *here*, so the announcement describes the move that
      // actually happened. Doing it inside the mapper meant ArrowUp on the first
      // block said "fært í sæti 0" while nothing moved at all.
      const from = lane.items.findIndex((item) => item.id === intent.id);
      const to = Math.min(lane.items.length - 1, Math.max(0, intent.to));
      if (from === to) return state;

      return {
        ...state,
        data: mapLane(state.data, intent, (items) => {
          const next = [...items];
          const [item] = next.splice(from, 1);
          next.splice(to, 0, item);
          return next;
        }),
        announcement: say(
          state,
          `Liður færður í sæti ${to + 1} af ${lane.items.length}: ${moved.name}.`
        ),
      };
    }

    case "lanePatch": {
      if (!findInLane(state.data, intent)) return state;
      return {
        ...state,
        data: mapLane(state.data, intent, (items) =>
          items.map((item) => (item.id === intent.id ? { ...item, ...intent.patch } : item))
        ),
      };
    }

    case "laneMoveAcross": {
      const fundur = state.data.fundir.find((f) => f.event_id === intent.fundurId);
      const lanes = fundur?.split?.[intent.band];
      if (!fundur || !lanes) return state;

      const from = lanes[intent.fromLane];
      const to = lanes[intent.toLane];
      if (!from || !to || intent.fromLane === intent.toLane) return state;

      const moved = from.items.find((item) => item.id === intent.id);
      if (!moved) return state;

      const at = Math.min(to.items.length, Math.max(0, intent.toIndex ?? to.items.length));
      const nextTo = [...to.items];
      nextTo.splice(at, 0, moved);

      const fromPatrol = state.data.patrols.find((p) => p.id === from.patrol_id);
      const toPatrol = state.data.patrols.find((p) => p.id === to.patrol_id);

      return {
        ...state,
        data: mapFundur(state.data, intent.fundurId, (f) => ({
          ...f,
          split: {
            ...f.split,
            [intent.band]: lanes.map((lane, i) => {
              if (i === intent.fromLane) {
                return { ...lane, items: lane.items.filter((item) => item.id !== intent.id) };
              }
              if (i === intent.toLane) return { ...lane, items: nextTo };
              return lane;
            }),
          },
        })),
        laneSelected: moved.id,
        announcement: say(
          state,
          `Liður færður milli flokka: ${moved.name}. Fyrri flokkur: ${
            fromPatrol?.name ?? "óþekktur"
          }. Nýr flokkur: ${toPatrol?.name ?? "óþekktur"}. Sæti ${at + 1} af ${nextTo.length}.`
        ),
      };
    }

    case "moveToFundur": {
      const source = state.data.fundir.find((f) => f.event_id === intent.fundurId);
      const target = state.data.fundir.find((f) => f.event_id === intent.toFundurId);
      const moved = source?.items.find((item) => item.id === intent.id);
      if (!source || !target || !moved || source === target) return state;

      const band = BAND_OF[moved.kind];
      const lanes = target.split?.[band]?.length ? target.split[band] : undefined;

      /**
       * Into a split band, the block joins one flokkur — the first.
       *
       * Not every lane: this is a *move*, and one block cannot become four
       * without the leader having asked for that. Which lane is an arbitrary
       * choice, so the announcement names it rather than leaving the block to
       * be discovered.
       */
      const withoutSource = (fundur: Fundur) =>
        fundur.event_id === intent.fundurId
          ? { ...fundur, items: fundur.items.filter((item) => item.id !== intent.id) }
          : fundur;

      const intoTarget = (fundur: Fundur): Fundur => {
        if (fundur.event_id !== intent.toFundurId) return fundur;
        if (lanes) {
          return {
            ...fundur,
            split: {
              ...fundur.split,
              [band]: lanes.map((lane, i) =>
                i === 0 ? { ...lane, items: [...lane.items, moved] } : lane
              ),
            },
          };
        }
        const items = [...fundur.items];
        items.splice(insertIndexForBand(fundur.items, band), 0, moved);
        return { ...fundur, items };
      };

      const landedWith = lanes
        ? state.data.patrols.find((p) => p.id === lanes[0].patrol_id)?.name
        : null;

      return {
        ...state,
        data: {
          ...state.data,
          fundir: state.data.fundir.map((fundur) => intoTarget(withoutSource(fundur))),
        },
        // Follow the block: the leader's attention went with it, and leaving the
        // editor open over a fundur it no longer belongs to is just wrong.
        active: intent.toFundurId,
        selected: lanes ? null : moved.id,
        laneSelected: lanes ? moved.id : state.laneSelected,
        editing: null,
        grabbed: null,
        announcement: say(
          state,
          `Liður færður í annan fund: ${moved.name}. Nýr fundur: ${target.title} · ${
            target.date_label
          }.${landedWith ? ` Flokkur: ${landedWith}.` : ""}`
        ),
      };
    }

    default:
      return state;
  }
}

/**
 * Where a block of this kind belongs in a fundur's list.
 *
 * The end of its own band, not the end of the fundur: a leikur appended after
 * Slit would be a fundur that closes and then carries on, which is not what
 * "put this here" means in any of the three places that ask for it.
 */
function insertIndexForBand(items: Lidur[], band: BandId): number {
  let at = items.length;
  for (let i = items.length - 1; i >= 0; i--) {
    if (BAND_OF[items[i].kind] === band) return i + 1;
    if (BAND_ORDER[BAND_OF[items[i].kind]] > BAND_ORDER[band]) at = i;
  }
  return at;
}

type LaneRef = { fundurId: string; band: BandId; laneIndex: number };

function mapLane(
  data: PlanBenchData,
  ref: LaneRef,
  fn: (items: Lidur[]) => Lidur[]
): PlanBenchData {
  return mapFundur(data, ref.fundurId, (fundur) => {
    const lanes = fundur.split?.[ref.band];
    if (!lanes) return fundur;
    return {
      ...fundur,
      split: {
        ...fundur.split,
        [ref.band]: lanes.map((lane, i) =>
          i === ref.laneIndex ? { ...lane, items: fn(lane.items) } : lane
        ),
      },
    };
  });
}

function findInLane(data: PlanBenchData, ref: LaneRef & { id: string }): Lidur | undefined {
  return data.fundir
    .find((f) => f.event_id === ref.fundurId)
    ?.split?.[ref.band]?.[ref.laneIndex]?.items.find((item) => item.id === ref.id);
}

/**
 * How long a band runs.
 *
 * Split bands are the interesting case: the lanes run *concurrently*, so the
 * band lasts as long as its longest lane rather than the sum of everything in
 * it. "Lengsti flokkur ræður" — the sveit reconvenes when the slowest flokkur
 * is done, which is exactly what a leader needs the clock to show.
 */
export function bandMinutes(fundur: Fundur, band: BandId): number {
  const lanes = fundur.split?.[band];
  if (lanes) {
    return lanes.reduce(
      (longest, lane) =>
        Math.max(
          longest,
          lane.items.reduce((sum, item) => sum + item.minutes, 0)
        ),
      0
    );
  }
  return fundur.items
    .filter((item) => BAND_OF[item.kind] === band)
    .reduce((sum, item) => sum + item.minutes, 0);
}

/** Minutes past the fundur's start at which a band begins. */
export function bandOffset(fundur: Fundur, band: BandId): number {
  let offset = 0;
  for (const candidate of BANDS) {
    if (candidate.id === band) return offset;
    offset += bandMinutes(fundur, candidate.id);
  }
  return offset;
}

/** `HH:MM`, `minutes` past the fundur's own start. Null when it has no date. */
export function clockAt(fundur: Fundur, minutes: number): string | null {
  const match = fundur.starts_at ? /T(\d{2}):(\d{2})/.exec(fundur.starts_at) : null;
  if (!match) return null;
  const at = Number(match[1]) * 60 + Number(match[2]) + minutes;
  return `${String(Math.floor(at / 60) % 24).padStart(2, "0")}:${String(at % 60).padStart(2, "0")}`;
}

/** Everything a fundur takes, split bands counted once rather than per lane. */
export function fundurMinutes(fundur: Fundur): number {
  return BANDS.reduce((sum, band) => sum + bandMinutes(fundur, band.id), 0);
}

/**
 * When a fundur's liðir start, given its own start time.
 *
 * Derived rather than stored: a start time per liður would go stale the moment
 * anything above it changed length, and the one thing a leader does constantly
 * is change how long things take.
 *
 * Walks *by band*, not straight down `items`. A split band's liðir are not in
 * `items` at all — they live in lanes — so summing the flat list would time
 * everything after a split as though the split took no time. The Slit of a
 * fundur whose Verkefni had been dealt out to the flokkar would read as
 * starting before the flokkar had finished.
 */
export function startTimes(fundur: Fundur): (string | null)[] {
  if (!fundur.starts_at) return fundur.items.map(() => null);

  const times = new Map<string, string | null>();
  for (const band of BANDS) {
    // Every band starts where the previous one ended, split or not.
    let offset = bandOffset(fundur, band.id);
    for (const item of fundur.items) {
      if (BAND_OF[item.kind] !== band.id) continue;
      times.set(item.id, clockAt(fundur, offset));
      offset += item.minutes;
    }
  }

  return fundur.items.map((item) => times.get(item.id) ?? null);
}
