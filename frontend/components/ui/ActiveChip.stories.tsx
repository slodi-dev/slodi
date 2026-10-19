import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import ActiveChip from "./ActiveChip";

const meta = {
  title: "Design system/Primitives/ActiveChip",
  component: ActiveChip,
  args: { label: "Drekaskátar", onRemove: fn() },
  // Clean under axe in all four forms: a new violation fails CI (docs/ui-quality-pipeline.md).
} satisfies Meta<typeof ActiveChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongLabel: Story = {
  args: { label: "Staðsetning: Heiðmörk, upphaf við bílastæðið hjá Elliðavatnsbæ" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 260 }}>
        <Story />
      </div>
    ),
  ],
};

export const Row: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      {["Drekaskátar", "útivist", "10–30 mín", "Ókeypis", "Leit: kötturinn"].map((label) => (
        <ActiveChip key={label} {...args} label={label} />
      ))}
    </div>
  ),
};

const TONES = [
  { tone: "active", label: "Útilíf", remove: true, use: "An applied filter you can remove." },
  { tone: "selected", label: "Leikur", count: 24, use: "One picked from a set." },
  { tone: "suggested", label: "+ Ratleikni", use: "Offered but not applied." },
  { tone: "status", label: "Staðfest", use: "A fact about the item, not clickable." },
  { tone: "deep", label: "Færnimerki: Rötun", use: "A category or færnimerki that stands out." },
  { tone: "hidden", label: "Falið", use: "Content a moderator has hidden." },
] as const;

/** Every tone, each with what it's for. */
export const Tones: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "var(--sl-spacing-md)" }}>
      {TONES.map((t) => (
        <div key={t.tone} style={{ display: "grid", gap: "var(--sl-spacing-xs)" }}>
          <code style={{ fontSize: "var(--sl-text-xs)" }}>tone=&quot;{t.tone}&quot;</code>
          <div>
            <ActiveChip
              tone={t.tone}
              label={t.label}
              count={"count" in t ? t.count : undefined}
              onRemove={"remove" in t ? fn() : undefined}
            />
          </div>
          <span
            style={{
              fontSize: "var(--sl-text-body-sm)",
              color: "hsl(var(--sl-color-text-secondary))",
            }}
          >
            {t.use}
          </span>
        </div>
      ))}
    </div>
  ),
};

/** Together in a filter bar: the selected type, active filters and a suggestion. */
export const InContext: Story = {
  render: () => (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--sl-spacing-xs)",
        alignItems: "center",
      }}
    >
      <ActiveChip tone="selected" label="Leikur" count={24} />
      <ActiveChip label="Útilíf" onRemove={fn()} />
      <ActiveChip label="20–40 mín" onRemove={fn()} />
      <ActiveChip tone="suggested" label="+ Ratleikni" />
    </div>
  ),
};
