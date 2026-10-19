import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import { workspace } from "@/stories/fixtures";
import TagManagement from "@/app/tags/components/TagManagement";
import TagsLab, { type TagsLook } from "./TagsLab";
import { SAMPLE_TAGS } from "./tagLab";

/**
 * Variations on the tag-management page (`app/tags/`), each with the create input built in.
 *
 * Every look covers create with an inline, announced duplicate error; the 50-character limit
 * (mirroring `backend/app/domain/tag_constraints.py`) with a counter from 45; rename in place;
 * delete that happens at once with "Afturkalla"; search; empty, loading and error states; long
 * names; and phone width. The text field is never disabled while saving, only its button
 * (UX rule 11, sc-637). Copy says "merkimiði", the word from UX rule 1; the current page says
 * "flokkur". See Lab → About the lab.
 */
const meta = {
  title: "Lab/Tag management",
  component: TagsLab,
  tags: ["skip-visual"],
  args: { look: "leit", status: "ready", saveDelay: 600 },
  argTypes: {
    look: { control: "inline-radio", options: ["leit", "sky", "tafla", "skipt"] },
    status: { control: "inline-radio", options: ["ready", "loading", "error"] },
    saveDelay: { control: { type: "number", min: 0, step: 200 } },
    tags: { control: false },
  },
} satisfies Meta<typeof TagsLab>;

export default meta;
type Story = StoryObj<typeof meta>;

const LOOKS: { look: TagsLook; name: string; idea: string }[] = [
  {
    look: "leit",
    name: "A · Find or create",
    idea: "One field searches as you type; Enter creates the name if no tag has it yet.",
  },
  {
    look: "sky",
    name: "B · Tag cloud",
    idea: "Chips grouped by first letter or by usage, renamed and deleted right on the chip.",
  },
  {
    look: "tafla",
    name: "C · Table",
    idea: "Sortable table with usage counts, and merge for names that differ only by accents or case.",
  },
  {
    look: "skipt",
    name: "D · Split view",
    idea: "A list beside a detail panel that shows the items using the selected tag.",
  },
];

// ── Comparison ────────────────────────────────────────────────────────────────

const configRoute: MockRoute = {
  match: /^\/api\/config/,
  body: { default_workspace_id: workspace.id },
};

const heading = {
  margin: "0 0 var(--sl-spacing-xs)",
  font: "var(--sl-font-weight-semibold) var(--sl-text-body-sm) var(--sl-font-family-body)",
} as const;
const idea = {
  margin: "0 0 var(--sl-spacing-sm)",
  color: "hsl(var(--sl-color-text-secondary))",
  fontSize: "var(--sl-text-body-sm)",
} as const;
const frame = {
  padding: "var(--sl-spacing-md)",
  border: "1px dashed hsl(var(--sl-color-border-strong))",
  borderRadius: "var(--sl-radius-sm)",
} as const;

/** A shorter set for side by side, still with the two long names. */
const FEW = SAMPLE_TAGS.filter((t) =>
  ["t-1", "t-2", "t-4", "t-5", "t-12", "t-13", "t-14", "t-15"].includes(t.id)
);

/** The current page first, then each look with the same tags. */
export const Comparison: Story = {
  name: "Comparison",
  parameters: { auth: "moderator", mockApi: [configRoute] },
  render: () => (
    <div style={{ display: "grid", gap: "var(--sl-spacing-xl)", maxWidth: "52rem" }}>
      <section>
        <h2 style={heading}>Current</h2>
        <p style={idea}>
          What the app uses today: separate create and search fields, a paged list, an inline
          confirm to delete.
        </p>
        <div style={frame}>
          <TagManagement />
        </div>
      </section>
      {LOOKS.map((l) => (
        <section key={l.look}>
          <h2 style={heading}>{l.name}</h2>
          <p style={idea}>{l.idea}</p>
          <div style={frame}>
            <TagsLab look={l.look} tags={FEW} />
          </div>
        </section>
      ))}
    </div>
  ),
};

