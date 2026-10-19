import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { CSSProperties, ReactNode } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import Header from "@/components/Header";
import HeaderLab, { type HeaderLook } from "./HeaderLab";

/**
 * Header variations for the public pages (landing, Um Slóða, Leikir). Every look carries the
 * real header's links: Heim, Um Slóða, Leikir, Github, then Stjórnborð when signed in or
 * Innskráning when not. See Lab → Um tilraunastofuna.
 */
const meta = {
  title: "Lab/Header",
  component: HeaderLab,
  tags: ["skip-visual"],
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/" } },
  },
  args: { look: "wordmark" },
  argTypes: {
    look: {
      control: "inline-radio",
      options: ["wordmark", "band", "trail", "overlay", "split"],
    },
    signedIn: { control: "boolean" },
    skipTo: { control: false },
    navLabel: { control: false },
  },
} satisfies Meta<typeof HeaderLab>;

export default meta;
type Story = StoryObj<typeof meta>;

const LOOKS: { look: HeaderLook; name: string; idea: string }[] = [
  {
    look: "wordmark",
    name: "A · Wordmark",
    idea: "A quiet bar: a large wordmark, grey links, the current page underlined in green.",
  },
  {
    look: "band",
    name: "B · Band",
    idea: "A full band of Slóði green with a short tagline; the brand carries the page.",
  },
  {
    look: "trail",
    name: "C · Trail",
    idea: "A signpost wordmark with two peaks and a dashed trail over contour lines.",
  },
  {
    look: "overlay",
    name: "D · Overlay",
    idea: "No bar at all: the header floats over the landing hero, the action is a raised chip.",
  },
  {
    look: "split",
    name: "E · Split",
    idea: "Pages on the left, the account action as a solid green button on the right.",
  },
];

const MAIN_ID = "efni";

const heroStyle: CSSProperties = {
  background:
    "linear-gradient(180deg, hsl(var(--sl-color-primary-subtle)), hsl(var(--sl-color-background)))",
};
const heroText: CSSProperties = {
  margin: 0,
  padding: "var(--sl-spacing-xl) var(--sl-spacing-md)",
  maxWidth: "var(--sl-content-max-width)",
  marginInline: "auto",
  fontFamily: "var(--sl-font-family-heading)",
  fontWeight: "var(--sl-font-weight-heading)",
  fontSize: "var(--sl-text-heading-3)",
  lineHeight: "var(--sl-line-height-heading)",
  color: "hsl(var(--sl-color-text-primary))",
};
const bodyText: CSSProperties = {
  margin: 0,
  padding: "var(--sl-spacing-lg) var(--sl-spacing-md)",
  maxWidth: "var(--sl-content-max-width)",
  marginInline: "auto",
  color: "hsl(var(--sl-color-text-secondary))",
};

/**
 * A stand-in for the top of the landing page, so each look is seen against content. The
 * overlay look sits inside the hero, the others above it.
 */
function LandingTop({ look, header }: { look: HeaderLook | "current"; header: ReactNode }) {
  const hero = <p style={heroText}>Meira en bara dagskrárvefur</p>;
  if (look === "overlay") {
    return (
      <div style={heroStyle}>
        {header}
        {hero}
      </div>
    );
  }
  return (
    <>
      {header}
      <div style={heroStyle}>{hero}</div>
    </>
  );
}

/** One look as a page: header, skip link target and a little content under it. */
function Page({ look, signedIn }: { look: HeaderLook; signedIn?: boolean }) {
  return (
    <>
      <LandingTop
        look={look}
        header={<HeaderLab look={look} signedIn={signedIn} skipTo={MAIN_ID} />}
      />
      <main id={MAIN_ID}>
        <p style={bodyText}>
          Safnaðu saman dagskrárhugmyndum, settu saman skipulagða dagskrá og greindu fjölbreytni.
        </p>
      </main>
    </>
  );
}

const section: CSSProperties = { borderBottom: "1px solid hsl(var(--sl-color-border))" };
const caption: CSSProperties = {
  padding: "var(--sl-spacing-md) var(--sl-spacing-md) var(--sl-spacing-sm)",
  fontFamily: "var(--sl-font-family-body)",
};
const heading: CSSProperties = {
  margin: "0 0 var(--sl-spacing-xs)",
  fontSize: "var(--sl-text-body)",
  fontWeight: "var(--sl-font-weight-semibold)",
};
const idea: CSSProperties = {
  margin: 0,
  fontSize: "var(--sl-text-body-sm)",
  color: "hsl(var(--sl-color-text-secondary))",
};

