import type { NextConfig } from "next";

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

export default nextConfig;
