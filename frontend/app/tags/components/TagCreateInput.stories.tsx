import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import TagCreateInput from "./TagCreateInput";
import { SAMPLE_TAGS, createdRoute } from "./tagStoryMocks";

const FIELD = "Leita eða búa til merkimiða";

const meta = {
  title: "Components/Stjórnun/TagCreateInput",
  component: TagCreateInput,
  args: { onCreated: fn(), tags: SAMPLE_TAGS },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    mockApi: [createdRoute({ id: "t-new", name: "Næturleikur" })],
    docs: {
      description: {
        component:
          "The tag page's one field: typing searches, Enter creates a merkimiði when no tag " +
          "has the name. A name that exists is refused inline before any request. While it " +
          "saves only the button is disabled, so focus and the phone keyboard stay (sc-637).",
      },
    },
  },
} satisfies Meta<typeof TagCreateInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Typed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByLabelText(FIELD), "Næturleikur");
  },
};

/** The request is held: the button says „Bý til…“, the field stays enabled and focused. */
export const Saving: Story = {
  parameters: {
    mockApi: [{ ...createdRoute({ id: "t-new", name: "Næturleikur" }), delay: Infinity }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByLabelText(FIELD);
    await userEvent.type(field, "Næturleikur{Enter}");
    await expect(await canvas.findByRole("button", { name: "Bý til…" })).toBeDisabled();
    await expect(field).toBeEnabled();
    await expect(field).toHaveFocus();
  },
};

/** The server says the name is taken (someone made it meanwhile): inline, announced, focus kept. */
export const AlreadyExists: Story = {
  parameters: {
    // The failed request is logged by the app on purpose; nothing else may log.
    allowedConsoleErrors: [/^\[API 409\]/],
    mockApi: [
      {
        method: "POST",
        match: /\/tags$/,
        status: 409,
        body: { detail: "Tag with this name already exists" },
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByLabelText(FIELD);
    await userEvent.type(field, "Næturleikur{Enter}");
    await expect(
      await canvas.findByText("Merkimiði með þessu nafni er þegar til. Veldu annað nafn.")
    ).toBeInTheDocument();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveFocus();
  },
};

/** Over the 50-character limit: the counter turns red and Enter explains by how much. */
export const TooLong: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = "Næturleikur í Heiðmörk með vasaljósum, áttavita og kakói";
    await userEvent.type(await canvas.findByLabelText(FIELD), `${name}{Enter}`);
    await expect(await canvas.findByText(`${name.length} / 50`)).toBeInTheDocument();
    await expect(await canvas.findByText(/Styttu það um/)).toBeInTheDocument();
  },
};
