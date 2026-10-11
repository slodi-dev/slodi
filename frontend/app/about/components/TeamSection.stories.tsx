import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import { placeholderImage } from "@/stories/fixtures";
import TeamSection from "./TeamSection";

const CONTRIBUTORS = /^\/api\/contributors/;

const contributor = (login: string, hue: number) => ({
  login,
  avatar_url: placeholderImage(login.slice(0, 2).toUpperCase(), hue),
  html_url: `#github-${login}`,
  contributions: 10,
});

const contributors = (list: ReturnType<typeof contributor>[]): MockRoute => ({
  match: CONTRIBUTORS,
  body: { contributors: list },
});

const meta = {
  title: "Components/Um Slóða/TeamSection",
  component: TeamSection,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Project leads plus GitHub contributors, fetched from `/api/contributors` (a Next " +
          "route that proxies GitHub). Avatars here are inline placeholders.",
      },
    },
  },
} satisfies Meta<typeof TeamSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  parameters: {
    mockApi: [
      contributors([
        contributor("halldorvalberg", 142),
        contributor("signyks", 270),
        contributor("skatabot", 30),
        contributor("aronfreyr", 177),
      ]),
    ],
  },
};

export const Loading: Story = {
  parameters: { mockApi: [{ match: CONTRIBUTORS, body: {}, delay: Infinity }] },
};

/** The route answers with an `error` field, e.g. GitHub rate limiting. */
export const ErrorFromApi: Story = {
  parameters: {
    mockApi: [
      {
        match: CONTRIBUTORS,
        body: { contributors: [], error: "Gat ekki sótt upplýsingar frá GitHub" },
      },
    ],
  },
};

/** The request itself fails (not JSON). */
export const NetworkError: Story = {
  parameters: {
    // The failed request is logged by the app on purpose; nothing else may log.
    allowedConsoleErrors: [/^Error fetching contributors:/],
    mockApi: [{ match: CONTRIBUTORS, status: 502 }],
  },
};

export const NoContributors: Story = {
  parameters: { mockApi: [contributors([])] },
};

export const ManyContributors: Story = {
  parameters: {
    mockApi: [
      contributors(
        Array.from({ length: 18 }, (_, i) =>
          contributor(i === 0 ? "mjog-langt-notendanafn-a-github" : `skati-${i + 1}`, i * 20)
        )
      ),
    ],
  },
};
