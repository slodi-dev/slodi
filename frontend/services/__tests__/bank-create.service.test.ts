import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createBankContent, createProgram } from "../programs.service";

const getToken = async () => "fake-token";

const INPUT = { name: "Kveikjuleikur", workspaceId: "ws-1" };

function captureFetch() {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ id: "c1", name: "Kveikjuleikur" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    })
  );
}

describe("what a submission is filed as", () => {
  let fetchSpy: ReturnType<typeof captureFetch>;

  beforeEach(() => {
    fetchSpy = captureFetch();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function lastCall() {
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    return { url: String(url), body: JSON.parse(String(init.body)) };
  }

  it.each([
    ["task", "tasks"],
    ["event", "events"],
    ["program", "programs"],
  ] as const)("files a %s against /%s", async (type, segment) => {
    // The bug this replaces: every submission went to /programs and carried
    // `content_type: "program"`, so a leikur was stored as a collection.
    await createBankContent(type, INPUT, getToken);

    const { url, body } = lastCall();
    expect(url).toContain(`/workspaces/ws-1/${segment}`);
    expect(body.content_type).toBe(type);
  });

  it("sends no date for a bank viðburður", async () => {
    // A bank Viðburður is a template somebody may run in March or September.
    // The API defaulted an absent start_dt to now(), so the payload must not
    // carry the field at all rather than carrying a guess.
    await createBankContent("event", INPUT, getToken);

    const { body } = lastCall();
    expect(body.start_dt).toBeUndefined();
    expect(body.end_dt).toBeUndefined();
  });

  it("keeps createProgram working for callers that only make a Dagskrá", async () => {
    await createProgram(INPUT, getToken);

    const { url, body } = lastCall();
    expect(url).toContain("/workspaces/ws-1/programs");
    expect(body.content_type).toBe("program");
  });
});
