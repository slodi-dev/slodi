import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { mdToHtmlLite } from "@/lib/markdown-lite";
import { LONG_TITLE_POST, POSTS, POST_MARKDOWN } from "../devlogFixtures";
import DevlogPost from "./DevlogPost";

const meta = {
  title: "Components/Devlog/DevlogPost",
  component: DevlogPost,
  args: { post: POSTS[0], html: mdToHtmlLite(POST_MARKDOWN), newer: null, older: POSTS[1] },
  parameters: {
    nextjs: { navigation: { pathname: "/dev/yfirferd-komin" } },
    docs: {
      description: {
        component:
          "One devlog post (/dev/[slug]): a 65ch reading column, date and author above the " +
          "title, tags that open the filtered list, and the newer and older posts. " +
          '"Aftur í Verkbók" returns to the list URL in `?fra=`, else a same-site referrer, ' +
          "else /dev.",
      },
    },
  },
} satisfies Meta<typeof DevlogPost>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The newest post: only an older neighbour. Opened from the list, so "back" is plain /dev. */
export const Newest: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Aftur í Verkbók" })).toHaveAttribute(
      "href",
      "/dev"
    );
    await expect(canvas.getByRole("link", { name: "útgáfa" })).toHaveAttribute(
      "href",
      "/dev?merki=%C3%BAtg%C3%A1fa"
    );
  },
};

/** Opened from `/dev?merki=útgáfa`: "back" returns there, and the neighbours carry it along. */
export const FromFilteredList: Story = {
  parameters: {
    nextjs: {
      navigation: { pathname: "/dev/yfirferd-komin", query: { fra: "/dev?merki=útgáfa" } },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("link", { name: "Aftur í Verkbók" })).toHaveAttribute(
      "href",
      "/dev?merki=útgáfa"
    );
    await expect(canvas.getByRole("link", { name: /Eldri færsla/ })).toHaveAttribute(
      "href",
      `/dev/leikir?fra=${encodeURIComponent("/dev?merki=útgáfa")}`
    );
  },
};

/** A post in the middle of the list, with a long title, at phone width. */
export const Phone: Story = {
  // The visual run is desktop-only (the page is 1280 wide whatever the globals say), so a
  // baseline here would be the desktop layout again. The storybook-*-phone projects cover it.
  tags: ["skip-visual"],
  args: { post: LONG_TITLE_POST, newer: POSTS[1], older: POSTS[3] },
  globals: { viewport: { value: "phone", isRotated: false } },
};
