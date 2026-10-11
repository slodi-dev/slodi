import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import {
  programKotturinn,
  programRatleikur,
  programSkyndihjalp,
  workspace,
} from "@/stories/fixtures";
import ContentCreateModal from "./ContentCreateModal";

/** useDraft persists to localStorage; start every story from a clean slate. */
function clearDrafts() {
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith("bank-draft-") || key.startsWith("bank-edit-")) {
      window.localStorage.removeItem(key);
    }
  }
}

const meta = {
  title: "Components/Búa til/ContentCreateModal",
  component: ContentCreateModal,
  args: {
    contentType: "task",
    workspaceId: workspace.id,
    onCreated: fn(),
    onClose: fn(),
  },
  beforeEach: () => {
    clearDrafts();
    return clearDrafts;
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      story: { inline: false, height: "720px" },
      description: {
        component:
          "The one form for creating and editing bank items (verkefni, viðburður, dagskrá). " +
          "Known issue sc-549 (story `components-búa-til-contentcreatemodal--create-task`): " +
          "inputs use `--sl-shadow-focus` / `--sl-shadow-focus-error` for their focus ring; " +
          "the token resolves to an invalid box-shadow, so Tab through the form and only the " +
          "border colour changes.",
      },
    },
  },
} satisfies Meta<typeof ContentCreateModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CreateTask: Story = {};

export const CreateEvent: Story = { args: { contentType: "event" } };

export const CreateProgram: Story = { args: { contentType: "program" } };

export const EditExisting: Story = {
  args: { contentType: "event", initial: programRatleikur },
};

export const EditRejectedTask: Story = {
  args: { contentType: "task", initial: programSkyndihjalp },
};

export const Inline: Story = {
  args: { variant: "inline", contentType: "program", initial: programKotturinn },
  parameters: { layout: "padded" },
};

export const TagsLoading: Story = {
  parameters: {
    mockApi: [{ match: /\/tags/, delay: Infinity }] satisfies MockRoute[],
  },
};

export const DraftOffer: Story = {
  beforeEach: () => {
    window.localStorage.setItem(
      `bank-draft-${workspace.id}-task`,
      JSON.stringify({
        name: "Kötturinn og músin",
        description: "Hálfskrifuð lýsing frá því í gær…",
      })
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/ósent drög/)).toBeInTheDocument();
  },
};

/**
 * An interrupted edit is offered, never merged in: the form shows the stored
 * item until "Halda áfram með þær" is pressed (sc-530).
 */
export const EditDraftOffer: Story = {
  args: { contentType: "event", initial: programRatleikur },
  beforeEach: () => {
    window.localStorage.setItem(
      `bank-edit-${programRatleikur.id}`,
      JSON.stringify({ name: `${programRatleikur.name} (óvistað)` })
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/óvistaðar breytingar/)).toBeInTheDocument();
    await expect(canvas.getByDisplayValue(programRatleikur.name)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Halda áfram með þær" }));
    await expect(
      await canvas.findByDisplayValue(`${programRatleikur.name} (óvistað)`)
    ).toBeInTheDocument();
  },
};

export const ValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /Bæta í bankann/ }));
    await expect(await canvas.findByText(/Heiti hugmyndar er nauðsynlegt/)).toBeInTheDocument();
  },
};

export const SaveFails: Story = {
  parameters: {
    // The failed request is logged by the app on purpose; nothing else may log.
    allowedConsoleErrors: [/^\[API 422\]/],
    mockApi: [
      {
        method: "POST",
        match: /\/workspaces\/[^/]+\/(tasks|events|programs)/,
        status: 422,
        body: { detail: [{ loc: ["body", "name"], msg: "Heiti er þegar til í bankanum" }] },
      },
    ] satisfies MockRoute[],
    docs: {
      description: {
        story:
          "The backend refuses the submission (422). The API helper logs the error to the " +
          "console on purpose; the form shows it in its summary line.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The form re-lays itself out once useLayoutMode has read the viewport, which
    // replaces the inputs; wait for that before typing into one.
    await new Promise((resolve) => setTimeout(resolve, 300));
    const name = await waitFor(() => {
      const el = canvasElement.querySelector<HTMLInputElement>('[data-field="name"]');
      if (!el) throw new Error("name field not rendered yet");
      return el;
    });
    await userEvent.type(name, "Kötturinn og músin");
    await userEvent.click(await canvas.findByRole("button", { name: /Bæta í bankann/ }));
    await expect(await canvas.findByText(/þegar til í bankanum/)).toBeInTheDocument();
  },
};
