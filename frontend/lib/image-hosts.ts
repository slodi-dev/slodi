/**
 * Which image URLs go through the Next image optimiser (`/_next/image`).
 *
 * Only our own public blob container. Uploaded content images are stored as
 * blob URLs there, so this covers every picture an author uploads. Anything
 * else (a pasted URL from another site) is rendered `unoptimized`: the browser
 * fetches it directly, exactly as before. A wider pattern would let anyone use
 * our server to fetch and resize arbitrary URLs (SSRF and bandwidth abuse).
 *
 * This mirrors `images.remotePatterns` in `next.config.ts`, which has to stay
 * a literal (the production image ships next.config.* without lib/).
 * `image-hosts.test.ts` checks that the two agree, using Next's own matcher:
 * a URL this accepts but the optimiser refuses would be a 400 and a broken
 * picture in production.
 */
const OPTIMISED_IMAGE_ORIGIN = {
  protocol: "https",
  hostname: "slodiblobstorage.blob.core.windows.net",
  pathPrefix: "/content-images/",
} as const;

/** True when `url` is on the blob container `images.remotePatterns` allows. */
export function isOptimisableImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === `${OPTIMISED_IMAGE_ORIGIN.protocol}:` &&
    parsed.hostname === OPTIMISED_IMAGE_ORIGIN.hostname &&
    parsed.port === "" &&
    parsed.username === "" &&
    parsed.password === "" &&
    parsed.search === "" &&
    parsed.pathname.startsWith(OPTIMISED_IMAGE_ORIGIN.pathPrefix)
  );
}
