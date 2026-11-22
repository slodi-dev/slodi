import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { deleteBankContent, deleteProgram } from "../programs.service";

const getToken = async () => "fake-token";

function captureFetch() {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
}

describe("deleting a bank item", () => {
  let fetchSpy: ReturnType<typeof captureFetch>;

  beforeEach(() => {
    fetchSpy = captureFetch();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function lastCall() {
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    return { url: String(url), init };
  }

  it.each([
    ["task", "tasks"],
    ["event", "events"],
    ["program", "programs"],
  ] as const)("deletes a %s through /%s", async (type, segment) => {
    // The bug this replaces: every delete went to /programs/{id}, which only
    // matches rows whose content_type is "program", so a Verkefni or
    // Viðburður 404'd.
    await deleteBankContent(type, "c-1", getToken);

    const { url, init } = lastCall();
    expect(url).toMatch(new RegExp(`/${segment}/c-1$`));
    expect(init.method).toBe("DELETE");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer fake-token");
  });

  it("keeps deleteProgram working for Dagskrá callers", async () => {
    await deleteProgram("p-1", getToken);
    expect(lastCall().url).toMatch(/\/programs\/p-1$/);
  });

  it("rejects when the API refuses, so the caller can show it", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Task not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    );
    await expect(deleteBankContent("task", "c-1", getToken)).rejects.toThrow();
  });
});
