import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  Bench,
  FUNDUR,
  LiveEditor,
  benchData,
  longTextBenchData,
} from "@/stories/vinnubekkur/benchHarness";
import LidurEditor from "./LidurEditor";

const meta: Meta<typeof LidurEditor> = {
  title: "Components/Vinnubekkur/LidurEditor",
  component: LidurEditor,
  parameters: {
    docs: {
      description: {
        component:
          "The inline liður editor, opened under its row. Every field writes straight through " +
          "(no save button); “Lokið” and Escape close it. Spec: " +
          "`docs/design/vinnubekkurinn/SPEC.md` on `origin/release/vinnubekkur-v1`.",
      },
    },
  },
  render: () => (
    <Bench data={benchData()} intents={[{ t: "edit", id: "mock-lidur-2-1" }]}>
      <LiveEditor fundurId={FUNDUR.overTime} lidurId="mock-lidur-2-1" />
    </Bench>
  ),
};

export default meta;
type Story = StoryObj<typeof LidurEditor>;

export const Default: Story = {};

/** Shows the endurmat carried over from last time. */
export const WithEndurmat: Story = {
  render: () => (
    <Bench data={benchData()} intents={[{ t: "edit", id: "mock-lidur-4-2" }]}>
      <LiveEditor fundurId={FUNDUR.utilega} lidurId="mock-lidur-4-2" />
    </Bench>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Endurmat frá síðast")).toBeInTheDocument();
  },
};

/** The only fundur: "Færa í fund…" has nowhere to go and is disabled. */
export const NoOtherFundur: Story = {
  render: () => (
    <Bench data={benchData()} intents={[{ t: "edit", id: "mock-lidur-2-1" }]}>
      <LiveEditor fundurId={FUNDUR.overTime} lidurId="mock-lidur-2-1" alone />
    </Bench>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText("Færa lið í annan fund")).toBeDisabled();
  },
};

export const LongIcelandicText: Story = {
  render: () => (
    <Bench data={longTextBenchData()} intents={[{ t: "edit", id: "mock-lidur-2-1" }]}>
      <LiveEditor fundurId={FUNDUR.overTime} lidurId="mock-lidur-2-1" />
    </Bench>
  ),
};

/** Edits write through: the stepper and the status chips change the liður. */
export const EditFields: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Lengja um 5 mínútur" }));
    await expect(canvas.getByLabelText("Lengd í mínútum")).toHaveValue(35);
    await userEvent.click(canvas.getByRole("button", { name: "Óvíst" }));
    await expect(canvas.getByRole("button", { name: "Óvíst" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  },
};

/** Escape closes it from any field. */
export const ClosesWithEscape: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Staðsetning"));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(canvas.getByText("Ritill lokaður.")).toBeInTheDocument());
  },
};