/** The current header, then every look, signed out on the landing page. */
export const Comparison: Story = {
  parameters: { auth: "anonymous" },
  render: () => (
    <div>
      {/* The current header reads Auth0 only, so it can show the previous story's session. */}
      <section style={section} aria-labelledby="hdr-current">
        <div style={caption}>
          <h2 id="hdr-current" style={heading}>
            Current
          </h2>
          <p style={idea}>What the public pages use today.</p>
        </div>
        <LandingTop look="current" header={<Header />} />
      </section>
      {LOOKS.map((l) => (
        <section key={l.look} style={section} aria-labelledby={`hdr-${l.look}`}>
          <div style={caption}>
            <h2 id={`hdr-${l.look}`} style={heading}>
              {l.name}
            </h2>
            <p style={idea}>{l.idea}</p>
          </div>
          <LandingTop
            look={l.look}
            header={
              <HeaderLab look={l.look} signedIn={false} navLabel={`Aðalvalmynd (${l.name})`} />
            }
          />
        </section>
      ))}
    </div>
  ),
};

const PHONE = { viewport: { value: "phone", isRotated: false } };

/**
 * Signed-out desktop page for one look. The Auth0 mock is set through `parameters.auth`, as in
 * the Header story, and the state is also passed as `signedIn`: Auth0's `useUser` caches the
 * session in SWR across stories, so the mock alone sometimes shows the previous story's state.
 */
const signedOut = (look: HeaderLook): Story => ({
  args: { look, signedIn: false },
  parameters: { auth: "anonymous" },
  render: () => <Page look={look} signedIn={false} />,
});
const signedIn = (look: HeaderLook): Story => ({
  args: { look, signedIn: true },
  parameters: { auth: "member" },
  render: () => <Page look={look} signedIn />,
});

/**
 * Phone bar for one look. The play opens the menu, checks focus moved into it, closes it with
 * Escape and checks focus came back, so the story ends showing the closed bar.
 */
const phone = (look: HeaderLook): Story => ({
  args: { look, signedIn: false },
  parameters: { auth: "anonymous" },
  globals: PHONE,
  render: () => <Page look={look} signedIn={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole("button", { name: "Valmynd" });
    await userEvent.click(toggle);
    const dialog = await canvas.findByRole("dialog", { name: "Valmynd" });
    const close = within(dialog).getByRole("button", { name: "Loka valmynd" });
    await waitFor(() => expect(close).toHaveFocus());
    const login = look === "split" ? "Skrá inn" : "Innskráning";
    await expect(within(dialog).getByRole("link", { name: login })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(toggle).toHaveFocus());
  },
});

export const WordmarkSignedOut: Story = {
  name: "A · Wordmark: signed out",
  ...signedOut("wordmark"),
};
export const WordmarkSignedIn: Story = {
  name: "A · Wordmark: signed in",
  ...signedIn("wordmark"),
};
export const WordmarkPhone: Story = { name: "A · Wordmark: phone", ...phone("wordmark") };

export const BandSignedOut: Story = { name: "B · Band: signed out", ...signedOut("band") };
export const BandSignedIn: Story = { name: "B · Band: signed in", ...signedIn("band") };
export const BandPhone: Story = { name: "B · Band: phone", ...phone("band") };

export const TrailSignedOut: Story = { name: "C · Trail: signed out", ...signedOut("trail") };
export const TrailSignedIn: Story = { name: "C · Trail: signed in", ...signedIn("trail") };
export const TrailPhone: Story = { name: "C · Trail: phone", ...phone("trail") };

export const OverlaySignedOut: Story = {
  name: "D · Overlay: signed out",
  ...signedOut("overlay"),
};
export const OverlaySignedIn: Story = { name: "D · Overlay: signed in", ...signedIn("overlay") };
export const OverlayPhone: Story = { name: "D · Overlay: phone", ...phone("overlay") };

export const SplitSignedOut: Story = { name: "E · Split: signed out", ...signedOut("split") };
export const SplitSignedIn: Story = { name: "E · Split: signed in", ...signedIn("split") };
export const SplitPhone: Story = { name: "E · Split: phone", ...phone("split") };

/** Any look, with controls. `signedIn` left unset follows the mocked Auth0 session. */
export const Playground: Story = {
  render: (args) => <Page look={args.look} signedIn={args.signedIn} />,
};
