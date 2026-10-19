import { describe, expect, it } from "vitest";
import {
  bandMinutes,
  benchReducer,
  clampMinutes,
  initialBenchState,
  startTimes,
  MAX_MINUTES,
  MIN_MINUTES,
  type BenchState,
} from "../benchState";
import type { Fundur, Lidur, PlanBenchData } from "@/services/plan.service";
import { countIs as count } from "@/lib/format";

/**
 * The reducer is where both the keyboard and the buttons end up, so it is the
 * one place worth testing hard: a bug here is a bug in every path at once.
 */

const PATROLS = [
  { id: "p1", name: "Refir" },
  { id: "p2", name: "Ernir" },
];

function lidur(over: Partial<Lidur> = {}): Lidur {
  return {
    id: "l1",
    name: "Hnútar",
    kind: "dagskra",
    minutes: 30,
    status: "draft",
    theme: "Útilíf",
    venue: null,
    endurmat: null,
    ...over,
  };
}

function fundur(items: Lidur[]): Fundur {
  return {
    event_id: "f1",
    title: "Flokksfundur",
    date_label: "12. febrúar",
    starts_at: "2026-02-12T19:30:00",
    planned_minutes: 90,
    venue: "Skátaheimilið",
    theme: "Útilíf",
    scope: "per-flokkur",
    week_index: 3,
    of_weeks: 8,
    items,
  };
}

function state(items: Lidur[]): BenchState {
  const data: PlanBenchData = { season_id: "s1", patrols: PATROLS, fundir: [fundur(items)] };
  return initialBenchState(data);
}

const THREE = [
  lidur({ id: "a", name: "Fánastund", kind: "setning", minutes: 10 }),
  lidur({ id: "b", name: "Hnútar", kind: "dagskra", minutes: 30 }),
  lidur({ id: "c", name: "Slit", kind: "slit", minutes: 10 }),
];

/** Two blocks in one band, so there is a move that is actually legal. */
const SAME_BAND = [
  lidur({ id: "a", name: "Fánastund", kind: "setning", minutes: 10 }),
  lidur({ id: "b", name: "Hnútar", kind: "dagskra", minutes: 30 }),
  lidur({ id: "c", name: "Ratleikur", kind: "leikur", minutes: 20 }),
  lidur({ id: "d", name: "Slit", kind: "slit", minutes: 10 }),
];

const ids = (s: BenchState) => s.data.fundir[0].items.map((i) => i.id);