// ── Per look ──────────────────────────────────────────────────────────────────

const phone = { viewport: { value: "phone", isRotated: false } };
const LONG_NEW = "Næturleikur í Heiðmörk með vasaljósum og áttavita";

/** Shows the counter near the limit, then tries a name that exists. The field must stay usable. */
function duplicatePlay(label: string): Story["play"] {
  return async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByLabelText(label);
    await userEvent.type(field, LONG_NEW);
    await expect(await canvas.findByText(`${LONG_NEW.length} / 50`)).toBeInTheDocument();
    await userEvent.clear(field);
    await userEvent.type(field, "útilíf{Enter}");
    await expect(
      await canvas.findByText(/Merkimiði með þessu nafni er þegar til/)
    ).toBeInTheDocument();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toBeEnabled();
    await expect(field).toHaveFocus();
  };
}

export const FindOrCreate: Story = { name: "A · Find or create", args: { look: "leit" } };
export const FindOrCreateEmpty: Story = {
  name: "A · Find or create, empty",
  args: { look: "leit", tags: [] },
};
export const FindOrCreateLoading: Story = {
  name: "A · Find or create, loading",
  args: { look: "leit", status: "loading" },
};
export const FindOrCreateError: Story = {
  name: "A · Find or create, load error",
  args: { look: "leit", status: "error" },
};
export const FindOrCreateDuplicate: Story = {
  name: "A · Find or create, duplicate name",
  args: { look: "leit" },
  play: duplicatePlay("Leita eða búa til merkimiða"),
};
export const FindOrCreatePhone: Story = {
  name: "A · Find or create, phone",
  args: { look: "leit" },
  globals: phone,
};

export const Cloud: Story = { name: "B · Tag cloud", args: { look: "sky" } };
export const CloudEmpty: Story = { name: "B · Tag cloud, empty", args: { look: "sky", tags: [] } };
export const CloudLoading: Story = {
  name: "B · Tag cloud, loading",
  args: { look: "sky", status: "loading" },
};
export const CloudError: Story = {
  name: "B · Tag cloud, load error",
  args: { look: "sky", status: "error" },
};
export const CloudDuplicate: Story = {
  name: "B · Tag cloud, duplicate name",
  args: { look: "sky" },
  play: duplicatePlay("Nýr merkimiði"),
};
export const CloudPhone: Story = {
  name: "B · Tag cloud, phone",
  args: { look: "sky" },
  globals: phone,
};

export const Table: Story = { name: "C · Table", args: { look: "tafla" } };
export const TableEmpty: Story = { name: "C · Table, empty", args: { look: "tafla", tags: [] } };
export const TableLoading: Story = {
  name: "C · Table, loading",
  args: { look: "tafla", status: "loading" },
};
export const TableError: Story = {
  name: "C · Table, load error",
  args: { look: "tafla", status: "error" },
};
export const TableDuplicate: Story = {
  name: "C · Table, duplicate name",
  args: { look: "tafla" },
  play: duplicatePlay("Nýr merkimiði"),
};
export const TablePhone: Story = {
  name: "C · Table, phone",
  args: { look: "tafla" },
  globals: phone,
};

export const Split: Story = { name: "D · Split view", args: { look: "skipt" } };
export const SplitEmpty: Story = {
  name: "D · Split view, empty",
  args: { look: "skipt", tags: [] },
};
export const SplitLoading: Story = {
  name: "D · Split view, loading",
  args: { look: "skipt", status: "loading" },
};
export const SplitError: Story = {
  name: "D · Split view, load error",
  args: { look: "skipt", status: "error" },
};
export const SplitDuplicate: Story = {
  name: "D · Split view, duplicate name",
  args: { look: "skipt" },
  play: duplicatePlay("Nýr merkimiði"),
};
export const SplitPhone: Story = {
  name: "D · Split view, phone",
  args: { look: "skipt" },
  globals: phone,
};

/** Any look and state, with controls, for tweaking. */
export const Playground: Story = { name: "Playground" };
