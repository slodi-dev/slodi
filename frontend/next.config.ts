import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

/**
 * Never let a page ask the visitor for local network access.
 *
 * Chrome 142+ prompts "wants to look for and connect to any device on your
 * local network" the moment a public page requests anything on localhost or a
 * private address (Local Network Access). Slóði never needs that, so the
 * features are switched off for the document and every frame in it: with the
 * feature disallowed, Chrome fails such a request as a network error *before*
 * it would show the prompt (LNA spec §3.1.1, "If document is not allowed to
 * use permissionName, then return error").
 *
 * - `local-network`: private addresses (10/8, 172.16/12, 192.168/16, …).
 * - `loopback-network`: 127/8 and ::1.
 * - `local-network-access`: the original single feature both replaced; Chrome
 *   still accepts it as an alias, so it is denied too.
 *
 * Names as defined in https://wicg.github.io/local-network-access/ §2.6 and in
 * Chromium's services/network/public/cpp/permissions_policy/permissions_policy_features.json5.
 */
const PERMISSIONS_POLICY = ["local-network=()", "loopback-network=()", "local-network-access=()"];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Permissions-Policy", value: PERMISSIONS_POLICY.join(", ") }],
      },
    ];
  },
  async redirects() {
    return [
      // The old /skatathing game hub moved to /leikir; keep bookmarks working.
      // Its Heiðursorðla sub-routes are gone with the game (hidden, a 404).
      { source: "/skatathing", destination: "/leikir", permanent: true },
    ];
  },
  images: {
    // Only the public blob container. Content images are uploaded straight to
    // Azure and stored as blob URLs, so nothing else needs optimizing — and a
    // wildcard here would expose the Next.js image endpoint to SSRF and
    // bandwidth abuse.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "slodiblobstorage.blob.core.windows.net",
        pathname: "/content-images/**",
      },
    ],
    // Limit cached variants to common screen widths — reduces cache storage per image.
    deviceSizes: [640, 828, 1080, 1200],
    // Cache optimized images for 1 hour. Keeps re-fetch load low without
    // letting abuse-driven cache entries accumulate indefinitely.
    minimumCacheTTL: 3600,
  },
};

// NEXT_PUBLIC_API_URL is baked into the client bundle by `next build`. If it
// is missing the browser has no API to talk to, and older code silently fell
// back to http://localhost:8000 — which on a public site makes Chrome prompt
// visitors for local-network access. Fail the build instead.
export default function config(phase: string): NextConfig {
  // `storybook build` loads this config with the same phase but never talks to
  // the API, so it is exempt (Storybook sets STORYBOOK=true).
  const isStorybook = process.env.STORYBOOK === "true";
  if (phase === PHASE_PRODUCTION_BUILD && !isStorybook && !process.env.NEXT_PUBLIC_API_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_URL must be set for `next build` (it is inlined into the client bundle). " +
        "Production: https://api.slodi.is. Local builds: http://localhost:8000."
    );
  }
  return nextConfig;
}