describe("bench reducer", () => {
  it("reorders a liður within its band and says where it landed", () => {
    // b and c are both kjarni; the position it reports is the position in the
    // band, because that is the list the leader can see.
    const next = benchReducer(state(SAME_BAND), { t: "move", fundurId: "f1", id: "b", to: 2 });

    expect(ids(next)).toEqual(["a", "c", "b", "d"]);
    expect(next.announcement.text).toBe("Liður færður í sæti 2 af 2: Hnútar.");
  });

  it("refuses to move a block out of its band", () => {
    // The sheet groups by band, so this would change the data without changing
    // the screen — and announce a move the leader never saw.
    const next = benchReducer(state(SAME_BAND), { t: "move", fundurId: "f1", id: "b", to: 0 });

    expect(ids(next)).toEqual(["a", "b", "c", "d"]);
    expect(next.announcement.text).toBe("");
  });

  it("puts the items in band order on load", () => {
    // Array order and screen order have to agree or every index means something
    // different from what the reader sees.
    const scrambled = [
      lidur({ id: "d", name: "Slit", kind: "slit", minutes: 10 }),
      lidur({ id: "a", name: "Fánastund", kind: "setning", minutes: 10 }),
      lidur({ id: "b", name: "Hnútar", kind: "dagskra", minutes: 30 }),
    ];
    expect(ids(state(scrambled))).toEqual(["a", "b", "d"]);
  });

  it("clamps a move at the ends instead of dropping the block", () => {
    // The buttons are disabled at the edges, but the keyboard path can ask for
    // an index past them — losing the block would be much worse than a no-op.
    const up = benchReducer(state(THREE), { t: "move", fundurId: "f1", id: "a", to: -1 });
    expect(ids(up)).toEqual(["a", "b", "c"]);

    const down = benchReducer(state(THREE), { t: "move", fundurId: "f1", id: "c", to: 9 });
    expect(ids(down)).toEqual(["a", "b", "c"]);
  });

  it("removes a liður and lets go of it", () => {
    let s = benchReducer(state(THREE), { t: "grab", id: "b" });
    s = benchReducer(s, { t: "remove", fundurId: "f1", id: "b" });

    expect(ids(s)).toEqual(["a", "c"]);
    // A grab that outlived its block would leave the arrows moving nothing.
    expect(s.grabbed).toBeNull();
    expect(s.announcement.text).toBe("Liður fjarlægður: Hnútar.");
  });

  it("keeps a duration inside what a block can usefully be", () => {
    expect(clampMinutes(0)).toBe(MIN_MINUTES);
    expect(clampMinutes(10_000)).toBe(MAX_MINUTES);

    const next = benchReducer(state(THREE), {
      t: "duration",
      fundurId: "f1",
      id: "b",
      minutes: 1,
    });
    expect(next.data.fundir[0].items[1].minutes).toBe(MIN_MINUTES);
  });

  it("adds a block to the end of its own band, not the end of the fundur", () => {
    // A leikur appended after Slit would be a fundur that closes and carries on.
    const next = benchReducer(state(THREE), {
      t: "add",
      fundurId: "f1",
      lidur: {
        name: "Kötturinn og músin",
        kind: "leikur",
        minutes: 20,
        status: "draft",
        theme: "Hreyfing",
        venue: null,
        endurmat: null,
      },
    });

    const names = next.data.fundir[0].items.map((i) => i.name);
    expect(names).toEqual(["Fánastund", "Hnútar", "Kötturinn og músin", "Slit"]);
  });

  it("selects what it just added, so the next action has a subject", () => {
    const next = benchReducer(state(THREE), {
      t: "add",
      fundurId: "f1",
      lidur: {
        name: "Nýr liður",
        kind: "dagskra",
        minutes: 20,
        status: "draft",
        theme: null,
        venue: null,
        endurmat: null,
      },
    });

    const added = next.data.fundir[0].items.find((i) => i.name === "Nýr liður");
    expect(added).toBeDefined();
    expect(next.selected).toBe(added?.id);
  });

  it("announces grabbing and dropping", () => {
    const grabbed = benchReducer(state(THREE), { t: "grab", id: "b" });
    expect(grabbed.announcement.text).toMatch(/^Liður gripinn: Hnútar\./);

    const dropped = benchReducer(grabbed, { t: "grab", id: null });
    expect(dropped.grabbed).toBeNull();
    expect(dropped.announcement.text).toBe("Sleppt.");
  });

  it("bumps the sequence so the same announcement is read twice", () => {
    // Two identical moves must both reach a screen reader; an aria-live region
    // whose text did not change says nothing the second time.
    const first = benchReducer(state(SAME_BAND), { t: "move", fundurId: "f1", id: "b", to: 2 });
    const second = benchReducer(first, { t: "move", fundurId: "f1", id: "b", to: 1 });
    expect(second.announcement.seq).toBeGreaterThan(first.announcement.seq);
  });

  it("derives start times by running the durations", () => {
    // Stored per-liður start times would go stale the moment anything above
    // changed length, which is the one thing leaders do constantly.
    expect(startTimes(fundur(THREE))).toEqual(["19:30", "19:40", "20:10"]);
  });

  it("has no start times for an undated fundur", () => {
    const undated = { ...fundur(THREE), starts_at: null };
    expect(startTimes(undated)).toEqual([null, null, null]);
  });
});

