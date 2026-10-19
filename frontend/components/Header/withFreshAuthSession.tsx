import type { Decorator } from "@storybook/nextjs-vite";
// `swr` comes with @auth0/nextjs-auth0, which keeps the session in it. Import the same copy so
// the cache below is the one `useUser()` reads.
import { SWRConfig } from "swr";

/**
 * Storybook decorator for stories that read the Auth0 session with `useUser()` (the Header).
 *
 * Auth0's `useUser()` keeps `/auth/profile` in SWR's global cache, and the `Auth0Provider` in
 * `.storybook/preview.tsx` only seeds a fallback for an empty cache, so a story could show the
 * session of the story before it. This gives each story its own empty cache; the fallback from
 * the provider still applies, so `parameters.auth` decides who is signed in.
 */
export const withFreshAuthSession: Decorator = (Story, context) => (
  <SWRConfig key={context.id} value={{ provider: () => new Map() }}>
    <Story />
  </SWRConfig>
);
