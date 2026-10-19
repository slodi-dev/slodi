import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TagRequestError,
  createTag,
  fetchAllTags,
  fetchTagUsageCount,
} from "@/services/tags.service";

const getToken = async () => "token";

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the tag service the tag page uses", () => {
  it("reports a failure as its status and raw detail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ detail: "Tag with this name already exists" }, 409)
    );

    const err = await createTag({ name: "Útilíf" }, getToken).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(TagRequestError);
    expect((err as TagRequestError).status).toBe(409);
    expect((err as TagRequestError).detail).toBe("Tag with this name already exists");
  });

  it("reports a request that got no answer as status 0", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const err = await createTag({ name: "Útilíf" }, getToken).catch((e: unknown) => e);
    expect((err as TagRequestError).status).toBe(0);
  });

  it("fetches every page of tags, not just the backend's default 50", async () => {
    const first = Array.from({ length: 200 }, (_, i) => ({ id: `a${i}`, name: `a${i}` }));
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(first, 200, { "X-Total-Count": "201" }))
      .mockResolvedValueOnce(json([{ id: "b", name: "b" }], 200, { "X-Total-Count": "201" }));

    const all = await fetchAllTags(getToken);

    expect(all).toHaveLength(201);
    expect(String(fetchSpy.mock.calls[1][0])).toMatch(/limit=200&offset=200/);
  });

  it("reads a tag's usage from X-Total-Count, and null without it", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json([], 200, { "X-Total-Count": "7" }))
      .mockResolvedValueOnce(json([]));

    expect(await fetchTagUsageCount("t-1", getToken)).toBe(7);
    expect(await fetchTagUsageCount("t-1", getToken)).toBeNull();
  });
});