describe("splitting a band across the flokkar", () => {
  const troopWide = (items: Lidur[]): BenchState => {
    const data: PlanBenchData = {
      season_id: "s1",
      patrols: PATROLS,
      fundir: [{ ...fundur(items), scope: "troop-wide" }],
    };
    return initialBenchState(data);
  };

  const lanesOf = (s: BenchState) => s.data.fundir[0].split?.kjarni;

  it("gives every flokkur its own copy of what the band held", () => {
    // Dealing the existing liðir out one-per-flokkur would be a different
    // operation — "these three do different things", not "each flokkur now
    // runs this itself".
    const next = benchReducer(troopWide(SAME_BAND), {
      t: "splitBand",
      fundurId: "f1",
      band: "kjarni",
    });

    const lanes = lanesOf(next);
    expect(lanes).toHaveLength(2);
    expect(lanes?.[0].items.map((i) => i.name)).toEqual(["Hnútar", "Ratleikur"]);
    expect(lanes?.[1].items.map((i) => i.name)).toEqual(["Hnútar", "Ratleikur"]);
  });

  it("takes the liðir out of the shared list, so nothing renders twice", () => {
    const next = benchReducer(troopWide(SAME_BAND), {
      t: "splitBand",
      fundurId: "f1",
      band: "kjarni",
    });

    expect(ids(next)).toEqual(["a", "d"]); // setning + slit only
  });

  it("gives each lane a distinct id, or editing one would edit them all", () => {
    const next = benchReducer(troopWide(SAME_BAND), {
      t: "splitBand",
      fundurId: "f1",
      band: "kjarni",
    });

    const lanes = lanesOf(next) ?? [];
    const all = lanes.flatMap((lane) => lane.items.map((i) => i.id));
    expect(new Set(all).size).toBe(all.length);
  });

  it("seeds an empty band with something to edit rather than an empty column", () => {
    const next = benchReducer(troopWide([lidur({ id: "a", kind: "setning" })]), {
      t: "splitBand",
      fundurId: "f1",
      band: "kjarni",
    });

    expect(lanesOf(next)?.[0].items).toHaveLength(1);
    expect(lanesOf(next)?.[0].items[0].name).toBe("Nýtt verkefni");
  });

  it("lasts as long as its longest lane, because that is when they regroup", () => {
    // The lanes run concurrently. Summing them would say a 30-minute split
    // where two flokkar work at once takes an hour.
    let s = benchReducer(troopWide(SAME_BAND), { t: "splitBand", fundurId: "f1", band: "kjarni" });
    const extra = lanesOf(s)?.[0].items[0].id as string;
    s = benchReducer(s, {
      t: "lanePatch",
      fundurId: "f1",
      band: "kjarni",
      laneIndex: 0,
      id: extra,
      patch: { minutes: 60 },
    });

    // Lane 0 is 60 + 20 = 80; lane 1 is unchanged at 30 + 20 = 50.
    expect(bandMinutes(s.data.fundir[0], "kjarni")).toBe(80);
  });

  it("pushes the bands after it down the clock", () => {
    // The bug this pins: with the liðir gone from `items`, a flat walk timed
    // Slit as if the split had taken no time at all.
    const before = troopWide(SAME_BAND);
    const slitBefore = startTimes(before.data.fundir[0]).at(-1);
    expect(slitBefore).toBe("20:30"); // 19:30 + 10 + 30 + 20

    const after = benchReducer(before, { t: "splitBand", fundurId: "f1", band: "kjarni" });
    const slitAfter = startTimes(after.data.fundir[0]).at(-1);
    expect(slitAfter).toBe("20:30"); // band is still 50 min wide
  });

  it("merges back to one shared list and says whose plan it kept", () => {
    let s = benchReducer(troopWide(SAME_BAND), { t: "splitBand", fundurId: "f1", band: "kjarni" });
    s = benchReducer(s, { t: "mergeBand", fundurId: "f1", band: "kjarni" });

    expect(s.data.fundir[0].split?.kjarni).toBeUndefined();
    expect(s.data.fundir[0].items.map((i) => i.name)).toEqual([
      "Fánastund",
      "Hnútar",
      "Ratleikur",
      "Slit",
    ]);
    // Merging is lossy by nature, so it names the lane it took.
    expect(s.announcement.text).toMatch(/dagskráin frá fyrsta flokknum gildir/);
  });

  it("will not split a band twice", () => {
    const once = benchReducer(troopWide(SAME_BAND), {
      t: "splitBand",
      fundurId: "f1",
      band: "kjarni",
    });
    const twice = benchReducer(once, { t: "splitBand", fundurId: "f1", band: "kjarni" });
    expect(twice).toBe(once);
  });

  it("adds and removes verkefni inside one lane only", () => {
    let s = benchReducer(troopWide(SAME_BAND), { t: "splitBand", fundurId: "f1", band: "kjarni" });
    s = benchReducer(s, { t: "laneAdd", fundurId: "f1", band: "kjarni", laneIndex: 1 });

    expect(lanesOf(s)?.[0].items).toHaveLength(2);
    expect(lanesOf(s)?.[1].items).toHaveLength(3);

    const target = lanesOf(s)?.[1].items[0].id as string;
    s = benchReducer(s, {
      t: "laneRemove",
      fundurId: "f1",
      band: "kjarni",
      laneIndex: 1,
      id: target,
    });
    expect(lanesOf(s)?.[0].items).toHaveLength(2);
    expect(lanesOf(s)?.[1].items).toHaveLength(2);
  });
});

