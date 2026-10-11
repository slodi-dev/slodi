import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

const meta = {
  title: "Components/Shared/DeleteConfirmModal",
  component: DeleteConfirmModal,
  args: {
    open: true,
    programName: "Kötturinn og músin",
    isDeleting: false,
    onClose: fn(),
    onConfirm: fn(),
  },
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, height: "360px" } },
  },
} satisfies Meta<typeof DeleteConfirmModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Deleting: Story = { args: { isDeleting: true } };

export const WithoutName: Story = { args: { programName: null } };

export const LongName: Story = {
  args: {
    programName:
      "Næturganga um Heiðmörk með vasaljósum, stjörnuskoðun og sögum af álfum og huldufólki við varðeldinn",
  },
};
