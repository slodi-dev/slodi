import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportContentModal from "../ReportContentModal";

const reportContent = vi.fn();

vi.mock("@/services/reports.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/reports.service")>()),
  reportContent: (...args: unknown[]) => reportContent(...args),
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
