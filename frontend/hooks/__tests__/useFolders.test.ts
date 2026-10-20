import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { folderNameError, useFolders } from "../useFolders";
import { LIBRARY_FOLDERS } from "@/lib/mock/folders.mock";
import * as mockMode from "@/lib/mock/mock-mode";

vi.mock("@/lib/mock/mock-mode", async (importOriginal) => {
  const actual = await importOriginal<typeof mockMode>();
  return { ...actual, useMockMode: vi.fn() };
});

const useMockMode = vi.mocked(mockMode.useMockMode);

describe("folderNameError", () => {
  it("refuses an empty name, a long one and a duplicate in any case", () => {
    expect(folderNameError("  ", LIBRARY_FOLDERS)).toBe("Gefðu möppunni heiti.");
    expect(folderNameError("x".repeat(61), LIBRARY_FOLDERS)).toMatch(/mest 60 stafir/);
    expect(folderNameError(" rigningardagar ", LIBRARY_FOLDERS)).toBe(
      "Þú átt þegar möppu sem heitir „Rigningardagar“."
    );
  });

  it("lets a mappa keep its own name on rename", () => {
    expect(folderNameError("Rigningardagar", LIBRARY_FOLDERS, "mappa-2")).toBeNull();
  });
});

describe("useFolders", () => {
  it("starts empty with mock mode off: a real leader never sees made-up möppur", () => {
    useMockMode.mockReturnValue({ mode: "off", settled: true });
    const { result } = renderHook(() => useFolders());
    expect(result.current.folders).toEqual([]);
  });

  it("takes the fixtures once mock mode settles, but never over the leader's own changes", () => {
    useMockMode.mockReturnValue({ mode: "auto", settled: false });
    const { result, rerender } = renderHook(() => useFolders());
    expect(result.current.folders).toEqual([]);

    useMockMode.mockReturnValue({ mode: "auto", settled: true });
    rerender();
    expect(result.current.folders).toBe(LIBRARY_FOLDERS);

    act(() => {
      result.current.create("Haustfundir");
    });
    expect(result.current.folders.map((f) => f.name)).toContain("Haustfundir");
  });

  it("deletes at once and Afturkalla puts the mappa back where it was", () => {
    useMockMode.mockReturnValue({ mode: "auto", settled: true });
    const { result } = renderHook(() => useFolders());
    act(() => result.current.remove("mappa-2"));
    expect(result.current.folders.map((f) => f.id)).not.toContain("mappa-2");
    expect(result.current.message).toMatchObject({ canUndo: true });
    act(() => result.current.undoRemove());
    expect(result.current.folders[1].id).toBe("mappa-2");
  });
});
