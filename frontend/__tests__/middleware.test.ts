// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/lib/auth0", () => ({
  auth0: {
    middleware: vi.fn(async () => NextResponse.next()),
    getSession,
  },
}));

import { middleware } from "@/middleware";

const ORIGIN = "https://slodi.is";

async function statusFor(pathAndQuery: string) {
  const response = await middleware(new NextRequest(new URL(pathAndQuery, ORIGIN)));
  return { status: response.status, location: response.headers.get("location") };
}

describe("middleware, signed out", () => {
  beforeEach(() => getSession.mockResolvedValue(null));

  // The deliverable of sc-518: what an anonymous visitor gets, route by route.
  it.each([
    ["/", 200],
    ["/about", 200],
    ["/unsubscribe?token=abc", 200],
    ["/api/emails/unsubscribe", 200],
    ["/leikir", 200],
    ["/leikir/heidursordla", 200],
    ["/api/leikir/arnor-clicker/scores", 200],
    ["/auth/login", 200],
    ["/does-not-exist", 200], // falls through to the 404 page
    ["/admin", 307],
    ["/yfirferd", 307],
    ["/programs", 307],
    ["/dashboard", 307],
    ["/profile", 307],
    ["/social", 307],
    ["/tags", 307],
    ["/badges", 307],
    ["/analytics", 307],
    ["/builder", 307],
    ["/palette", 307],
    ["/dev", 307],
    ["/settings", 307],
    ["/api/emails", 401],
    ["/api/config", 401],
    ["/api/devlogs", 401],
  ])("%s → %i", async (route, expected) => {
    expect((await statusFor(route)).status).toBe(expected);
  });

  it("sends a private page to login and back again", async () => {
    const { location } = await statusFor("/programs/abc?tab=comments");
    const login = new URL(location!);
    expect(login.pathname).toBe("/auth/login");
    expect(login.searchParams.get("returnTo")).toBe("/programs/abc?tab=comments");
  });
});

describe("middleware, signed in", () => {
  beforeEach(() => getSession.mockResolvedValue({ user: { sub: "auth0|1" } }));

  it.each(["/admin", "/programs", "/api/emails"])("%s passes", async (route) => {
    expect((await statusFor(route)).status).toBe(200);
  });
});
