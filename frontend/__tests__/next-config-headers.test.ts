// @vitest-environment node
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { describe, expect, it } from "vitest";
import config from "../next.config";

describe("next.config headers", () => {
  it("denies local network access on every route", async () => {
    const rules = (await config(PHASE_DEVELOPMENT_SERVER).headers?.()) ?? [];
    const all = rules.find((r) => r.source === "/:path*");
    const policy = all?.headers.find((h) => h.key === "Permissions-Policy")?.value ?? "";
    expect(policy.split(",").map((f) => f.trim())).toEqual(
      expect.arrayContaining(["local-network=()", "loopback-network=()", "local-network-access=()"])
    );
  });
});
