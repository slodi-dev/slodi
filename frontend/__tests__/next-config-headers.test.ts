import { describe, expect, it } from "vitest";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import config from "../next.config";

describe("next.config headers", () => {
  it("denies every Local Network Access feature on every route", async () => {
    const rules = (await config(PHASE_DEVELOPMENT_SERVER).headers?.()) ?? [];
    const all = rules.find((r) => r.source === "/:path*");
    const policy = all?.headers.find((h) => h.key === "Permissions-Policy")?.value ?? "";
    const features = policy.split(",").map((f) => f.trim());
    expect(features).toEqual(
      expect.arrayContaining(["local-network=()", "loopback-network=()", "local-network-access=()"])
    );
  });
});