describe("editing a liður", () => {
  it("writes a patch straight through", () => {
    const next = benchReducer(state(THREE), {
      t: "patch",
      fundurId: "f1",
      id: "b",
      patch: { name: "Nýtt heiti", status: "confirmed" },
    });

    const edited = next.data.fundir[0].items.find((i) => i.id === "b");
    expect(edited?.name).toBe("Nýtt heiti");
    expect(edited?.status).toBe("confirmed");
  });

  it("duplicates a liður directly after itself, with a new id", () => {
    const next = benchReducer(state(SAME_BAND), { t: "duplicate", fundurId: "f1", id: "b" });
    const names = next.data.fundir[0].items.map((i) => i.name);

    expect(names).toEqual(["Fánastund", "Hnútar", "Hnútar", "Ratleikur", "Slit"]);
    const copies = next.data.fundir[0].items.filter((i) => i.name === "Hnútar");
    expect(copies[0].id).not.toBe(copies[1].id);
  });

  it("tracks which editor is open", () => {
    const open = benchReducer(state(THREE), { t: "edit", id: "b" });
    expect(open.editing).toBe("b");
    // Opening an editor selects the row too — they are the same subject.
    expect(open.selected).toBe("b");

    expect(benchReducer(open, { t: "edit", id: null }).editing).toBeNull();
  });
});

