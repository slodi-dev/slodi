import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createTag, deleteTag, fetchContentTags, fetchTagById, updateTag } from "../tags.service";

const getToken = async () => "fake-token";

function captureFetch() {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ id: "t-1", name: "Útivist" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

describe("tag management sends the bearer token", () => {
  let fetchSpy: ReturnType<typeof captureFetch>;

  beforeEach(() => {
    fetchSpy = captureFetch();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function lastCall() {
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    return {
      url: String(url),
      method: init.method,
      auth: new Headers(init.headers).get("Authorization"),
    };
  }

  // The bug this replaces: these relied on `credentials: "include"` alone, but
  // the API only reads the Authorization header, so every call was anonymous
  // and the /tags admin page could not create, rename or delete anything.
  it.each([
    ["createTag", () => createTag({ name: " Útivist " }, getToken), "POST", /\/tags$/],
    ["fetchTagById", () => fetchTagById("t-1", getToken), "GET", /\/tags\/t-1$/],
    ["updateTag", () => updateTag("t-1", "Útivera", getToken), "PATCH", /\/tags\/t-1$/],
    ["deleteTag", () => deleteTag("t-1", getToken), "DELETE", /\/tags\/t-1$/],
    ["fetchContentTags", () => fetchContentTags("c-1", getToken), "GET", /\/content\/c-1\/tags$/],
  ] as const)("%s", async (_name, call, method, urlPattern) => {
    await call();

    const { url, method: sent, auth } = lastCall();
    expect(url).toMatch(urlPattern);
    expect(sent).toBe(method);
    expect(auth).toBe("Bearer fake-token");
  });

  it("trims the name it creates", async () => {
    await createTag({ name: "  Útivist  " }, getToken);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ name: "Útivist" });
  });

  it("refuses to send a write without a token", async () => {
    await expect(createTag({ name: "Útivist" }, async () => null)).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
