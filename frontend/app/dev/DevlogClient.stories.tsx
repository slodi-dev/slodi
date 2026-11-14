import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { expect, userEvent, within } from "storybook/test";
import DevlogClient from "./DevlogClient";
import { LONG_TITLE_POST, OLDER_POSTS, POSTS, TODAY } from "./devlogFixtures";
import { tagsByUse } from "./devlogView";

const DEVLOGS = /^\/api\/devlogs/;
const ALL_POSTS = [...POSTS, ...OLDER_POSTS];

const meta = {
  title: "Components/Devlog/DevlogClient",
  component: DevlogClient,
  args: {
    initialItems: POSTS,
    total: POSTS.length,
    pageSize: POSTS.length,
    today: TODAY,
    tags: tagsByUse(POSTS),
  },
  parameters: {
    nextjs: { navigation: { pathname: "/dev" } },
    mockApi: [{ match: DEVLOGS, body: { total: ALL_POSTS.length, items: OLDER_POSTS } }],
    docs: {
      description: {
        component:
          "The /dev devlog list (Verkbók), the Magazine look from Lab/Devlog: cover cards, the " +
          "newest one wide, a drawn cover when a post has no image. The server renders the first " +
          "page; more load from `/api/devlogs` when the end of the list scrolls into view or on " +
          'the button. The tag filter is `?merki=` in the URL and filters the loaded posts. "Nýtt" ' +
          "marks posts up to 14 days older than `today`.",
      },
    },
  },
} satisfies Meta<typeof DevlogClient>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Starts loading the next page, unless the end of the list was already in view and the page
 * loaded itself (it depends on the viewport).
 */
async function startLoadingMore(canvas: ReturnType<typeof within>) {
  const button = await canvas.findByRole("button", {
    name: /Sýna eldri færslur|Sæki fleiri færslur…|Reyna aftur/,
  });
  if (button.textContent === "Sýna eldri færslur") await userEvent.click(button);
}

/** Everything fits on the first page. The newest post is "Nýtt" (ten days old). */
export const AllLoaded: Story = {};

/** More posts on the server: the count, and "Sýna eldri færslur". */
export const HasMore: Story = {
  args: { total: ALL_POSTS.length, tags: tagsByUse(ALL_POSTS) },
};

/** The next page is on its way: the button says so and waits. */
export const LoadingMore: Story = {
  args: { total: 20 },
  parameters: { mockApi: [{ match: DEVLOGS, body: {}, delay: Infinity }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await startLoadingMore(canvas);
    await expect(
      await canvas.findByRole("button", { name: "Sæki fleiri færslur…" })
    ).toBeDisabled();
  },
};

/** Loading the next page fails: the reader is told, and the button becomes "Reyna aftur". */
export const LoadMoreFails: Story = {
  args: { total: 20 },
  parameters: { mockApi: [{ match: DEVLOGS, status: 500, body: { detail: "Villa" } }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await startLoadingMore(canvas);
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Ekki tókst að sækja fleiri færslur."
    );
    await expect(canvas.getByRole("button", { name: "Reyna aftur" })).toBeEnabled();
  },
};

/** No posts yet and nothing more to load. */
export const Empty: Story = { args: { initialItems: [], total: 0, tags: [] } };

/** No initial posts but the server has some: skeleton cards in the magazine's shape. */
export const InitialSkeleton: Story = {
  args: { initialItems: [], total: 5, tags: [] },
};

/** A long title, author and tag list, first wide and then in the grid: rows stay even. */
export const LongText: Story = {
  args: {
    initialItems: [LONG_TITLE_POST, { ...LONG_TITLE_POST, slug: "langt-2" }, POSTS[0], POSTS[1]],
    total: 4,
    tags: tagsByUse([LONG_TITLE_POST, POSTS[0], POSTS[1]]),
  },
};

/**
 * Opened as `/dev?merki=útgáfa`: only the posts with that tag. Choosing another tag writes it to
 * the URL with `replace`.
 */
export const TagFilter: Story = {
  parameters: { nextjs: { navigation: { pathname: "/dev", query: { merki: "útgáfa" } } } },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step("the URL's tag is chosen", async () => {
      await expect(await canvas.findByRole("button", { name: "útgáfa" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      await expect(canvas.getAllByRole("article")).toHaveLength(2);
      await expect(canvas.getByText("2 færslur með merkimiðann „útgáfa“")).toBeVisible();
    });
    await step("choosing another tag replaces the URL", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "leikir" }));
      await expect(getRouter().replace).toHaveBeenLastCalledWith("/dev?merki=leikir", {
        scroll: false,
      });
      await expect(canvas.getAllByRole("article")).toHaveLength(1);
      await expect(canvas.getByRole("link", { name: "Leikjatorgið opnar" })).toHaveAttribute(
        "href",
        "/dev/leikir?fra=%2Fdev%3Fmerki%3Dleikir"
      );
    });
    await step("back to the URL's tag", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "útgáfa" }));
      await expect(canvas.getAllByRole("article")).toHaveLength(2);
    });
  },
};

/** At phone width the cards stack, the newest one included. */
export const Phone: Story = {
  // The visual run is desktop-only (the page is 1280 wide whatever the globals say), so a
  // baseline here would be the desktop layout again. The storybook-*-phone projects cover it.
  tags: ["skip-visual"],
  args: { total: ALL_POSTS.length },
  globals: { viewport: { value: "phone", isRotated: false } },
};
