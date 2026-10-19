import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import { expect, fn, within } from "storybook/test";
import DevlogClient from "@/app/dev/DevlogClient";
import DevlogLab, { type DevlogLabProps, type DevlogLook } from "./DevlogLab";
import DevlogPostLab from "./DevlogPostLab";
import { POSTS, TODAY, TOTAL_WITH_MORE } from "./devlogFixtures";

/**
 * Devlog (Verkbók) variations. The current list is a grid of identical cards: no sense of
 * time, nothing marks what's new, tags that look clickable but aren't, and an English eyebrow.
 * These try other directions. See Lab → About the lab.
 */
const meta = {
  title: "Lab/Devlog",
  component: DevlogLab,
  tags: ["skip-visual"],
  args: {
    look: "slodi",
    items: POSTS,
    total: TOTAL_WITH_MORE,
    state: "idle",
    today: TODAY,
    showHeader: true,
    onLoadMore: fn(),
  },
  argTypes: {
    look: { control: "inline-radio", options: ["slodi", "breytingaskra", "forsida", "timarit"] },
    state: { control: "inline-radio", options: ["idle", "loading", "failed"] },
    items: { control: false },
  },
} satisfies Meta<typeof DevlogLab>;

export default meta;
type Story = StoryObj<typeof meta>;

const LOOKS: { look: DevlogLook; name: string; idea: string }[] = [
  {
    look: "slodi",
    name: "A · Timeline",
    idea: "A dashed trail with dates down the left, grouped by month; it suits the name.",
  },
  {
    look: "breytingaskra",
    name: "B · Changelog",
    idea: "Dense rows under year headings: date, title, one-line summary, tags.",
  },
  {
    look: "forsida",
    name: "C · Featured",
    idea: "The newest post large with summary and author, older posts in a grid.",
  },
  {
    look: "timarit",
    name: "D · Magazine",
    idea: "Cover cards, the newest one wide; a drawn trail motif when there's no image.",
  },
];

const heading = {
  margin: "0 0 var(--sl-spacing-xs)",
  font: "var(--sl-font-weight-semibold) var(--sl-text-body-sm) var(--sl-font-family-body)",
} as const;
const idea = {
  margin: "0 0 var(--sl-spacing-md)",
  color: "hsl(var(--sl-color-text-secondary))",
  fontSize: "var(--sl-text-body-sm)",
} as const;
const rule = {
  paddingTop: "var(--sl-spacing-lg)",
  borderTop: "1px solid hsl(var(--sl-color-border-subtle))",
} as const;

/** Three posts, as in DevlogClient's own stories, so every look shows the same thing. */
const FIRST_THREE = POSTS.slice(0, 3);

/** The current list, then each look, with the same three posts. */
export const Comparison: Story = {
  name: "Comparison",
  render: () => (
    <div style={{ display: "grid", gap: "var(--sl-spacing-xl)" }}>
      <section>
        <h2 style={heading}>Current</h2>
        <p style={idea}>What /dev shows today.</p>
        <DevlogClient initialItems={FIRST_THREE} total={FIRST_THREE.length} pageSize={10} />
      </section>
      {LOOKS.map((l) => (
        <section key={l.look} style={rule}>
          <h2 style={heading}>{l.name}</h2>
          <p style={idea}>{l.idea}</p>
          <DevlogLab
            look={l.look}
            items={FIRST_THREE}
            total={FIRST_THREE.length}
            today={TODAY}
            showHeader={false}
          />
        </section>
      ))}
    </div>
  ),
};

const PHONE = { viewport: { value: "phone", isRotated: false } };

/* The five stories every look gets: populated, empty, loading, load more failed, phone. */

const nameOf = (look: DevlogLook) => LOOKS.find((l) => l.look === look)!.name;

