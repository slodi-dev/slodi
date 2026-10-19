import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { CSSProperties, ReactNode } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import Header from "@/components/Header";
import HeaderLab, { type HeaderLook } from "./HeaderLab";

/**
 * Header variations for the public pages (landing, Um Slóða, Leikir). Every look carries the
 * real header's links: Heim, Um Slóða, Leikir, Github, then Stjórnborð when signed in or
 * Innskráning when not. See Lab → About the lab.
 *
 * Picked: A · Wordmark, A2 · Wordmark + logo, B · Band and B2 · Band + logo; the other
 * directions (C Trail, D Overlay, E Split) were removed on 2026-10-19.
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
      options: ["wordmark", "wordmarkLogo", "band", "bandLogo"],
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
    look: "wordmarkLogo",
    name: "A2 · Wordmark + logo",
    idea: "A with the Slóði mark before the wordmark: green on the light bar, white in dark mode.",
  },
  {
    look: "band",
    name: "B · Band",
    idea: "A full band of Slóði green with a short tagline; the brand carries the page.",
  },
  {
    look: "bandLogo",
    name: "B2 · Band + logo",
    idea: "B with the white Slóði mark; the band stays deep green in dark mode so the mark reads.",
  },
];

const MAIN_ID = "efni";

/** A plain neutral surface: no green wash under the header. */
const heroStyle: CSSProperties = {
  background: "hsl(var(--sl-color-surface-secondary))",
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

/** A stand-in for the top of the landing page, so each look is seen against content. */
function LandingTop({ header }: { header: ReactNode }) {
  return (
    <>
      {header}
      <div style={heroStyle}>
        <p style={heroText}>Skipuleggðu fundi, útilegur og dagskrárhringi á einum stað.</p>
      </div>
    </>
  );
}

/** One look as a page: header, skip link target and a little content under it. */
function Page({ look, signedIn }: { look: HeaderLook; signedIn?: boolean }) {
  return (
    <>
      <LandingTop header={<HeaderLab look={look} signedIn={signedIn} skipTo={MAIN_ID} />} />
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
        <LandingTop header={<Header />} />
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
    await expect(within(dialog).getByRole("link", { name: "Innskráning" })).toBeVisible();
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

export const WordmarkLogoSignedOut: Story = {
  name: "A2 · Wordmark + logo: signed out",
  ...signedOut("wordmarkLogo"),
};
export const WordmarkLogoSignedIn: Story = {
  name: "A2 · Wordmark + logo: signed in",
  ...signedIn("wordmarkLogo"),
};
export const WordmarkLogoPhone: Story = {
  name: "A2 · Wordmark + logo: phone",
  ...phone("wordmarkLogo"),
};

export const BandLogoSignedOut: Story = {
  name: "B2 · Band + logo: signed out",
  ...signedOut("bandLogo"),
};
export const BandLogoSignedIn: Story = {
  name: "B2 · Band + logo: signed in",
  ...signedIn("bandLogo"),
};
export const BandLogoPhone: Story = { name: "B2 · Band + logo: phone", ...phone("bandLogo") };

/** Side by side once each panel fits a full desktop bar (B's tagline needs ~60rem); stacked below. */
const themeRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 60rem), 1fr))",
};
const themePanel: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--sl-spacing-lg)",
  paddingBottom: "var(--sl-spacing-lg)",
  background: "hsl(var(--sl-color-background))",
  color: "hsl(var(--sl-color-text-primary))",
};
const LOGO_LOOKS = LOOKS.filter((l) => l.look === "wordmarkLogo" || l.look === "bandLogo");

/**
 * A2 and B2 on a light and a dark surface side by side. The story pins the theme to light and
 * the right panel carries `data-theme="dark"`, which the token file and the logo swap both
 * match, so the two panels hold whatever the toolbar says.
 */
export const LogoInLightAndDark: Story = {
  name: "Logo in light and dark",
  parameters: { auth: "anonymous" },
  globals: { theme: "light" },
  render: () => (
    <div style={themeRow}>
      {(["light", "dark"] as const).map((theme) => (
        <section
          key={theme}
          style={themePanel}
          data-theme={theme === "dark" ? "dark" : undefined}
          aria-labelledby={`hdr-theme-${theme}`}
        >
          <div style={caption}>
            <h2 id={`hdr-theme-${theme}`} style={heading}>
              {theme === "dark" ? "Dark" : "Light"}
            </h2>
          </div>
          {LOGO_LOOKS.map((l) => (
            <HeaderLab
              key={l.look}
              look={l.look}
              signedIn={false}
              navLabel={`Aðalvalmynd (${l.name}, ${theme})`}
            />
          ))}
        </section>
      ))}
    </div>
  ),
};

/** Any look, with controls. `signedIn` left unset follows the mocked Auth0 session. */
export const Playground: Story = {
  render: (args) => <Page look={args.look} signedIn={args.signedIn} />,
};
