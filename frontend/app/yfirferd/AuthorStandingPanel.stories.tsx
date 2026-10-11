import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AuthorStandingPanel from "./AuthorStandingPanel";
import { userMember } from "@/stories/fixtures";
import {
  standingClean,
  standingOpenEnded,
  standingRoute,
  standingSuspended,
  standingWithHistory,
} from "./yfirferdFixtures";

const focusNote =
  "Known issue sc-549: the custom-days field (`.numInput`) uses `box-shadow: var(--sl-shadow-focus)`, " +
  "which resolves to `0 0 0 3px 142 50% 42% / 0.3` — not a colour — so the ring is dropped and " +
  "focus shows only as a border change.";

const meta = {
  title: "Components/Yfirferð/AuthorStandingPanel",
  component: AuthorStandingPanel,
  args: {
    authorId: userMember.id,
    authorName: userMember.name,
    summary: { reports: 0, strikes: 0, spells: 0, suspendedUntil: null },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    auth: "moderator",
    mockApi: [standingRoute(standingClean)],
    docs: {
      description: {
        component:
          "Fetches the author's full standing on mount (`/moderation/authors/:id/standing`, answered " +
          "by the Storybook fetch mock). Suspend and lift use `window.prompt`/`confirm`, which the " +
          `Yfirferð spec plans to replace with a dialog. ${focusNote}`,
      },
    },
  },
} satisfies Meta<typeof AuthorStandingPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CleanRecord: Story = {
  parameters: {
    docs: {
      description: {
        story: `${focusNote} Tab to „Fjöldi daga“ in story \`components-yfirferð-authorstandingpanel--clean-record\`.`,
      },
    },
  },
};

export const WithHistory: Story = {
  args: { summary: { reports: 4, strikes: 2, spells: 1, suspendedUntil: null } },
  parameters: { mockApi: [standingRoute(standingWithHistory)] },
};

export const Suspended: Story = {
  name: "In skammarkrók until a date",
  args: { summary: { reports: 4, strikes: 3, spells: 2, suspendedUntil: "2026-11-04T10:00:00Z" } },
  parameters: { mockApi: [standingRoute(standingSuspended)] },
};

export const SuspendedOpenEnded: Story = {
  name: "In skammarkrók, open-ended",
  args: { summary: { reports: 4, strikes: 3, spells: 2, suspendedUntil: null } },
  parameters: { mockApi: [standingRoute(standingOpenEnded)] },
};

export const Loading: Story = {
  name: "Loading (summary only)",
  args: { summary: { reports: 2, strikes: 1, spells: 0, suspendedUntil: null } },
  parameters: {
    mockApi: [{ ...standingRoute(standingClean), delay: Infinity }],
    docs: {
      description: {
        story:
          "The full history never arrives, so the panel shows the counts from the row summary.",
      },
    },
  },
};

export const FetchFails: Story = {
  args: { summary: { reports: 1, strikes: 0, spells: 0, suspendedUntil: null } },
  parameters: {
    mockApi: [
      {
        match: /\/moderation\/authors\/[^/]+\/standing/,
        status: 500,
        body: { detail: "Villa" },
      },
    ],
  },
};

export const LongName: Story = {
  args: { authorName: "Guðmundur Hrafnkell Þorvaldsson Aðalsteinsson" },
  parameters: { mockApi: [standingRoute(standingWithHistory)] },
};