const populated = (look: DevlogLook): Story => ({ name: nameOf(look), args: { look } });
const empty = (look: DevlogLook): Story => ({
  name: `${nameOf(look)}: empty`,
  args: { look, items: [], total: 0 },
});
const loading = (look: DevlogLook): Story => ({
  name: `${nameOf(look)}: loading`,
  args: { look, items: [], total: TOTAL_WITH_MORE, state: "loading" },
});
const failed = (look: DevlogLook): Story => ({
  name: `${nameOf(look)}: load more failed`,
  args: { look, state: "failed" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "Ekki tókst að sækja fleiri færslur."
    );
    await expect(canvas.getByRole("button", { name: "Reyna aftur" })).toBeEnabled();
  },
});
const phone = (look: DevlogLook): Story => ({
  name: `${nameOf(look)}: phone`,
  args: { look },
  globals: PHONE,
});

export const Timeline = populated("slodi");
export const TimelineEmpty = empty("slodi");
export const TimelineLoading = loading("slodi");
export const TimelineFailed = failed("slodi");
export const TimelinePhone = phone("slodi");

export const Changelog = populated("breytingaskra");
export const ChangelogEmpty = empty("breytingaskra");
export const ChangelogLoading = loading("breytingaskra");
export const ChangelogFailed = failed("breytingaskra");
export const ChangelogPhone = phone("breytingaskra");

export const Featured = populated("forsida");
export const FeaturedEmpty = empty("forsida");
export const FeaturedLoading = loading("forsida");
export const FeaturedFailed = failed("forsida");
export const FeaturedPhone = phone("forsida");

export const Magazine = populated("timarit");
export const MagazineEmpty = empty("timarit");
export const MagazineLoading = loading("timarit");
export const MagazineFailed = failed("timarit");
export const MagazinePhone = phone("timarit");

/* ── Single post ─────────────────────────────────────────────────────────── */

const POST = POSTS[0];

function PostBody() {
  return (
    <>
      <p>
        Frá og með deginum í dag fer ný dagskrá ekki beint í bankann. Hún fer fyrst til
        Dagskrárstjórnarteymisins, sem les hana yfir, gefur ábendingar og samþykkir hana þegar hún
        er tilbúin.
      </p>
      <h2>Af hverju yfirferð?</h2>
      <p>
        Bankinn á að vera staður sem þú getur treyst. Þegar þú finnur ratleik fyrir Drekaskáta viltu
        vita að einhver hefur lesið öryggisleiðbeiningarnar og að aldursbilið stemmi.
      </p>
      <ul>
        <li>Þú sérð stöðuna á þinni dagskrá á yfirlitinu þínu.</li>
        <li>Ábendingar birtast við dagskrána sjálfa, ekki í tölvupósti.</li>
        <li>
          Drög eru áfram þín eigin þar til þú sendir þau í yfirferð með{" "}
          <code>Senda í yfirferð</code>.
        </li>
      </ul>
      <blockquote>
        <p>Markmiðið er ekki að stoppa hugmyndir, heldur að hjálpa þeim alla leið.</p>
      </blockquote>
      <h2>Hvað kemur næst?</h2>
      <p>
        Næst tengjum við yfirferðina við <Link href="/dev/leikir">leikjatorgið</Link>, svo leikir
        fari sömu leið og önnur dagskrá.
      </p>
    </>
  );
}

const postArgs = {
  post: POST,
  newer: null,
  older: POSTS[1],
  listHref: "/dev?merki=útgáfa",
};

/** One post: 65ch column, date and author, tags that lead to the filtered list, newer/older. */
export const Post: StoryObj<typeof DevlogPostLab> = {
  name: "Post",
  render: () => (
    <DevlogPostLab {...postArgs}>
      <PostBody />
    </DevlogPostLab>
  ),
};

/** A post in the middle of the list, with a long title, at phone width. */
export const PostPhone: StoryObj<typeof DevlogPostLab> = {
  name: "Post: phone",
  globals: PHONE,
  render: () => (
    <DevlogPostLab post={POSTS[2]} newer={POSTS[1]} older={POSTS[3]}>
      <PostBody />
    </DevlogPostLab>
  ),
};

/** The chosen look, with controls, for tweaking. */
export const Playground: Story = {
  name: "Playground",
  render: (args: DevlogLabProps) => <DevlogLab {...args} />,
};
