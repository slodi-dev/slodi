import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportContentModal from "../ReportContentModal";

const reportContent = vi.fn();
const reportComment = vi.fn();

vi.mock("@/services/reports.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/reports.service")>()),
  reportContent: (...args: unknown[]) => reportContent(...args),
  reportComment: (...args: unknown[]) => reportComment(...args),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ getToken: async () => "token" }),
}));

function open() {
  return render(
    <ReportContentModal open onClose={vi.fn()} contentId="c-1" contentName="Kveikjuleikur" />
  );
}

beforeEach(() => {
  reportContent.mockReset();
  reportContent.mockResolvedValue({ id: "r-1" });
  reportComment.mockReset();
  reportComment.mockResolvedValue({ id: "r-2" });
});

describe("reporting an item", () => {
  it("cannot be sent until a reason is chosen", async () => {
    open();
    expect(screen.getByRole("button", { name: "Senda tilkynningu" })).toBeDisabled();

    await userEvent.click(screen.getByLabelText("Auglýsing eða rusl"));
    expect(screen.getByRole("button", { name: "Senda tilkynningu" })).toBeEnabled();
  });

  it("sends without a note, because requiring one means it never gets filed", async () => {
    open();
    await userEvent.click(screen.getByLabelText("Á ekki heima í bankanum"));
    await userEvent.click(screen.getByRole("button", { name: "Senda tilkynningu" }));

    await waitFor(() =>
      expect(reportContent).toHaveBeenCalledWith("c-1", "inappropriate", "", expect.anything())
    );
  });

  it("confirms out loud rather than silently", async () => {
    // Someone who flags something and sees nothing happen assumes it failed.
    open();
    await userEvent.click(screen.getByLabelText("Getur verið hættulegt"));
    await userEvent.click(screen.getByRole("button", { name: "Senda tilkynningu" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Takk fyrir. Teymið skoðar þetta.");
  });

  it("says so when it fails, and lets the person try again", async () => {
    reportContent.mockRejectedValue(new Error("nope"));
    open();
    await userEvent.click(screen.getByLabelText("Annað"));
    await userEvent.click(screen.getByRole("button", { name: "Senda tilkynningu" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Ekki tókst að senda");
    expect(screen.getByRole("button", { name: "Senda tilkynningu" })).toBeEnabled();
  });

  it("offers unsafe near the top, not buried at the bottom", () => {
    // It is the reason the team most needs to hear about, and a reason nobody
    // scrolls to is a reason nobody picks.
    open();
    const values = screen.getAllByRole("radio").map((o) => (o as HTMLInputElement).value);
    expect(values.indexOf("unsafe")).toBeLessThan(2);
  });
});

describe("reporting a comment", () => {
  const comment = { id: "k-1", author_name: "Aron", body: "Þetta er athugasemdin." };

  function openForComment() {
    return render(
      <ReportContentModal
        open
        onClose={vi.fn()}
        contentId="c-1"
        contentName="Kveikjuleikur"
        comment={comment}
      />
    );
  }

  it("says whose comment it is and quotes it, rather than naming the item", () => {
    // Titled with the item's name, a comment report read as a report of the item.
    openForComment();
    expect(
      screen.getByRole("dialog", { name: "Tilkynna athugasemd frá Aron" })
    ).toBeInTheDocument();
    expect(screen.getByText("Þetta er athugasemdin.")).toBeInTheDocument();
  });

  it("offers only the reasons that fit a comment, in a comment's words", () => {
    openForComment();
    const values = screen.getAllByRole("radio").map((o) => (o as HTMLInputElement).value);
    // Mirrors COMMENT_REPORT_REASONS on the backend, which refuses the rest.
    expect(values).toEqual(["inappropriate", "unsafe", "spam", "other"]);
    expect(screen.getByLabelText("Dónalegt eða særandi")).toBeInTheDocument();
    expect(screen.queryByLabelText("Til nú þegar")).not.toBeInTheDocument();
  });

  it("files it against the comment, not the item", async () => {
    openForComment();
    await userEvent.click(screen.getByLabelText("Dónalegt eða særandi"));
    await userEvent.click(screen.getByRole("button", { name: "Senda tilkynningu" }));

    await waitFor(() =>
      expect(reportComment).toHaveBeenCalledWith("k-1", "inappropriate", "", expect.anything())
    );
    expect(reportContent).not.toHaveBeenCalled();
  });
});
