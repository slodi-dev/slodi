import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState, type CSSProperties } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import PlanCalendar from "@/components/plan/PlanCalendar";
import PlanCalendarLab, {
  DayCellLab,
  STAMP_MEANING,
  STAMP_STATES,
  Stamp,
  StampKey,
  sampleEntry,
} from "./PlanCalendarLab";
import {
  LAB_TODAY,
  QUIET_MONTH,
  coversDay,
  currentGrid,
  labGrid,
  placeEntries,
  type LabEntry,
} from "./planCalendarLabData";

/**
 * D4 · Stimplar, the direction the user picked (from the Staða family; D1 Staða, D2 Merki and
 * D3 Varðeldur were removed on 2026-10-19, as were A, B, C and E before them). The Dagatal is a
 * stamp book: a ready fundur is stamped in ink with its theme's picture, a draft is ruled in
 * dashes and pencilled, an unsure one is a dotted sketch with "?", an undecided one an empty
 * dotted box. The past fades to a small grey "LOKIÐ"; a fundur that falls out is crossed out.
 *
 * The month is a **rhythm plus exceptions**: the usual weekly fundur is one quiet line (its time
 * is in "Fundir vikunnar"), anything that breaks the rhythm is a full block with its reason, and
 * a multi-day event is one perforated strip across its days, continuing onto the next week row.
 * Rationale: the **Rationale** page beside these stories. See Lab → About the lab.
 */
const meta = {
  title: "Lab/PlanCalendar",
  component: PlanCalendarLab,
  tags: ["skip-visual"],
  parameters: { layout: "padded" },
  args: { today: LAB_TODAY, onSelect: fn() },
  argTypes: {
    data: { control: false },
    month: { control: false },
    today: { control: false },
  },
} satisfies Meta<typeof PlanCalendarLab>;

export default meta;
type Story = StoryObj<typeof meta>;

const section: CSSProperties = {
  paddingBottom: "var(--sl-spacing-xl)",
  marginBottom: "var(--sl-spacing-lg)",
  borderBottom: "1px solid hsl(var(--sl-color-border))",
};
const heading: CSSProperties = {
  margin: "0 0 var(--sl-spacing-xs)",
  fontSize: "var(--sl-text-body)",
  fontWeight: "var(--sl-font-weight-semibold)",
};
const idea: CSSProperties = {
  margin: "0 0 var(--sl-spacing-md)",
  fontSize: "var(--sl-text-body-sm)",
  color: "hsl(var(--sl-color-text-secondary))",
};

/** The current calendar, then Stimplar, on the same October. */
export const Comparison: Story = {
  render: () => (
    <div>
      <section style={section} aria-labelledby="pc-current">
        <h2 id="pc-current" style={heading}>
          Current
        </h2>
        <p style={idea}>
          PlanEntryChip in the Dagatal. Every fundur is the same white card, so the weekly rhythm is
          a wall of cards. A cancelled fundur can only be deleted, and the útilega and the mót
          appear on their first day only.
        </p>
        <PlanCalendar data={currentGrid()} today={LAB_TODAY} />
      </section>
      <section style={section} aria-labelledby="pc-stimplar">
        <h2 id="pc-stimplar" style={heading}>
          D4 · Stimplar
        </h2>
        <p style={idea}>
          A stamp book of fundir. Ready ones are stamped in ink with their theme&apos;s picture,
          drafts are pencilled into a dashed frame, unsure ones are a dotted sketch with
          &ldquo;?&rdquo;, and undecided ones are an empty dotted box. The status tint keeps the
          month a planning map. The weekly rhythm is quiet, the exceptions are loud.
        </p>
        <PlanCalendarLab />
      </section>
    </div>
  ),
};

const DESKTOP = { viewport: { value: "desktop", isRotated: false } };
const PHONE = { viewport: { value: "phone", isRotated: false } };

/**
 * Desktop October: the routine fundur, the moved one, the one that falls out, the strip that
 * crosses a week row (one button, not two), and the fold on mið 28.
 */
export const BusyMonth: Story = {
  name: "Busy month",
  globals: DESKTOP,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", {
        name: /^Flokksfundur Arna: .+, 20\. október kl\. 19:30, Skátaheimilið, staðfest, 15 mínútur umfram$/,
      })
    );
    await expect(args.onSelect).toHaveBeenCalled();
    await expect(
      canvas.getByRole("button", {
        name: /^Flokksfundur Uglna: .+, 15\. október kl\. 19:30, .*fært frá 14\. október, lokið$/,
      })
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", {
        name: "Flokksfundur Bjarna fellur niður, 22. október: vetrarfrí",
      })
    ).toBeVisible();
    await expect(
      canvas.getAllByRole("button", {
        name: /^Vetrarmót skátafélaganna, lau 24\. okt\.–mán 26\. okt\./,
      })
    ).toHaveLength(1);
    await expect(
      canvas.getByRole("button", {
        name: "Haustútilega á Úlfljótsvatni, fös 30. okt.–sun 1. nóv., öll sveitin, Úlfljótsvatn, drög",
      })
    ).toBeVisible();

    const more = canvas.getByRole("button", { name: "+2 fleiri 28. október" });
    await userEvent.click(more);
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await expect(
      canvas.getByRole("button", {
        name: /^Skipulagsfundur, öll sveitin: .+, 28\. október kl\. 21:00/,
      })
    ).toBeVisible();
  },
};

export const QuietMonth: Story = {
  name: "Quiet month",
  args: { month: QUIET_MONTH },
  globals: DESKTOP,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/^\d+ viðburð(ur|ir) í mánuðinum/)).toBeVisible();
    await expect(canvas.getAllByText("Jólafrí: engir fundir fram yfir áramót")[0]).toBeVisible();
  },
};

