import { describe, expect, it } from "vitest";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { hasRemoteMatch } from "next/dist/shared/lib/match-remote-pattern";

import config from "../next.config";
import { isOptimisableImageUrl } from "./image-hosts";

const BLOB = "https://slodiblobstorage.blob.core.windows.net/content-images/images/a.jpg";

describe("isOptimisableImageUrl", () => {
  it("accepts an upload in the public content-images container", () => {
    expect(isOptimisableImageUrl(BLOB)).toBe(true);
  });

  const REFUSED: [string, string | null | undefined][] = [
    ["empty", ""],
    ["null", null],
    ["undefined", undefined],
    ["relative", "/content-images/a.jpg"],
    ["not a URL", "mynd.jpg"],
    ["http, not https", BLOB.replace("https:", "http:")],
    ["another container", "https://slodiblobstorage.blob.core.windows.net/documents/a.pdf"],
    [
      "a lookalike host",
      "https://slodiblobstorage.blob.core.windows.net.evil.example/content-images/a.jpg",
    ],
    ["another storage account", "https://other.blob.core.windows.net/content-images/a.jpg"],
    [
      "an explicit port",
      "https://slodiblobstorage.blob.core.windows.net:8443/content-images/a.jpg",
    ],
    ["credentials", "https://u:p@slodiblobstorage.blob.core.windows.net/content-images/a.jpg"],
    ["a query string (SAS)", `${BLOB}?sv=2024&sig=abc`],
    ["a foreign host", "https://example.com/a.jpg"],
    ["a private address", "http://192.168.1.10/content-images/a.jpg"],
    ["a data URL", "data:image/png;base64,AAAA"],
  ];

  it.each(REFUSED)("refuses %s", (_label, url) => {
    expect(isOptimisableImageUrl(url)).toBe(false);
  });

  // If the helper said yes where /_next/image says no, the picture would be a
  // 400 in production. Ask Next's own matcher about every case. The helper may
  // be stricter (it also refuses credentials in the URL): such a picture is
  // then fetched by the browser directly, as before.
  it.each([["the blob upload", BLOB], ...REFUSED])(
    "accepts nothing Next's remotePatterns matcher refuses: %s",
    (_label, url) => {
      const patterns = config(PHASE_DEVELOPMENT_SERVER).images?.remotePatterns ?? [];
      let nextAllows = false;
      try {
        nextAllows = hasRemoteMatch([], patterns, new URL(url ?? ""));
      } catch {
        nextAllows = false; // not an absolute URL, so Next would not fetch it remotely
      }
      if (isOptimisableImageUrl(url)) expect(nextAllows).toBe(true);
    }
  );
});

describe("next.config images", () => {
  it("allows exactly the host the helper accepts", () => {
    const patterns = config(PHASE_DEVELOPMENT_SERVER).images?.remotePatterns ?? [];
    expect(patterns).toEqual([
      {
        protocol: "https",
        hostname: "slodiblobstorage.blob.core.windows.net",
        port: "",
        pathname: "/content-images/**",
        search: "",
      },
    ]);
  });
});