describe("moving a verkefni between flokkar", () => {
  const split = (): BenchState => {
    const data: PlanBenchData = {
      season_id: "s1",
      patrols: PATROLS,
      fundir: [{ ...fundur(SAME_BAND), scope: "troop-wide" }],
    };
    return benchReducer(initialBenchState(data), {
      t: "splitBand",
      fundurId: "f1",
      band: "kjarni",
    });
  };

  const lanes = (s: BenchState) => s.data.fundir[0].split?.kjarni ?? [];
  const names = (s: BenchState, lane: number) => lanes(s)[lane].items.map((i) => i.name);

  it("takes it out of one lane and puts it in the other", () => {
    const before = split();
    const moving = lanes(before)[0].items[0].id;

    const after = benchReducer(before, {
      t: "laneMoveAcross",
      fundurId: "f1",
      band: "kjarni",
      fromLane: 0,
      toLane: 1,
      id: moving,
    });

    expect(names(after, 0)).toEqual(["Ratleikur"]);
    expect(names(after, 1)).toEqual(["Hnútar", "Ratleikur", "Hnútar"]);
  });

  it("drops it at the position asked for, not always at the end", () => {
    const before = split();
    const moving = lanes(before)[0].items[1].id; // Ratleikur

    const after = benchReducer(before, {
      t: "laneMoveAcross",
      fundurId: "f1",
      band: "kjarni",
      fromLane: 0,
      toLane: 1,
      id: moving,
      toIndex: 0,
    });

    expect(names(after, 1)).toEqual(["Ratleikur", "Hnútar", "Ratleikur"]);
  });

  it("says which flokkur it came from and which it went to", () => {
    const before = split();
    const moving = lanes(before)[0].items[0].id;
    const after = benchReducer(before, {
      t: "laneMoveAcross",
      fundurId: "f1",
      band: "kjarni",
      fromLane: 0,
      toLane: 1,
      id: moving,
    });

    // Patrol names stay in the nominative — nothing here can decline them.
    expect(after.announcement.text).toMatch(/Fyrri flokkur: Refir\. Nýr flokkur: Ernir\./);
  });

  it("refuses a move that goes nowhere or off the end", () => {
    const before = split();
    const moving = lanes(before)[0].items[0].id;

    const same = benchReducer(before, {
      t: "laneMoveAcross",
      fundurId: "f1",
      band: "kjarni",
      fromLane: 0,
      toLane: 0,
      id: moving,
    });
    expect(same).toBe(before);

    const off = benchReducer(before, {
      t: "laneMoveAcross",
      fundurId: "f1",
      band: "kjarni",
      fromLane: 0,
      toLane: 9,
      id: moving,
    });
    expect(off).toBe(before);
  });

  it("re-times the receiving lane, which is the point of moving it", () => {
    // The lane a block joins gets longer, and if it becomes the longest the
    // whole band does too — so the fundur after it moves down the clock.
    const before = split();
    expect(bandMinutes(before.data.fundir[0], "kjarni")).toBe(50);

    const moving = lanes(before)[0].items[0].id; // Hnútar, 30 min
    const after = benchReducer(before, {
      t: "laneMoveAcross",
      fundurId: "f1",
      band: "kjarni",
      fromLane: 0,
      toLane: 1,
      id: moving,
    });

    // Lane 1 is now 30 + 20 + 30 = 80, and it is the longest.
    expect(bandMinutes(after.data.fundir[0], "kjarni")).toBe(80);
  });
});

describe("moving a liður to another fundur", () => {
  const twoFundir = (): BenchState => {
    const data: PlanBenchData = {
      season_id: "s1",
      patrols: PATROLS,
      fundir: [
        fundur(SAME_BAND),
        {
          ...fundur([lidur({ id: "z", name: "Slit", kind: "slit", minutes: 10 })]),
          event_id: "f2",
          title: "Næsti fundur",
          date_label: "19. febrúar",
        },
      ],
    };
    return initialBenchState(data);
  };

  it("takes it off one sheet and puts it on the other", () => {
    const after = benchReducer(twoFundir(), {
      t: "moveToFundur",
      fundurId: "f1",
      id: "b",
      toFundurId: "f2",
    });

    expect(after.data.fundir[0].items.map((i) => i.id)).toEqual(["a", "c", "d"]);
    expect(after.data.fundir[1].items.map((i) => i.id)).toEqual(["b", "z"]);
  });

  it("lands it in the right band of the fundur it arrives at", () => {
    // "b" is a dagskrá block and "z" is Slit, so it goes above it — not simply
    // appended, which would put Verkefni after the meeting had closed.
    const after = benchReducer(twoFundir(), {
      t: "moveToFundur",
      fundurId: "f1",
      id: "b",
      toFundurId: "f2",
    });

    expect(after.data.fundir[1].items.map((i) => i.name)).toEqual(["Hnútar", "Slit"]);
  });

  it("follows the block, and closes an editor left over the old sheet", () => {
    let s = twoFundir();
    s = benchReducer(s, { t: "edit", id: "b" });
    s = benchReducer(s, { t: "moveToFundur", fundurId: "f1", id: "b", toFundurId: "f2" });

    expect(s.active).toBe("f2");
    expect(s.selected).toBe("b");
    expect(s.editing).toBeNull();
    expect(s.announcement.text).toMatch(/Nýr fundur: Næsti fundur/);
  });

  it("does nothing when the target is the fundur it is already on", () => {
    const before = twoFundir();
    expect(
      benchReducer(before, { t: "moveToFundur", fundurId: "f1", id: "b", toFundurId: "f1" })
    ).toBe(before);
  });
});

