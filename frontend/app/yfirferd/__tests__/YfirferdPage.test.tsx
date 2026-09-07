import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import YfirferdPage from "../page";

const fetchReviewQueue = vi.fn();
const fetchOpenReports = vi.fn();
const reviewContent = vi.fn();
const setContentHidden = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

vi.mock("@/services/moderation.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/moderation.service")>()),
  fetchReviewQueue: (...a: unknown[]) => fetchReviewQueue(...a),
  fetchOpenReports: (...a: unknown[]) => fetchOpenReports(...a),
  reviewContent: (...a: unknown[]) => reviewContent(...a),
  setContentHidden: (...a: unknown[]) => setContentHidden(...a),
  resolveReport: vi.fn(),
  fetchAuthorStrikes: vi.fn(),
}));

let permissions = "moderator";
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", permissions },
    getToken: async () => "t",
    isLoading: false,
  }),
}));

const item = (over = {}) => ({
  id: "c1",
  content_type: "task" as const,
  name: "Kveikjuleikur",
  description: "Hlaupaleikur",
  instructions: "Myndið hring",
  author_id: "a1",
  author_name: "Foringi",
  created_at: "2026-09-01T10:00:00Z",
  review_state: "unreviewed" as const,
  hidden_at: null,
  review_note: null,
  open_report_count: 0,
  open_report_reasons: [],
  author_strikes: 0,
  ...over,
});

beforeEach(() => {
  permissions = "moderator";
  vi.clearAllMocks();
  fetchReviewQueue.mockResolvedValue([item()]);
  fetchOpenReports.mockResolvedValue([]);
  reviewContent.mockResolvedValue(item({ review_state: "approved" }));
  setContentHidden.mockResolvedValue(item({ hidden_at: "2026-09-02T10:00:00Z" }));
});

describe("who can open the board", () => {
  it("sends a non-moderator away rather than showing an empty board", async () => {
    // An empty board reads as "nothing to review", which is a different and
    // wrong message from "this is not yours".
    permissions = "member";
    render(<YfirferdPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});

describe("reading a row", () => {
  it("says why something was flagged, not just that it was", async () => {
    fetchReviewQueue.mockResolvedValue([
      item({ open_report_count: 2, open_report_reasons: ["unsafe", "spam"] }),
    ]);
    render(<YfirferdPage />);
    expect(await screen.findByText(/2 tilkynningar/)).toHaveTextContent(/getur verið hættulegt/i);
  });

  it("shows an author's history so a first-timer does not look like a repeat", async () => {
    fetchReviewQueue.mockResolvedValue([item({ author_strikes: 3 })]);
    render(<YfirferdPage />);
    expect(await screen.findByText(/3 áminningar áður/)).toBeInTheDocument();
  });

  it("labels the instructions, which otherwise read as more description", async () => {
    render(<YfirferdPage />);
    expect(await screen.findByText("Leiðbeiningar")).toBeInTheDocument();
  });
});

describe("sweeping the queue", () => {
  it("approves with a single keystroke and says so out loud", async () => {
    render(<YfirferdPage />);
    await screen.findByText("Kveikjuleikur");

    await userEvent.keyboard("s");

    await waitFor(() =>
      expect(reviewContent).toHaveBeenCalledWith("c1", "approved", undefined, expect.anything())
    );
    expect(await screen.findByRole("status")).toHaveTextContent("samþykkt");
  });

  it("offers a way back, because one key per item will be mis-keyed", async () => {
    render(<YfirferdPage />);
    await screen.findByText("Kveikjuleikur");
    await userEvent.keyboard("s");

    const undo = await screen.findByRole("button", { name: "Afturkalla" });
    await userEvent.click(undo);

    await waitFor(() =>
      expect(reviewContent).toHaveBeenLastCalledWith(
        "c1",
        "unreviewed",
        undefined,
        expect.anything()
      )
    );
    expect(await screen.findByText("Kveikjuleikur")).toBeInTheDocument();
  });

  it("says the queue is clear rather than showing nothing at all", async () => {
    fetchReviewQueue.mockResolvedValue([]);
    render(<YfirferdPage />);
    expect(await screen.findByText(/Ekkert bíður yfirferðar/)).toBeInTheDocument();
  });
});
