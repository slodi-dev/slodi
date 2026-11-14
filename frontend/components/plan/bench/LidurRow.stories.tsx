import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  Bench,
  FUNDUR,
  LiveRow,
  benchData,
  longTextBenchData,
} from "@/stories/vinnubekkur/benchHarness";
import LidurRow from "./LidurRow";

const meta: Meta<typeof LidurRow> = {
  title: "Components/Vinnubekkur/LidurRow",
  component: LidurRow,
  parameters: {
    docs: {
      description: {
        component:
          "One liður on a sheet. Its height is proportional to its length; the grip is the " +
          "pointer drag handle and the row itself is the keyboard surface (Space grabs, ↑↓ " +
          "move, Enter opens the editor, Delete removes). Spec: " +
          "`docs/design/vinnubekkurinn/SPEC.md` on `origin/release/vinnubekkur-v1`.",
      },
    },
  },
  render: () => (
    <Bench data={benchData()}>
      <LiveRow fundurId={FUNDUR.overTime} lidurId="mock-lidur-2-1" />
    </Bench>
  ),
};

export default meta;
type Story = StoryObj<typeof LidurRow>;

/** A confirmed 30-minute dagskrá. */
export const Default: Story = {};

/** A 5-minute floor and a 75-minute block: height follows length, within bounds. */
export const ShortAndLong: Story = {
  render: () => (
    <Bench data={benchData()}>
      <LiveRow fundurId={FUNDUR.pastSveit} lidurId="mock-lidur-1-0" />
      <LiveRow fundurId={FUNDUR.utilega} lidurId="mock-lidur-4-2" />
    </Bench>
  ),
};

/** Undecided ("Óákveðið"). */
export const Undecided: Story = {
  render: () => (
    <Bench data={benchData()}>
      <LiveRow fundurId={FUNDUR.nextUglur} lidurId="mock-lidur-3-2" />
    </Bench>
  ),
};

/** Carries an endurmat from the last time it was run. */
export const WithEndurmat: Story = {
  render: () => (
    <Bench data={benchData()}>
      <LiveRow fundurId={FUNDUR.pastRefir} lidurId="mock-lidur-0-2" />
    </Bench>
  ),
};

export const Selected: Story = {
  render: () => (
    <Bench data={benchData()}>
      <LiveRow fundurId={FUNDUR.overTime} lidurId="mock-lidur-2-1" selected />
    </Bench>
  ),
};

export const LongIcelandicText: Story = {
  render: () => (
    <Bench data={longTextBenchData()}>
      <LiveRow fundurId={FUNDUR.overTime} lidurId="mock-lidur-2-1" />
    </Bench>
  ),
};

/** Space grabs the row and says so; Escape lets go. */
export const KeyboardGrab: Story = {
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector<HTMLElement>("[data-lidur-row]") as HTMLElement;
    row.focus();
    await userEvent.keyboard(" ");
    await waitFor(() => expect(row).toHaveAttribute("data-grabbed", "true"));
    await expect(canvasElement).toHaveTextContent(/Liður gripinn: Áttavitinn: undirstöður/);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(row).toHaveAttribute("data-grabbed", "false"));
    await expect(canvasElement).toHaveTextContent("Sleppt.");
  },
};

/** ↑ / ↓ on the duration chip shortens and lengthens it by five minutes. */
export const NudgeDuration: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByRole("button", { name: /^Lengd: 30 mínútur/ });
    chip.focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(
      await canvas.findByRole("button", { name: /^Lengd: 35 mínútur/ })
    ).toHaveTextContent("35 mín");
  },
};
