import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { Bench, benchData, mockModeIs } from "@/stories/vinnubekkur/benchHarness";
import BlockPalette from "./BlockPalette";

const meta: Meta<typeof BlockPalette> = {
  title: "Components/Vinnubekkur/BlockPalette",
  component: BlockPalette,
  // The bank is fixtures only (lib/mock/library.mock.ts), shown unless mock
  // mode is "off" — which is what a production build is.
  beforeEach: () => mockModeIs("auto"),
  parameters: {
    docs: {
      description: {
        component:
          "The dagskrárbankinn rail: folders, search, a kind filter, and the blocks — each " +
          "draggable onto a sheet and addable with “Bæta við”. The add flow itself is tested " +
          "in PlanBench › AddFromBank. Spec: `docs/design/vinnubekkurinn/SPEC.md` on " +
          "`origin/release/vinnubekkur-v1`.",
      },
    },
  },
  render: () => (
    <Bench data={benchData()}>
      <BlockPalette />
    </Bench>
  ),
};

export default meta;
type Story = StoryObj<typeof BlockPalette>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Not built yet (sc-148): disabled, and the reason is visible text.
    const create = canvas.getByRole("button", { name: /Búa til nýja blokk/ });
    await expect(create).toBeDisabled();
    await expect(create).toHaveTextContent("Kemur síðar");
  },
};

/** No fundur to add to: "Bæta við" is disabled and the rail says why. */
export const NoFundur: Story = {
  render: () => (
    <Bench data={{ ...benchData(), fundir: [] }}>
      <BlockPalette />
    </Bench>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Veldu fund á bekknum/)).toBeVisible();
    for (const button of canvas.getAllByRole("button", { name: "Bæta við" })) {
      await expect(button).toBeDisabled();
    }
  },
};

/** Mock mode off — what production shows today: no bank behind the rail. */
export const NoBank: Story = {
  beforeEach: () => mockModeIs("off"),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Dagskrárbankinn er ekki tengdur enn/)
    ).toBeVisible();
  },
};

/** Folders and the kind filter narrow the list. */
export const Filtered: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^Færnimerki/ }));
    await expect(canvas.getByText("Áttavitinn: undirstöður")).toBeInTheDocument();
    await expect(canvas.queryByText("Kötturinn og músin")).toBeNull();
  },
};

/** A search that finds nothing says so, and names what was searched. */
export const NoResults: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("searchbox", { name: "Leita í dagskrá" }), "kajak");
    await expect(canvas.getByText(/Ekkert fannst fyrir „kajak“/)).toBeVisible();
  },
};