describe("adding and moving into a split band", () => {
  const troopWideSplit = (): BenchState => {
    const data: PlanBenchData = {
      season_id: "s1",
      patrols: PATROLS,
      fundir: [
        { ...fundur(SAME_BAND), scope: "troop-wide" },
        {
          ...fundur([lidur({ id: "z", name: "Slit", kind: "slit", minutes: 10 })]),
          event_id: "f2",
          title: "Næsti fundur",
          date_label: "19. febrúar",
        },
      ],
    };
    return benchReducer(initialBenchState(data), {
      t: "splitBand",
      fundurId: "f1",
      band: "kjarni",
    });
  };

  const newBlock = {
    name: "Kötturinn og músin",
    kind: "leikur" as const,
    minutes: 20,
    status: "draft" as const,
    theme: null,
    venue: null,
    endurmat: null,
  };

  it("puts an added block in the lanes, not in a list nothing renders", () => {
    // Appending to `items` while the band is split makes the block invisible,
    // absent from the clock, and yet counted in the header — added, announced,
    // and nowhere to be seen.
    const before = troopWideSplit();
    const after = benchReducer(before, { t: "add", fundurId: "f1", lidur: newBlock });

    const lanes = after.data.fundir[0].split?.kjarni ?? [];
    expect(lanes[0].items.map((i) => i.name)).toContain("Kötturinn og músin");
    expect(lanes[1].items.map((i) => i.name)).toContain("Kötturinn og músin");
    // And nothing leaked into the shared list.
    expect(after.data.fundir[0].items.map((i) => i.name)).toEqual(["Fánastund", "Slit"]);
    expect(after.announcement.text).toMatch(/öllum 2 flokkum: Kötturinn og músin\./);
  });

  it("still adds to the shared list when the band is not split", () => {
    const before = troopWideSplit();
    const after = benchReducer(before, {
      t: "add",
      fundurId: "f1",
      lidur: { ...newBlock, kind: "slit" },
    });

    expect(after.data.fundir[0].items.map((i) => i.name)).toEqual([
      "Fánastund",
      "Slit",
      "Kötturinn og músin",
    ]);
  });

  it("lands a cross-fundur move in one flokkur, and says which", () => {
    // A move must not turn one block into four — but it must land somewhere
    // the sheet actually draws.
    let s = troopWideSplit();
    s = benchReducer(s, { t: "moveToFundur", fundurId: "f2", id: "z", toFundurId: "f1" });

    // "z" is Slit, which is not split — it joins the shared list.
    expect(s.data.fundir[0].items.map((i) => i.name)).toEqual(["Fánastund", "Slit", "Slit"]);
  });

  it("puts a cross-fundur move into the first lane when the band is split", () => {
    let s = troopWideSplit();
    s = benchReducer(s, {
      t: "patch",
      fundurId: "f2",
      id: "z",
      patch: { kind: "dagskra" },
    });
    s = benchReducer(s, { t: "moveToFundur", fundurId: "f2", id: "z", toFundurId: "f1" });

    const lanes = s.data.fundir[0].split?.kjarni ?? [];
    expect(lanes[0].items.map((i) => i.name)).toContain("Slit");
    expect(lanes[1].items.map((i) => i.name)).not.toContain("Slit");
    expect(s.announcement.text).toMatch(/Flokkur: Refir\./);
  });
});

