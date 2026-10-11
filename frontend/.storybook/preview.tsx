import type { Decorator, Preview } from "@storybook/nextjs-vite";
import { sb } from "storybook/test";
import { Auth0Provider } from "@auth0/nextjs-auth0";

// Same stylesheets, in the same order, as app/layout.tsx.
import "../app/globals.css";
import "../app/slodi-tokens.css";
import "../app/slodi-utilities.css";

// Fonts: the app loads no web font. `--sl-font-family-body` names "Roboto
// Condensed" and falls back to the native UI stack, and app/layout.tsx uses no
// next/font, so Storybook deliberately loads nothing either — what you see here
// is what a user without Roboto Condensed installed sees in the app.

import ThemeProvider from "../components/ThemeProvider";
import { LikesProvider } from "../contexts/LikesContext";
import { FavoritesProvider } from "../contexts/FavoritesContext";
import { AuthProvider } from "../contexts/AuthContext";
import {
  installMockFetch,
  setMockAuthMode,
  setStoryRoutes,
  currentMockUser,
  type AuthMode,
  type MockRoute,
} from "./mocks/fetch";

// `useAuth()` everywhere resolves to contexts/__mocks__/AuthContext.tsx.
sb.mock("../contexts/AuthContext.tsx");

installMockFetch();

const THEMES = ["light", "dark", "forest-night", "campfire", "northern-lights"] as const;
const PATROLS = ["drekar", "falkar", "drott", "rekkar", "rover", "adrir"] as const;

/**
 * Theme and patrol colour go through the real ThemeProvider: the toolbar writes
 * the same localStorage keys the app reads, and ThemeProvider then sets
 * `class="dark"` / `data-theme` / the patrol custom properties on <html>
 * exactly as it does in the app.
 */
const withAppProviders: Decorator = (Story, context) => {
  const theme = (context.globals.theme as string) ?? "light";
  const patrol = (context.globals.patrol as string) ?? "none";
  const auth = (context.parameters.auth as AuthMode | undefined) ?? "member";
  const routes = context.parameters.mockApi as MockRoute[] | undefined;

  setMockAuthMode(auth);
  setStoryRoutes(routes);

  try {
    window.localStorage.setItem("slodi-theme", theme);
    if (patrol === "none") window.localStorage.removeItem("slodi-patrol");
    else window.localStorage.setItem("slodi-patrol", patrol);
  } catch {
    // Storage blocked: ThemeProvider falls back to the OS preference.
  }

  // The app's <body> carries these classes (app/layout.tsx).
  document.body.classList.add("sl-bg-background", "sl-text-primary", "antialiased");

  const user = currentMockUser();
  const fullscreen = context.parameters.layout === "fullscreen";

  return (
    <Auth0Provider
      user={user ? { sub: user.auth0_id, name: user.name, email: user.email } : undefined}
    >
      <AuthProvider>
        <ThemeProvider key={`${theme}:${patrol}`}>
          <LikesProvider key={auth}>
            <FavoritesProvider>
              <div
                className="sl-bg-background sl-text-primary"
                style={{ padding: fullscreen ? 0 : "1rem", minHeight: fullscreen ? "100%" : 0 }}
              >
                <Story />
              </div>
            </FavoritesProvider>
          </LikesProvider>
        </ThemeProvider>
      </AuthProvider>
    </Auth0Provider>
  );
};

const preview: Preview = {
  tags: ["autodocs"],
  decorators: [withAppProviders],
  globalTypes: {
    theme: {
      description: "Theme — set exactly as ThemeProvider sets it",
      toolbar: {
        title: "Þema",
        icon: "mirror",
        items: THEMES.map((value) => ({ value, title: value })),
        dynamicTitle: true,
      },
    },
    patrol: {
      description: "Patrol colour — overrides --sl-color-primary like ThemeProvider",
      toolbar: {
        title: "Sveit",
        icon: "paintbrush",
        items: [
          { value: "none", title: "Enginn sveitarlitur" },
          ...PATROLS.map((value) => ({ value, title: value })),
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "light",
    patrol: "none",
  },
  parameters: {
    layout: "padded",
    nextjs: {
      appDirectory: true,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // Report violations in the a11y panel without failing anything yet.
      // Groups that are clean opt in with `a11y: { test: "error" }` in their meta.
      test: "todo",
    },
    viewport: {
      // The two widths every story is tested at (vitest.config.ts): a common
      // phone and a laptop. Also in the toolbar.
      options: {
        phone: {
          name: "Phone (390)",
          styles: { width: "390px", height: "844px" },
          type: "mobile",
        },
        desktop: {
          name: "Desktop (1280)",
          styles: { width: "1280px", height: "800px" },
          type: "desktop",
        },
      },
    },
    options: {
      storySort: {
        order: ["Design system", ["Introduction", "Tokens", "Primitives"], "Components"],
      },
    },
  },
};

export default preview;
