import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Permanent redirects for the old /skatathing game hub and its sub-routes.
      // These exist so that any bookmarked or shared links continue to work after
      // the hub moved to /leikir.
      { source: "/skatathing", destination: "/leikir", permanent: true },
      {
        source: "/skatathing/heidursordla",
        destination: "/leikir/heidursordla",
        permanent: true,
      },
      {
        source: "/skatathing/heidursordla/:puzzleId",
        destination: "/leikir/heidursordla/:puzzleId",
        permanent: true,
      },
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
