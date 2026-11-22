import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { DevlogMeta } from "@/lib/devlogs";
import DevlogClient from "./DevlogClient";

const DEVLOGS = /^\/api\/devlogs/;

const posts: DevlogMeta[] = [
  {
    slug: "yfirferd-komin",
    title: "Yfirferð er komin í loftið",
    date: "2026-10-02",
    author: "Halldór Valberg",
    tags: ["yfirferð", "útgáfa"],
    summary: "Dagskrárstjórnarteymið getur nú farið yfir nýjar hugmyndir í bankanum.",
  },
  {
    slug: "leikir",
    title: "Leikjatorgið opnar",
    date: "2026-09-14",
    author: "Signý Kristín",
    tags: ["leikir"],
    summary: "Heiðursorðla, Hörpuhopp, Arnór-Clicker og Laddí-bird á einum stað.",
  },
  {
    slug: "dokkt-thema",
    title: "Dökkt þema og sveitarlitir",
    date: "2026-08-30",
    summary: "Veldu þema og lit þinnar sveitar í stillingum.",
  },
];

const more: DevlogMeta[] = [
  {
    slug: "fyrsta-faersla",
    title: "Fyrsta færslan: af hverju Slóði?",
    date: "2026-01-10",
    author: "Halldór Valberg",
    tags: ["saga"],
    summary: "Gamli dagskrárvefurinn var kominn til ára sinna.",
  },
];

const meta = {
  title: "Components/Devlog/DevlogClient",
  component: DevlogClient,
  args: { initialItems: posts, total: posts.length, pageSize: 3 },
  parameters: {
    mockApi: [{ match: DEVLOGS, body: { total: posts.length + more.length, items: more } }],
    docs: {
      description: {
        component:
          "The /dev devlog list. The server renders the first page; more load from " +
          "`/api/devlogs` when the sentinel scrolls into view or on the button.",
      },
    },
  },
} satisfies Meta<typeof DevlogClient>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Everything fits on the first page. */
export const AllLoaded: Story = {};

/** More posts on the server: infinite scroll plus a "Hlaða inn meira" button. */
export const HasMore: Story = { args: { total: posts.length + more.length } };

export const LoadingMore: Story = {
  args: { total: 20 },
  parameters: { mockApi: [{ match: DEVLOGS, body: {}, delay: Infinity }] },
};

/** No posts yet and nothing more to load. */
export const Empty: Story = { args: { initialItems: [], total: 0 } };

/** No initial posts but the server has some: skeleton cards. */
export const InitialSkeleton: Story = { args: { initialItems: [], total: 5 } };

export const LongText: Story = {
  args: {
    initialItems: [
      {
        slug: "langt",
        title:
          "Mjög langur titill á þróunarfærslu sem lýsir öllum breytingunum á dagskrárbankanum, síunum og yfirferðinni í einu",
        date: "2026-10-10",
        author: "Guðmundur Hrafnkell Þorvaldsson Kjerúlf",
        tags: ["dagskrárbanki", "síur", "yfirferð", "aðgengi", "afköst", "hönnunarkerfi"],
        summary:
          "Þessi samantekt er viljandi löng til að sjá hvernig kortið brotnar þegar textinn nær yfir margar línur og fer langt út fyrir það sem venjuleg færsla myndi innihalda.",
      },
    ],
    total: 1,
  },
};
