import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "storybook/test";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import { programRatleikur } from "@/stories/fixtures";
import ReportContentModal from "./ReportContentModal";

const meta = {
  title: "Components/Sameiginlegt/ReportContentModal",
  component: ReportContentModal,
  args: {
    open: true,
    onClose: fn(),
    contentId: programRatleikur.id,
    contentName: programRatleikur.name,
  },
  parameters: {
    layout: "fullscreen",
    mockApi: [
      { match: /\/reports/, method: "POST", body: { id: "r-1", reason: "unsafe" } },
    ] satisfies MockRoute[],
    docs: { story: { inline: false, height: "640px" } },
  },
} satisfies Meta<typeof ReportContentModal>;

export default meta;
type Story = StoryObj<typeof meta>;

async function chooseAndSend(canvasElement: HTMLElement, note?: string) {
  const canvas = within(canvasElement);
  await userEvent.click(await canvas.findByLabelText("Getur verið hættulegt"));
  if (note) await userEvent.type(canvas.getByRole("textbox"), note);
  await userEvent.click(canvas.getByRole("button", { name: /Senda tilkynningu/ }));
}

export const Default: Story = {};

export const ReasonChosen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByLabelText("Til nú þegar"));
    await userEvent.type(canvas.getByRole("textbox"), "Sami leikur og „Ratleikur í Laugardal“.");
  },
};

export const Sending: Story = {
  parameters: { mockApi: [{ match: /\/reports/, delay: Infinity }] satisfies MockRoute[] },
  play: async ({ canvasElement }) => chooseAndSend(canvasElement),
};

export const Sent: Story = {
  args: { onClose: fn() },
  play: async ({ canvasElement }) => chooseAndSend(canvasElement, "Engar öryggisleiðbeiningar."),
};

export const ErrorState: Story = {
  name: "Error",
  // No visual baseline: the controls are disabled while sending, so whether
  // focus survives depends on whether the mocked reply lands first (UX rule 11).
  tags: ["skip-visual"],
  parameters: {
    // The failed request is logged by the app on purpose; nothing else may log.
    allowedConsoleErrors: [/^\[API 500\]/],
    mockApi: [
      { match: /\/reports/, status: 500, body: { detail: "Villa á netþjóni" } },
    ] satisfies MockRoute[],
  },
  play: async ({ canvasElement }) => chooseAndSend(canvasElement),
};

export const ReportingAComment: Story = {
  args: { commentId: "c-1", contentName: "athugasemd frá Aroni" },
};

export const LongName: Story = {
  args: {
    contentName:
      "Næturganga um Heiðmörk með vasaljósum, stjörnuskoðun og sögum af álfum og huldufólki við varðeldinn",
  },
};
