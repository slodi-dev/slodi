import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const nextConfig: NextConfig = {
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
    // bandwidth abuse. Components ask `isOptimisableImageUrl`
    // (lib/image-hosts.ts) whether a URL may go through the optimiser; foreign
    // URLs stay `unoptimized` and load straight from their host.
    //
    // Keep this a literal: the production Docker stage copies only
    // next.config.* (no lib/), so an import here crashes `next start`.
    // lib/image-hosts.test.ts holds the two in step.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "slodiblobstorage.blob.core.windows.net",
        port: "",
        pathname: "/content-images/**",
        search: "",
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