/** Phone: the útilega's Saturday lists it with a full-size stamp as "Dagur 2 af 3". */
export const Phone: Story = {
  globals: PHONE,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const day = canvas.getByRole("button", { name: "31. október, 1 viðburður" });
    await userEvent.click(day);
    await expect(day).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByRole("heading", { name: "Laugardagur 31. október" })).toBeVisible();
    await expect(canvas.getByText(/^Dagur 2 af 3 · Öll sveitin/)).toBeVisible();
  },
};

export const Dark: Story = { globals: { theme: "dark" } };

/* ── One day, close up ── */

const day = (d: number) => new Date(2026, 9, d);

/** A stress case the rhythm never makes: mið 28. with a fifth entry squeezed in. */
function fiveOn28(entries: LabEntry[]): LabEntry[] {
  const on28 = entries.filter((e) => coversDay(e, day(28)));
  const extra = entries.find((e) => e.kind === "routine" && coversDay(e, day(27)));
  return extra
    ? [...on28, { ...extra, id: `${extra.id}-copy`, day: day(28), endDay: day(28) }]
    : on28;
}

const onDay = (d: Date) => (all: LabEntry[]) => all.filter((e) => coversDay(e, d));

const CLOSE_DAYS: { label: string; date: Date; pick: (all: LabEntry[]) => LabEntry[] }[] = [
  { label: "1 routine fundur", date: day(21), pick: onDay(day(21)) },
  { label: "2: routine + troop (today)", date: day(19), pick: onDay(day(19)) },
  { label: "Past: moved fundur", date: day(15), pick: onDay(day(15)) },
  { label: "Falls out + strip", date: day(26), pick: onDay(day(26)) },
  { label: "5 entries", date: day(28), pick: fiveOn28 },
];

const closeGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(9.5rem, max-content))",
  gap: "var(--sl-spacing-md)",
  alignItems: "start",
};
const cellLabel: CSSProperties = {
  margin: "0 0 var(--sl-spacing-xs)",
  fontSize: "var(--sl-text-xs)",
  color: "hsl(var(--sl-color-text-secondary))",
};

/** Single cells at desktop width: 1, 2 and 5 entries, a past day, a cancellation and a strip. */
export const OneDayCloseUp: Story = {
  name: "One day, close up",
  globals: DESKTOP,
  render: (args) => {
    const entries = placeEntries(labGrid(), LAB_TODAY);
    return (
      <div style={closeGrid}>
        {CLOSE_DAYS.map(({ label, date, pick }) => (
          <div key={label}>
            <p style={cellLabel}>{label}</p>
            <DayCellLab day={date} entries={pick(entries)} onSelect={args.onSelect} />
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "+3 fleiri 28. október" })
    ).toBeVisible();
  },
};

/* ── Stamp states ── */

const statesRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 30rem), 1fr))",
};
const statesPanel: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(8.5rem, 1fr))",
  gap: "var(--sl-spacing-lg) var(--sl-spacing-md)",
  padding: "var(--sl-spacing-lg)",
  background: "hsl(var(--sl-color-surface))",
  color: "hsl(var(--sl-color-text-primary))",
};
const stateCell: CSSProperties = { display: "grid", justifyItems: "center", gap: "6px" };
const stateName: CSSProperties = {
  fontSize: "var(--sl-text-body-sm)",
  fontWeight: "var(--sl-font-weight-semibold)",
};
const stateLooks: CSSProperties = {
  fontSize: "var(--sl-text-xs)",
  textAlign: "center",
  color: "hsl(var(--sl-color-text-secondary))",
};
const replay: CSSProperties = {
  marginBottom: "var(--sl-spacing-md)",
  minHeight: "2.75rem",
  padding: "0 var(--sl-spacing-md)",
  border: "1px solid hsl(var(--sl-color-border-strong))",
  borderRadius: "var(--sl-radius-button)",
  background: "hsl(var(--sl-color-surface))",
  color: "hsl(var(--sl-color-text-primary))",
  font: "inherit",
  cursor: "pointer",
};

function StampStates() {
  // Remounting the stamps is what replays the thunk: it never runs on a plain re-render.
  const [round, setRound] = useState(0);
  return (
    <div>
      <button type="button" style={replay} onClick={() => setRound((r) => r + 1)}>
        Stimpla aftur
      </button>
      <div style={statesRow}>
        {(["light", "dark"] as const).map((theme) => (
          <section
            key={theme}
            data-theme={theme === "dark" ? "dark" : undefined}
            aria-label={theme === "dark" ? "Dökkt" : "Ljóst"}
            style={statesPanel}
          >
            {STAMP_STATES.map((state) => (
              <div key={`${state}-${round}`} style={stateCell}>
                <Stamp entry={sampleEntry(state, `ástand-${round}`)} size="xl" />
                <span style={stateName}>{STAMP_MEANING[state].name}</span>
                <span style={stateLooks}>{STAMP_MEANING[state].looks}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

/** Every stamp state, large, in light and dark side by side. "Stimpla aftur" replays the thunk. */
export const StampStatesStory: Story = {
  name: "Stamp states",
  globals: { theme: "light" },
  render: () => <StampStates />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Stimpla aftur" }));
    await expect(canvas.getAllByText("Fellur niður")).toHaveLength(2);
  },
};

/** Every stamp and picture, and what it means. */
export const Key: Story = {
  render: () => <StampKey />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Óákveðið")).toBeVisible();
  },
};

export const Playground: Story = {};
