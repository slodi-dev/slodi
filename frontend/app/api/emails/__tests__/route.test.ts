// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAccessToken } = vi.hoisted(() => {
  process.env.API_BASE_URL = "http://backend.test";
  return { getAccessToken: vi.fn() };
});

vi.mock("@/lib/auth0", () => ({ auth0: { getAccessToken } }));

import { GET as listEmails } from "../route";
import { GET as checkToken, POST as unsubscribe } from "../unsubscribe/route";

const TOKEN = "550e8400-e29b-41d4-a716-446655440000";
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  getAccessToken.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function postJson(body: unknown) {
  return new NextRequest("https://slodi.is/api/emails/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/emails (admin email list)", () => {
  it("forwards the session's bearer token to the backend", async () => {
    getAccessToken.mockResolvedValue({ token: "admin-token" });
    fetchMock.mockResolvedValue(Response.json([{ email: "a@example.com" }]));

    const res = await listEmails();

    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://backend.test/emaillist");
    expect(init.headers.Authorization).toBe("Bearer admin-token");
  });

  it("returns 401 without calling the backend when there is no session", async () => {
    getAccessToken.mockRejectedValue(new Error("no session"));

    const res = await listEmails();

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("/api/emails/unsubscribe", () => {
  it("GET only checks the token with the backend", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const res = await checkToken(
      new NextRequest(`https://slodi.is/api/emails/unsubscribe?token=${TOKEN}`)
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(`http://backend.test/emaillist/unsubscribe/${TOKEN}`, {
      method: "GET",
    });
  });

  it("GET reports an unknown token as 404", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    const res = await checkToken(
      new NextRequest(`https://slodi.is/api/emails/unsubscribe?token=${TOKEN}`)
    );

    expect(res.status).toBe(404);
  });

  it("GET rejects a malformed token without calling the backend", async () => {
    const res = await checkToken(
      new NextRequest("https://slodi.is/api/emails/unsubscribe?token=../../users")
    );

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST unsubscribes with the token", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const res = await unsubscribe(postJson({ token: TOKEN }));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(`http://backend.test/emaillist/unsubscribe/${TOKEN}`, {
      method: "POST",
    });
  });

  it("POST no longer unsubscribes by email address", async () => {
    const res = await unsubscribe(postJson({ email: "someone@example.com" }));

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST passes through a spent token as 404", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    const res = await unsubscribe(postJson({ token: TOKEN }));

    expect(res.status).toBe(404);
  });
});
