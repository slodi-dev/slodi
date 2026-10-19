import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Alert from "@/components/Alert/Alert";
import AlertLab, { type AlertStyle, type AlertVariant } from "./AlertLab";

/**
 * Alert variations. The current one (pale fill, coloured left stripe, round corners) reads as
 * generic AI-product UI; these try other directions. See Lab → About the lab.
 */
const meta = {
  title: "Lab/Alert",
  component: AlertLab,
  tags: ["skip-visual"],
  args: {
    look: "merki",
    variant: "error",
    title: "Villa",
    children: "Tenging við netþjón rofnaði.",
  },
  argTypes: {
    look: { control: "inline-radio", options: ["merki", "midi", "bordi", "lina", "stimpill"] },
    variant: { control: "inline-radio", options: ["success", "warning", "error", "info"] },
  },
} satisfies Meta<typeof AlertLab>;

export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLES: { variant: AlertVariant; title: string; body: string }[] = [
  { variant: "success", title: "Tókst", body: "„Kötturinn og músin“ er komin í bankann." },
  {
    variant: "warning",
    title: "Athugaðu",
    body: "Ratleikur um hverfið hefur engar öryggisleiðbeiningar.",
  },
  { variant: "error", title: "Villa", body: "Ekki tókst að vista dagskrána. Reyndu aftur." },
  {
    variant: "info",
    title: "Til upplýsingar",
    body: "Dagskráin er vistuð sem drög þar til þú birtir hana.",
  },
];
const LONG =
  "Á meðan dagskráin er í yfirferð sjá aðrir foringjar hana ekki í bankanum. Þú getur haldið áfram að breyta henni, en hver breyting sendir hana aftur í röðina.";

const LOOKS: { look: AlertStyle; name: string; idea: string }[] = [
  {
    look: "merki",
    name: "A · Badge",
    idea: "A white card with a solid status disc, like a sewn-on badge.",
  },
  { look: "midi", name: "B · Slip", idea: "A neutral slip; the status is a small coloured label." },
  {
    look: "bordi",
    name: "C · Band",
    idea: "Full-strength colour, for messages about the whole page.",
  },
  {
    look: "lina",
    name: "D · Rule",
    idea: "No box; a rule above, colour only in the icon and title.",
  },
  {
    look: "stimpill",
    name: "E · Stamp",
    idea: "A dashed frame, like a stamp in the scout handbook.",
  },
];

const stack = { display: "grid", gap: "var(--sl-spacing-sm)" } as const;
const heading = {
  margin: "0 0 var(--sl-spacing-xs)",
  font: "var(--sl-font-weight-semibold) var(--sl-text-body-sm) var(--sl-font-family-body)",
} as const;
const idea = {
  margin: "0 0 var(--sl-spacing-sm)",
  color: "hsl(var(--sl-color-text-secondary))",
  fontSize: "var(--sl-text-body-sm)",
} as const;

function Set({ look }: { look: AlertStyle | "current" }) {
  const render = (v: AlertVariant, title: string | undefined, body: string, key: string) =>
    look === "current" ? (
      <Alert key={key} variant={v} title={title}>
        {body}
      </Alert>
    ) : (
      <AlertLab key={key} look={look} variant={v} title={title}>
        {body}
      </AlertLab>
    );
  return (
    <div style={stack}>
      {SAMPLES.map((s) => render(s.variant, s.title, s.body, s.variant))}
      {render("info", undefined, "Án fyrirsagnar: ein lína af texta.", "untitled")}
      {render("warning", "Dagskráin bíður yfirferðar hjá Dagskrárstjórnarteyminu", LONG, "long")}
    </div>
  );
}

/** One state across every look, to compare at a glance. */
export const Comparison: Story = {
  name: "Comparison",
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--sl-spacing-lg)", maxWidth: "44rem" }}>
      <section>
        <h3 style={heading}>Current</h3>
        <p style={idea}>What the app uses today.</p>
        <Alert variant={args.variant} title={args.title}>
          {args.children}
        </Alert>
      </section>
      {LOOKS.map((l) => (
        <section key={l.look}>
          <h3 style={heading}>{l.name}</h3>
          <p style={idea}>{l.idea}</p>
          <AlertLab look={l.look} variant={args.variant} title={args.title}>
            {args.children}
          </AlertLab>
        </section>
      ))}
    </div>
  ),
};

export const Current: Story = { name: "Current", render: () => <Set look="current" /> };
export const Badge: Story = { name: "A · Badge", render: () => <Set look="merki" /> };
export const Slip: Story = { name: "B · Slip", render: () => <Set look="midi" /> };
export const Band: Story = { name: "C · Band", render: () => <Set look="bordi" /> };
export const Rule: Story = { name: "D · Rule", render: () => <Set look="lina" /> };
export const Stamp: Story = { name: "E · Stamp", render: () => <Set look="stimpill" /> };

/** The chosen look, with controls, for tweaking. */
export const Playground: Story = { name: "Playground" };
