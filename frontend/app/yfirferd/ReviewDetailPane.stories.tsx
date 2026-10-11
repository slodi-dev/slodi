import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import ReviewDetailPane from "./ReviewDetailPane";
import { userModerator } from "@/stories/fixtures";
import { reviewDetail, standingClean, standingRoute, standingSuspended } from "./yfirferdFixtures";

const focusNote =
  "Known issue sc-549: the note composer (`.noteInput`) and custom-days field use " +
  "`box-shadow: var(--sl-shadow-focus)`, which is an invalid shadow (`142 50% 42% / 0.3` is not a " +
  "colour) — focus shows only as a border change.";

const meta = {
  title: "Components/Yfirferð/ReviewDetailPane",
  component: ReviewDetailPane,
  args: {
    detail: reviewDetail,
    loading: false,
    failed: false,
    busy: false,
    onAct: fn(),
    onComment: fn(async () => {}),
    shareUrl: "https://slodi.is/yfirferd?efni=p-2",
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    auth: "moderator",
    mockApi: [standingRoute(standingClean)],
    docs: { description: { component: `The Yfirferð reading pane. ${focusNote}` } },
  },
} satisfies Meta<typeof ReviewDetailPane>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unreviewed: Story = {
  parameters: {
    docs: {
      description: {
        story: `${focusNote} Tab into the note box in story \`components-yfirferð-reviewdetailpane--unreviewed\`.`,
      },
    },
  },
};

export const Approved: Story = {
  args: {
    detail: {
      ...reviewDetail,
      review_state: "approved",
      reviewed_by_name: userModerator.name,
      reviewed_at: "2026-10-04T09:12:00Z",
      review_comments: [
        {
          id: "rc-1",
          body: "Flott efni, samþykkt.",
          visibility: "internal",
          created_at: "2026-10-04T09:12:00Z",
          author_name: userModerator.name,
        },
      ],
    },
  },
};

export const ReportedAndHidden: Story = {
  args: {
    detail: {
      ...reviewDetail,
      review_state: "rejected",
      hidden_at: "2026-10-05T11:00:00Z",
      review_note: "Vantar öryggisleiðbeiningar.",
      reviewed_by_name: userModerator.name,
      reviewed_at: "2026-10-05T11:00:00Z",
      author_strikes: 2,
      open_report_count: 2,
      open_report_reasons: ["unsafe", "other"],
      reports: [
        {
          id: "r-1",
          reason: "unsafe",
          note: "Stöð 3 er við opna tjörn án eftirlits.",
          created_at: "2026-10-04T20:00:00Z",
        },
        { id: "r-2", reason: "other", note: null, created_at: "2026-10-05T08:00:00Z" },
      ],
      review_comments: [
        {
          id: "rc-2",
          body: "Gætirðu bætt við leiðbeiningum um eftirlit við tjörnina?",
          visibility: "to_author",
          created_at: "2026-10-05T11:02:00Z",
          author_name: userModerator.name,
        },
        {
          id: "rc-3",
          body: "Önnur tilkynning um sama atriði í vor.",
          visibility: "internal",
          created_at: "2026-10-05T11:03:00Z",
          author_name: null,
        },
      ],
      author_reports_received: 4,
      author_suspension_count: 2,
      author_suspended_until: "2026-11-04T10:00:00Z",
    },
  },
  parameters: { mockApi: [standingRoute(standingSuspended)] },
};

export const Minimal: Story = {
  name: "Minimal item (no optional sections)",
  args: {
    detail: {
      ...reviewDetail,
      content_type: "task",
      name: "Hnútakeppni",
      description: null,
      instructions: null,
      image: null,
      documents: [],
      equipment: null,
      duration_min: null,
      duration_max: null,
      prep_time_min: null,
      prep_time_max: null,
      count_min: null,
      count_max: null,
      price: null,
      location: null,
      age: null,
      tags: [],
    },
    shareUrl: null,
  },
};

export const Busy: Story = {
  name: "Busy (actions disabled)",
  args: { busy: true },
};

export const Loading: Story = { args: { loading: true } };

export const LoadFailed: Story = { args: { failed: true, detail: null } };

export const NothingSelected: Story = { args: { detail: null } };
