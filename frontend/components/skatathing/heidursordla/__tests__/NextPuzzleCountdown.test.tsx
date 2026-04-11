import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import NextPuzzleCountdown from "../NextPuzzleCountdown";

describe("NextPuzzleCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-11T08:00:00.000Z"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders the initial remaining time", () => {
    // Target = 1h 2m 3s in the future.
    const target = new Date("2026-04-11T09:02:03.000Z").toISOString();
    render(<NextPuzzleCountdown targetIso={target} />);
    expect(screen.getByText("01:02:03")).toBeInTheDocument();
  });

  it("decrements once per second via setInterval", () => {
    const target = new Date("2026-04-11T08:00:05.000Z").toISOString();
    render(<NextPuzzleCountdown targetIso={target} />);
    expect(screen.getByText("00:00:05")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("00:00:04")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("00:00:02")).toBeInTheDocument();
  });

  it("calls onExpire exactly once when the countdown reaches zero", () => {
    const onExpire = vi.fn();
    const target = new Date("2026-04-11T08:00:02.000Z").toISOString();
    render(<NextPuzzleCountdown targetIso={target} onExpire={onExpire} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onExpire).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);

    // Subsequent ticks must NOT re-fire onExpire.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("clears its interval on unmount", () => {
    const target = new Date("2026-04-11T09:00:00.000Z").toISOString();
    const clearSpy = vi.spyOn(global, "clearInterval");
    const { unmount } = render(<NextPuzzleCountdown targetIso={target} />);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });

  it("renders a custom label", () => {
    const target = new Date("2026-04-11T09:00:00.000Z").toISOString();
    render(<NextPuzzleCountdown targetIso={target} label="Næsta þraut opnast eftir" />);
    expect(screen.getByText("Næsta þraut opnast eftir")).toBeInTheDocument();
  });
});
