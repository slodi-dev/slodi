import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import QueryProvider from "@/components/QueryProvider";
import { MOCK_SEASON_ID, mockGrid, mockSeasons } from "@/lib/mock/plan.mock";
import { mockModeIs } from "@/stories/vinnubekkur/benchHarness";
import { workspace } from "@/stories/fixtures";
import PlanShell from "./PlanShell";

/**
 * Seasons as a real backend would send them: the fixture data under ids the
 * mock layer does not recognise, so the shell takes the real-API path.
 */
const realSeasons = mockSeasons().map((season, i) => ({
  ...season,
  id: `season-${i + 1}`,
  workspace_id: workspace.id,
  name: i === 0 ? "Starfsárið 2026–27" : "Krot fyrir vorið",
}));
const realGrid = { ...mockGrid(MOCK_SEASON_ID), season_id: "season-1" };

const seasonsRoute = /\/workspaces\/[^/]+\/seasons/;
const gridRoute = /\/seasons\/[^/]+\/grid/;

const realApi: MockRoute[] = [
  { match: seasonsRoute, body: realSeasons },
  { match: gridRoute, body: realGrid },
];

const meta: Meta<typeof PlanShell> = {
  title: "Components/Vinnubekkur/PlanShell",
  component: PlanShell,
  // TanStack Query is not in the app layout yet (nothing user-visible ships
  // from this branch), so the stories provide it.
  decorators: [
    (Story) => (
      <QueryProvider>
        <Story />
      </QueryProvider>
    ),
  ],
  beforeEach: () => mockModeIs("off"),
  parameters: {
    layout: "fullscreen",
    mockApi: realApi,
    docs: {
      story: { inline: false, height: "800px" },
      description: {
        component:
          "Vinnubekkurinn: the plan route's frame — masthead with the three views (Bekkurinn, " +
          "Rist, Dagatal) and the season switcher, the dagskrárbankinn rail, and one scrolling " +
          "canvas. Mounted by no route yet. Spec: `docs/design/vinnubekkurinn/SPEC.md` on " +
          "`origin/release/vinnubekkur-v1`.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PlanShell>;

/** Fixtures forced on (`?mock=1`): the bench, the bank and the banner. */
export const Default: Story = {
  beforeEach: () => mockModeIs("on"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("GERVIGÖGN")).toBeInTheDocument();
    await expect(await canvas.findByRole("button", { name: "Bekkurinn" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  },
};

/**
 * Against the API as it is today: seasons and the grid answer, the bench has
 * no endpoint. The shell opens on the Rist, and Bekkurinn is absent.
 */
export const RealApi: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("table")).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Bekkurinn" })).toBeNull();
    await expect(canvas.queryByText("GERVIGÖGN")).toBeNull();
  },
};

export const Calendar: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Dagatal" }));
    await expect(await canvas.findByRole("button", { name: "Næsti mánuður" })).toBeVisible();
  },
};

export const Loading: Story = {
  parameters: { mockApi: [{ match: seasonsRoute, delay: Infinity }] satisfies MockRoute[] },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("Sæki starfsár…")).toBeVisible();
  },
};

/** The seasons request fails with mock mode off: an error, not fixtures. */
export const LoadError: Story = {
  parameters: {
    allowedConsoleErrors: [/^\[API 500\]/],
    mockApi: [
      { match: seasonsRoute, status: 500, body: { detail: "Villa" } },
    ] satisfies MockRoute[],
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/Náði ekki í starfsárin/, {}, { timeout: 5000 })
    ).toBeVisible();
  },
};

/** The seasons request fails in auto mode: fixtures stand in, and the banner says why. */
export const Fallback: Story = {
  beforeEach: () => mockModeIs("auto"),
  parameters: {
    allowedConsoleErrors: [/^\[API 500\]/],
    mockApi: [
      { match: seasonsRoute, status: 500, body: { detail: "Villa" } },
    ] satisfies MockRoute[],
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => expect(within(canvasElement).getByText(/Bakendinn svarar ekki/)).toBeVisible(),
      { timeout: 5000 }
    );
  },
};

export const Empty: Story = {
  parameters: { mockApi: [{ match: seasonsRoute, body: [] }] satisfies MockRoute[] },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("Ekkert starfsár enn")).toBeVisible();
  },
};

/** Seasons answer but the grid does not. */
export const GridError: Story = {
  parameters: {
    allowedConsoleErrors: [/^\[API 500\]/],
    mockApi: [
      { match: seasonsRoute, body: realSeasons },
      { match: gridRoute, status: 500, body: { detail: "Villa" } },
    ] satisfies MockRoute[],
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/Náði ekki í dagskrána fyrir/, {}, { timeout: 5000 })
    ).toBeVisible();
  },
};
