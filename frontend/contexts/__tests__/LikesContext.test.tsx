import React from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LikesProvider, useLikes } from "@/contexts/LikesContext";

const likeProgram = vi.fn();
const unlikeProgram = vi.fn();
const fetchProgramById = vi.fn();

vi.mock("@/services/programs.service", () => ({
  likeProgram: (...args: unknown[]) => likeProgram(...args),
  unlikeProgram: (...args: unknown[]) => unlikeProgram(...args),
  fetchProgramById: (...args: unknown[]) => fetchProgramById(...args),
}));

let currentUser: { id: string } | null = { id: "anna" };
const getToken = vi.fn(async () => "token");
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: currentUser, getToken }),
}));

function Likes({ id, count, liked }: { id: string; count?: number; liked?: boolean }) {
  const { likeCount, isLiked, toggleLike } = useLikes(id, count, liked);
  return (
    <button type="button" aria-pressed={isLiked} onClick={() => void toggleLike()}>
      {likeCount}
    </button>
  );
}

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const button = () => screen.getByRole("button");

beforeEach(() => {
  currentUser = { id: "anna" };
  likeProgram.mockReset().mockResolvedValue(undefined);
  unlikeProgram.mockReset().mockResolvedValue(undefined);
  fetchProgramById.mockReset().mockResolvedValue({});
});

describe("LikesContext", () => {
  it("shows the server value that arrives after a placeholder render (sc-531)", () => {
    // The item page renders before its fetch lands, then again with the item.
    const { rerender } = render(
      <LikesProvider>
        <Likes id="p1" />
      </LikesProvider>
    );
    expect(button()).toHaveTextContent("0");
    expect(button()).toHaveAttribute("aria-pressed", "false");

    rerender(
      <LikesProvider>
        <Likes id="p1" count={5} liked />
      </LikesProvider>
    );
    expect(button()).toHaveTextContent("5");
    expect(button()).toHaveAttribute("aria-pressed", "true");
  });

  it("lets a later server value replace an earlier one", () => {
    const { rerender } = render(
      <LikesProvider>
        <Likes id="p1" count={0} liked={false} />
      </LikesProvider>
    );
    expect(button()).toHaveTextContent("0");

    rerender(
      <LikesProvider>
        <Likes id="p1" count={5} liked />
      </LikesProvider>
    );
    expect(button()).toHaveTextContent("5");
    expect(button()).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles optimistically and keeps the result once the server agrees", async () => {
    render(
      <LikesProvider>
        <Likes id="p1" count={2} liked={false} />
      </LikesProvider>
    );
    await act(async () => button().click());
    expect(likeProgram).toHaveBeenCalledWith("p1", getToken);
    expect(button()).toHaveTextContent("3");
    expect(button()).toHaveAttribute("aria-pressed", "true");
  });

  it("does not let a stale fetch clobber an in-flight toggle", async () => {
    const pending = deferred();
    likeProgram.mockReturnValue(pending.promise);
    const { rerender } = render(
      <LikesProvider>
        <Likes id="p1" count={2} liked={false} />
      </LikesProvider>
    );
    act(() => button().click());
    expect(button()).toHaveTextContent("3");

    // A fetch that left before the click lands while the like is in flight.
    rerender(
      <LikesProvider>
        <Likes id="p1" count={1} liked={false} />
      </LikesProvider>
    );
    expect(button()).toHaveTextContent("3");
    expect(button()).toHaveAttribute("aria-pressed", "true");

    await act(async () => pending.resolve());
    expect(button()).toHaveTextContent("3");
    expect(button()).toHaveAttribute("aria-pressed", "true");
  });

  it("rolls back when the server refuses the toggle", async () => {
    likeProgram.mockRejectedValue(new Error("nope"));
    render(
      <LikesProvider>
        <Likes id="p1" count={2} liked={false} />
      </LikesProvider>
    );
    await act(async () => button().click());
    expect(button()).toHaveTextContent("2");
    expect(button()).toHaveAttribute("aria-pressed", "false");
  });

  it("refreshes the browser's cached copy of the item after a toggle", async () => {
    // `/content/{id}` is cacheable for a minute; without this, a link opened in
    // a new tab right after the like is served the pre-like copy.
    render(
      <LikesProvider>
        <Likes id="p1" count={2} liked={false} />
      </LikesProvider>
    );
    await act(async () => button().click());
    expect(fetchProgramById).toHaveBeenCalledWith("p1", getToken, { refreshCache: true });
  });

  it("forgets one user's likes when another signs in", () => {
    const { rerender } = render(
      <LikesProvider>
        <Likes id="p1" count={5} liked />
      </LikesProvider>
    );
    expect(button()).toHaveAttribute("aria-pressed", "true");

    currentUser = { id: "bjarni" };
    rerender(
      <LikesProvider>
        <Likes id="p1" />
      </LikesProvider>
    );
    expect(button()).toHaveAttribute("aria-pressed", "false");
  });
});