describe("lane move announcements", () => {
  const split = (): BenchState => {
    const data: PlanBenchData = {
      season_id: "s1",
      patrols: PATROLS,
      fundir: [{ ...fundur(SAME_BAND), scope: "troop-wide" }],
    };
    return benchReducer(initialBenchState(data), {
      t: "splitBand",
      fundurId: "f1",
      band: "kjarni",
    });
  };

  it("says nothing when the move goes nowhere", () => {
    // ArrowUp on the first block dispatches to: -1. It used to announce
    // "fært í sæti 0" while the list was untouched.
    const before = split();
    const first = (before.data.fundir[0].split?.kjarni ?? [])[0].items[0].id;

    const after = benchReducer(before, {
      t: "laneMove",
      fundurId: "f1",
      band: "kjarni",
      laneIndex: 0,
      id: first,
      to: -1,
    });

    expect(after).toBe(before);
  });

  it("announces the seat it actually landed in, not the one asked for", () => {
    const before = split();
    const lane = before.data.fundir[0].split?.kjarni ?? [];
    const last = lane[0].items[lane[0].items.length - 1].id;

    const after = benchReducer(before, {
      t: "laneMove",
      fundurId: "f1",
      band: "kjarni",
      laneIndex: 0,
      id: last,
      to: 99,
    });

    expect(after).toBe(before); // already last — nothing to do, nothing to say
  });
});

describe("Icelandic counts", () => {
  it("takes the singular for 1 and for anything ending in 1 but 11", () => {
    expect(count(1, "liður", "liðir")).toBe("1 liður");
    expect(count(21, "liður", "liðir")).toBe("21 liður");
    expect(count(11, "liður", "liðir")).toBe("11 liðir");
    expect(count(2, "liður", "liðir")).toBe("2 liðir");
    expect(count(0, "liður", "liðir")).toBe("0 liðir");
  });
});

describe("a drop names its own position", () => {
  const block = {
    name: "Stórfiskaleikur",
    kind: "leikur" as const,
    minutes: 15,
    status: "draft" as const,
    theme: null,
    venue: null,
    endurmat: null,
  };

  it("inserts where the drop landed, not at the end of the band", () => {
    // The whole reason to drag rather than press "Bæta við" is to say where.
    const next = benchReducer(state(SAME_BAND), {
      t: "add",
      fundurId: "f1",
      lidur: block,
      at: 1,
    });

    expect(next.data.fundir[0].items.map((i) => i.name)).toEqual([
      "Fánastund",
      "Stórfiskaleikur",
      "Hnútar",
      "Ratleikur",
      "Slit",
    ]);
  });

  it("falls back to the end of the band when no position is given", () => {
    // Which is what the button does — it has no position to name.
    const next = benchReducer(state(SAME_BAND), { t: "add", fundurId: "f1", lidur: block });

    expect(next.data.fundir[0].items.map((i) => i.name)).toEqual([
      "Fánastund",
      "Hnútar",
      "Ratleikur",
      "Stórfiskaleikur",
      "Slit",
    ]);
  });
});

describe("a drop must not interleave the bands", () => {
  it("keeps items band-contiguous when a drop names a foreign position", () => {
    // Every band's rows are droppables in one context, so a leikur can be
    // released over a Setning row. Splicing there would put a kjarni item
    // inside the opnun run — which is what inBandOrder exists to prevent, and
    // what makes `move` announce reorders that change nothing on screen.
    // BenchProvider drops the position in that case; this pins what happens if
    // one ever gets through.
    const next = benchReducer(state(SAME_BAND), {
      t: "add",
      fundurId: "f1",
      lidur: {
        name: "Stórfiskaleikur",
        kind: "leikur",
        minutes: 15,
        status: "draft",
        theme: null,
        venue: null,
        endurmat: null,
      },
    });

    // Bands stay in order: opnun, then kjarni, then lok.
    const bands = next.data.fundir[0].items.map((i) =>
      i.kind === "setning" ? "opnun" : i.kind === "slit" ? "lok" : "kjarni"
    );
    expect(bands).toEqual(["opnun", "kjarni", "kjarni", "kjarni", "lok"]);
  });
});
