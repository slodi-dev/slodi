import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeleteConfirmModal, DELETE_FAILED_MESSAGE } from "../DeleteConfirmModal";

describe("DeleteConfirmModal", () => {
  it("shows no error until a delete has failed", () => {
    render(
      <DeleteConfirmModal open programName="Kveikjuleikur" onClose={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows why the delete failed inside the modal", () => {
    render(
      <DeleteConfirmModal
        open
        programName="Kveikjuleikur"
        error={DELETE_FAILED_MESSAGE}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent(DELETE_FAILED_MESSAGE);
  });
});
