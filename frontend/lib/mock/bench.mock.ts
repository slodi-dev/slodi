import type { Fundur, Lidur, PlanBenchData, PlanStatus, SlotKind } from "@/services/plan.service";
import { formatIcelandicDayMonth } from "@/lib/format";
import { MOCK_SCRATCHPAD_ID, MOCK_PATROLS } from "./plan.mock";

/**
 * Fixture fundir for the bench.
 *
 * Built from the same anchor as the grid fixture — see plan.mock.ts on why the
 * dates move with today rather than being hard-coded — so the bench, the Rist
 * and the Dagatal all describe the same season rather than three unrelated
 * ones. A leader clicking an event in the Rist should land on that same fundur
 * on the bench, and that only holds if the ids line up.
 *
 * The liðir are deliberately uneven: some fundir are over their budget, some
 * are half off-theme, one is a bare skeleton with everything still undecided.
 * A fixture where every meeting is neatly planned would show none of the states
 * the design draws for the messy ones, which are the ones worth designing for.
 */

const CURRENT_WEEK = 8;

function mondayOf(date: Date): Date {
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function isoDateTime(day: Date, minutes: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(
    Math.floor(minutes / 60)
  )}:${pad(minutes % 60)}:00`;
}

type Blueprint = {
  title: string;
  week: number;
  theme: string;
  venue: string;
  scope: "troop-wide" | "per-flokkur";
  planned: number;
  items: [string, SlotKind, number, PlanStatus, string?][];
};

const SKELETON: Blueprint["items"] = [
  ["Fánastund og hróp", "setning", 10, "confirmed"],
  ["Verkefni fundarins", "dagskra", 45, "unknown"],
  ["Leikur", "leikur", 20, "unknown"],
  ["Slit og tilkynningar", "slit", 10, "confirmed"],
];

const BLUEPRINTS: Blueprint[] = [
  {
    title: "Flokksfundur Refa",
    week: CURRENT_WEEK - 2,
    theme: "Útilíf",
    venue: "Skátaheimilið",
    scope: "per-flokkur",
    planned: 90,
    items: [
      ["Fánastund og hróp", "setning", 10, "confirmed", "Útilíf"],
      ["Hnútar: pelastikk og réttur", "dagskra", 35, "confirmed", "Útilíf"],
      ["Kötturinn og músin", "leikur", 20, "confirmed", "Hreyfing"],
      ["Undirbúningur fyrir útileguna", "dagskra", 15, "confirmed", "Útilíf"],
      ["Slit og tilkynningar", "slit", 10, "confirmed", "Hefðir"],
    ],
  },
  {
    title: "Sveitarfundur: haustvarðeldur",
    week: CURRENT_WEEK - 1,
    theme: "Hefðir",
    venue: "Öskjuhlíð",
    scope: "troop-wide",
    planned: 105,
    items: [
      ["Fánastund úti", "setning", 10, "confirmed", "Hefðir"],
      ["Varðeldur kveiktur", "dagskra", 30, "confirmed", "Hefðir"],
      ["Söngvar og hróp", "dagskra", 25, "confirmed", "Hefðir"],
      ["Ratleikur í myrkri", "leikur", 30, "tentative", "Ratleikni"],
      ["Slit við eldinn", "slit", 10, "confirmed", "Hefðir"],
      ["Endurmat foringja", "endurmat", 15, "draft", "Endurmat"],
    ],
  },
  {
    title: "Flokksfundur Arna",
    week: CURRENT_WEEK,
    theme: "Ratleikni",
    venue: "Skátaheimilið",
    scope: "per-flokkur",
    planned: 90,
    items: [
      ["Fánastund og hróp", "setning", 10, "confirmed", "Hefðir"],
      ["Áttavitinn: undirstöður", "dagskra", 30, "confirmed", "Ratleikni"],
      ["Kortalestur í hverfinu", "dagskra", 35, "draft", "Ratleikni"],
      ["Stórfiskaleikur", "leikur", 15, "draft", "Hreyfing"],
      ["Slit og tilkynningar", "slit", 10, "confirmed", "Hefðir"],
    ],
  },
  {
    title: "Flokksfundur Ugla",
    week: CURRENT_WEEK + 1,
    theme: "Umhyggja",
    venue: "Félagsheimilið",
    scope: "per-flokkur",
    planned: 90,
    items: [
      ["Fánastund og hróp", "setning", 10, "confirmed", "Hefðir"],
      ["Hjálp í viðlögum (1/2)", "dagskra", 40, "draft", "Umhyggja"],
      ["Leikur að eigin vali", "leikur", 20, "unknown"],
      ["Slit og tilkynningar", "slit", 10, "confirmed", "Hefðir"],
    ],
  },
  {
    title: "Haustútilega á Úlfljótsvatni",
    week: CURRENT_WEEK + 1,
    theme: "Útilíf",
    venue: "Úlfljótsvatn",
    scope: "troop-wide",
    planned: 240,
    items: [
      ["Brottför og talning", "setning", 20, "confirmed", "Hefðir"],
      ["Tjaldbúðir reistar", "dagskra", 60, "confirmed", "Útilíf"],
      ["Eldamennska á prímus", "dagskra", 75, "draft", "Útilíf"],
      ["Kvöldvaka", "dagskra", 60, "tentative", "Hefðir"],
      ["Frágangur og heimferð", "slit", 30, "draft", "Útilíf"],
    ],
  },
  {
    title: "Flokksfundur Bjarna",
    week: CURRENT_WEEK + 3,
    theme: "Sjómennska",
    venue: "Skátaheimilið",
    scope: "per-flokkur",
    planned: 90,
    items: SKELETON,
  },
];

const ENDURMAT: Record<string, string> = {
  "Kötturinn og músin": "Of stuttur síðast — krakkarnir vildu spila aftur.",
  "Eldamennska á prímus": "Tók 20 mín lengur en áætlað var. Fleiri prímusa næst.",
};

function buildFundur(bp: Blueprint, index: number, dated: boolean): Fundur {
  const monday = dated ? addDays(mondayOf(new Date()), 7 * (bp.week - CURRENT_WEEK)) : null;
  // Troop-wide events land at the weekend, flokksfundir midweek.
  const day = monday ? addDays(monday, bp.scope === "troop-wide" ? 4 : 2) : null;
  const startMinutes = bp.scope === "troop-wide" ? 17 * 60 : 19 * 60 + 30;

  const items: Lidur[] = bp.items.map(([name, kind, minutes, status, theme], i) => ({
    id: `mock-lidur-${index}-${i}`,
    name,
    kind,
    minutes,
    status,
    theme: theme ?? null,
    venue: null,
    endurmat: ENDURMAT[name] ?? null,
  }));

  return {
    event_id: `mock-fundur-${index}`,
    title: bp.title,
    date_label: day ? formatIcelandicDayMonth(day) : `Vika ${bp.week}`,
    starts_at: day ? isoDateTime(day, startMinutes) : null,
    planned_minutes: bp.planned,
    venue: bp.venue,
    theme: bp.theme,
    scope: bp.scope,
    week_index: bp.week,
    of_weeks: 20,
    items,
  };
}

export function mockBench(seasonId: string): PlanBenchData {
  const dated = seasonId !== MOCK_SCRATCHPAD_ID;
  return {
    season_id: seasonId,
    // The same flokkar the grid views draw, so a split band deals into the
    // columns a leader already recognises.
    patrols: MOCK_PATROLS,
    fundir: BLUEPRINTS.map((bp, i) => buildFundur(bp, i, dated)),
  };
}

/** Total minutes the liðir of a fundur add up to. */
export function totalMinutes(fundur: Fundur): number {
  return fundur.items.reduce((sum, item) => sum + item.minutes, 0);
}
