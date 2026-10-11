import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ActiveChip from "@/components/ui/ActiveChip";
import { HiddenChip, isHidden } from "../HiddenMark";

describe("HiddenMark", () => {
  it("treats only a set hidden_at as hidden", () => {
    expect(isHidden({ hidden_at: "2026-10-01T12:00:00Z" })).toBe(true);
    expect(isHidden({ hidden_at: null })).toBe(false);
    expect(isHidden({})).toBe(false);
    expect(isHidden(null)).toBe(false);
  });

  it("labels the chip in text, not colour alone, and offers no remove button", () => {
    render(<HiddenChip />);
    expect(screen.getByText("Falið")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("ActiveChip", () => {
  it("still renders a remove button when used as a filter chip", () => {
    const onRemove = vi.fn();
    render(<ActiveChip label="Útivist" onRemove={onRemove} />);
    screen.getByRole("button", { name: "Fjarlægja síu: Útivist" }).click();
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
