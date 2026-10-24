import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import CommentReportPane from "./CommentReportPane";
import type { ReportQueueItem } from "@/services/moderation.service";

const report: ReportQueueItem = {
  id: "r-9",
  content_id: "p-2",
  comment_id: "k-1",
  reporter_id: "u-3",
  reason: "inappropriate",
  note: "Þetta er ekki fallegt að segja við aðra foringja.",
  status: "open",
  created_at: "2026-10-02T14:20:00Z",
  content_name: "Ratleikur um hverfið",
  content_author_name: "Sigríður Jónsdóttir",
  comment_body: "Þetta er það versta sem ég hef séð í bankanum.",
  comment_author_name: "Aron Freyr Kristjánsson",
  comment_created_at: "2026-10-01T18:05:00Z",
};

const meta = {
  title: "Components/Yfirferð/CommentReportPane",
  component: CommentReportPane,
  args: { report, busy: false, onRemove: fn(), onDismiss: fn() },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760 }}>
        <Story />
      </div>
    ),
  ],
  parameters: { auth: "moderator" },
} satisfies Meta<typeof CommentReportPane>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Unsafe: Story = {
  name: "Unsafe, no note",
  args: { report: { ...report, reason: "unsafe", note: null } },
};

export const Busy: Story = { args: { busy: true } };
