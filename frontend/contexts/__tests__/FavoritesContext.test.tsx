/**
 * Favourites are hidden behind FAVOURITES_ENABLED (UX-01). While it is off the
 * context keeps its state in localStorage and makes no network calls: the
 * routes it would call do not exist.
 */
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FavoritesProvider, useFavorite } from "@/contexts/FavoritesContext";

function Favourite({ id }: { id: string }) {
  const { isFavorite, toggleFavorite } = useFavorite(id);
  return (
    <button type="button" aria-pressed={isFavorite} onClick={() => void toggleFavorite()}>
      {id}
    </button>
  );
}

const fetchSpy = vi.fn();

beforeEach(() => {
  window.localStorage.clear();
  fetchSpy.mockReset();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FavoritesContext with FAVOURITES_ENABLED off", () => {
  it("toggles locally and sends nothing", async () => {
    render(
      <FavoritesProvider>
        <Favourite id="p1" />
      </FavoritesProvider>
    );
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "false");

    await act(async () => button.click());
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(window.localStorage.getItem("favorite-programs")!)).toEqual(["p1"]);

    await act(async () => button.click());
    expect(button).toHaveAttribute("aria-pressed", "false");

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
