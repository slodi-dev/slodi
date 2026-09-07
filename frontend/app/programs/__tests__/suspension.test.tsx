import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgramsHeader } from "../components/ProgramsHeader";
import { suspendedUntilFromError } from "@/services/suspensions.service";

describe("what a suspended leader sees", () => {
  it("disables the button with a reason rather than hiding it", () => {
    // A button that vanishes reads as a bug and produces a support message
    // instead of understanding.
    render(<ProgramsHeader onNewProgram={vi.fn()} suspendedUntil="2026-10-01" />);

    const fab = screen.getByRole("button");
    expect(fab).toBeDisabled();
    expect(fab).toHaveAccessibleName(/fram til 1\. október 2026/);
  });

  it("names no date for an open-ended suspension", () => {
    // Inventing one would be a lie, and "fram til" with nothing after it is
    // worse than saying plainly that there is no end yet.
    render(<ProgramsHeader onNewProgram={vi.fn()} suspendedUntil="open-ended" />);

    const fab = screen.getByRole("button");
    expect(fab).toBeDisabled();
    expect(fab).toHaveAccessibleName("Þú getur ekki sent inn efni");
  });

  it("says nothing at all when there is nothing to say", () => {
    render(<ProgramsHeader onNewProgram={vi.fn()} />);

    const fab = screen.getByRole("button");
    expect(fab).toBeEnabled();
    expect(fab).toHaveAccessibleName("Bæta við dagskrá");
  });

  it("reads the end date out of the API's own refusal", () => {
    // The banner and the server must not be able to disagree, so the date comes
    // from the 403 rather than from a second source of truth.
    const until = suspendedUntilFromError(
      new Error("Þú getur ekki sent inn efni í bankann fram til 2026-10-01.")
    );
    expect(until).toBe("2026-10-01");
  });

  it("returns nothing for an unrelated failure", () => {
    expect(suspendedUntilFromError(new Error("Network error"))).toBeNull();
    expect(suspendedUntilFromError(null)).toBeNull();
  });
});
