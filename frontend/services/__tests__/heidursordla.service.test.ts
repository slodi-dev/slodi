import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { submitGuess } from "../heidursordla.service";

const FAKE_TOKEN = "fake-token";
const PUZZLE_ID = "11111111-2222-3333-4444-555555555555";

describe("heidursordla service — submitGuess", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  const getToken = async () => FAKE_TOKEN;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function mockResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("returns ok=true on a 200 response", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(200, {
        colors: ["green", "yellow", "gray", "gray", "green"],
        status: "in_progress",
        guesses_used: 1,
        guesses_remaining: 5,
        answer: null,
      })
    );

    const result = await submitGuess(PUZZLE_ID, "halló", getToken);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.colors).toEqual(["green", "yellow", "gray", "gray", "green"]);
      expect(result.status).toBe("in_progress");
      expect(result.guesses_used).toBe(1);
    }
  });

  it("surfaces typed error_code on 400 with nested detail", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(400, {
        detail: { error_code: "not_in_dictionary", detail: "Ekki í orðabók" },
      })
    );

    const result = await submitGuess(PUZZLE_ID, "abcde", getToken);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe("not_in_dictionary");
      expect(result.detail).toBe("Ekki í orðabók");
    }
  });

  it("surfaces typed error_code on 410 (gone) responses", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(410, {
        detail: { error_code: "puzzle_finished", detail: "Þrautin er ekki lengur opin" },
      })
    );

    const result = await submitGuess(PUZZLE_ID, "abcde", getToken);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe("puzzle_finished");
    }
  });

  it("sends Authorization bearer header and JSON body", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(200, {
        colors: [],
        status: "in_progress",
        guesses_used: 1,
        guesses_remaining: 5,
        answer: null,
      })
    );

    await submitGuess(PUZZLE_ID, "halló", getToken);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${FAKE_TOKEN}`);
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ word: "halló" }));
  });
});
