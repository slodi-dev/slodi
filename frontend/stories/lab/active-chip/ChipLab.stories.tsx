import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import ActiveChip from "@/components/ui/ActiveChip";
import ChipLab, { type ChipTone } from "./ChipLab";

/** ActiveChip is staying. These are greens for the other places a chip is used. */
const meta = {
  title: "Lab/ActiveChip",
  component: ChipLab,
  tags: ["skip-visual"],
  args: { label: "Útilíf", tone: "filter" },
  argTypes: {
    tone: {
      control: "inline-radio",
      options: ["filter", "selected", "suggested", "status", "deep"],
    },
  },
} satisfies Meta<typeof ChipLab>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};
const TONES: {
  tone: ChipTone;
  name: string;
  use: string;
  chips: { label: string; count?: number; remove?: boolean }[];
}[] = [
  {
    tone: "filter",
    name: "Active filter (as today)",
    use: "An applied filter you can remove.",
    chips: [
      { label: "Útilíf", remove: true },
      { label: "Drekaskátar", remove: true },
      { label: "20–40 mín", remove: true },
    ],
  },
  {
    tone: "selected",
    name: "Selected",
    use: "One picked from a set: ALLT / DAGSKRÁ / LEIKUR.",
    chips: [{ label: "Allt" }, { label: "Leikur", count: 24 }],
  },
  {
    tone: "suggested",
    name: "Suggested",
    use: "Offered but not applied: add this filter, an optional tag.",
    chips: [{ label: "+ Ratleikni" }, { label: "+ Hefðir" }],
  },
  {
    tone: "status",
    name: "Status",
    use: "A fact about the item, not clickable.",
    chips: [{ label: "Staðfest" }, { label: "Birt" }],
  },
  {
    tone: "deep",
    name: "Strong identity",
    use: "A category or færnimerki that should stand out.",
    chips: [{ label: "Færnimerki: Rötun" }, { label: "Útilíf", count: 7 }],
  },
];

const row = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--sl-spacing-xs)",
  alignItems: "center",
} as const;
const caption = {
  margin: "0 0 var(--sl-spacing-xs)",
  fontSize: "var(--sl-text-body-sm)",
  color: "hsl(var(--sl-color-text-secondary))",
} as const;
const name = {
  margin: 0,
  font: "var(--sl-font-weight-semibold) var(--sl-text-body-sm) var(--sl-font-family-body)",
} as const;

/** Every green, each with what it's for. */
export const GreenScale: Story = {
  name: "Green scale",
  render: () => (
    <div style={{ display: "grid", gap: "var(--sl-spacing-lg)", maxWidth: "40rem" }}>
      <section>
        <p style={name}>Current ActiveChip</p>
        <p style={caption}>For reference.</p>
        <div style={row}>
          <ActiveChip label="Útilíf" onRemove={noop} />
          <ActiveChip label="Falið" tone="hidden" />
        </div>
      </section>
      {TONES.map((t) => (
        <section key={t.tone}>
          <p style={name}>{t.name}</p>
          <p style={caption}>{t.use}</p>
          <div style={row}>
            {t.chips.map((c) => (
              <ChipLab
                key={c.label}
                tone={t.tone}
                label={c.label}
                count={c.count}
                onRemove={c.remove ? noop : undefined}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};

/** How they look together in a filter bar: selected type, active filters, suggestions. */
export const InContext: Story = {
  name: "In context",
  render: () => (
    <div style={{ display: "grid", gap: "var(--sl-spacing-sm)", maxWidth: "40rem" }}>
      <div style={row}>
        <ChipLab tone="selected" label="Leikur" count={24} />
        <ChipLab tone="filter" label="Útilíf" onRemove={noop} />
        <ChipLab tone="filter" label="20–40 mín" onRemove={noop} />
        <ChipLab tone="suggested" label="+ Ratleikni" />
      </div>
      <div style={row}>
        <ChipLab tone="status" label="Staðfest" />
        <ChipLab tone="deep" label="Færnimerki: Rötun" />
      </div>
    </div>
  ),
};

export const Playground: Story = { name: "Playground", args: { onRemove: noop } };
