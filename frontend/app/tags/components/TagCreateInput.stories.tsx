import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import TagCreateInput from "./TagCreateInput";

const created: MockRoute = {
  method: "POST",
  match: /\/tags$/,
  status: 201,
  body: { id: "t-new", name: "kvöldvaka" },
};

const meta = {
  title: "Components/Stjórnun/TagCreateInput",
  component: TagCreateInput,
  args: { onCreated: fn() },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    mockApi: [created],
    docs: {
      description: {
        component:
          "Adds a merkimiði to the shared vocabulary. Known issue sc-549 (story " +
          "`components-stjórnun-tagcreateinput--default`): the input's focus ring uses " +
          "`--sl-input-shadow-focus`, which resolves to an invalid box-shadow.",
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
    await userEvent.type(await canvas.findByLabelText("Nafn nýs flokks"), "kvöldvaka");
  },
};

export const Saving: Story = {
  parameters: { mockApi: [{ ...created, delay: Infinity }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByLabelText("Nafn nýs flokks"), "kvöldvaka{Enter}");
  },
};

export const AlreadyExists: Story = {
  // No visual baseline: the input is disabled while saving, so whether it keeps
  // its focus ring depends on whether the mocked reply lands first (UX rule 11).
  tags: ["skip-visual"],
  parameters: {
    // The failed request is logged by the app on purpose; nothing else may log.
    allowedConsoleErrors: [/^\[API 409\]/],
    mockApi: [
      {
        method: "POST",
        match: /\/tags$/,
        status: 409,
        body: { detail: "Tag already exists" },
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByLabelText("Nafn nýs flokks"), "útivist{Enter}");
    await expect(await canvas.findByRole("alert")).toBeInTheDocument();
  },
};
