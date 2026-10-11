import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TemplateTextEditor from "../TemplateTextEditor";

const mockGetTemplateText = vi.fn();

// A stable getToken, as AuthContext provides once sc-543 lands; a new function
// each render would re-run the load effect.
const auth = { getToken: async () => "fake-token", isLoading: false };
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => auth,
}));

vi.mock("@/services/emails.service", () => ({
  getTemplateText: (...args: unknown[]) => mockGetTemplateText(...args),
  updateTemplateText: vi.fn(),
}));

describe("TemplateTextEditor", () => {
  beforeEach(() => {
    mockGetTemplateText.mockReset();
  });

  it("shows the load error instead of rendering nothing", async () => {
    mockGetTemplateText.mockRejectedValue(new Error("Gat ekki sótt texta"));

    render(<TemplateTextEditor />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Gat ekki sótt texta");
    expect(screen.getByRole("button", { name: "Reyna aftur" })).toBeInTheDocument();
  });

  it("retries the load when asked", async () => {
    mockGetTemplateText.mockRejectedValueOnce(new Error("Gat ekki sótt texta"));
    mockGetTemplateText.mockResolvedValueOnce({});

    render(<TemplateTextEditor />);
    await userEvent.click(await screen.findByRole("button", { name: "Reyna aftur" }));

    expect(mockGetTemplateText).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
