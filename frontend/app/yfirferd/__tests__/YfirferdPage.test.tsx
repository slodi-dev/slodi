import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import YfirferdPage from "../page";

const fetchReviewQueue = vi.fn();
const fetchReviewDetail = vi.fn();
const fetchOpenReports = vi.fn();
const reviewContent = vi.fn();
const setContentHidden = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

vi.mock("@/services/moderation.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/moderation.service")>()),
  fetchReviewQueue: (...a: unknown[]) => fetchReviewQueue(...a),
  fetchReviewDetail: (...a: unknown[]) => fetchReviewDetail(...a),
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
  open_report_reasons: [] as string[],
  author_strikes: 0,
  reviewed_by_name: null,
  reviewed_at: null,
  ...over,
});

const detail = (over = {}) => ({
  ...item(),
  equipment: ["Spottar"],
  duration_min: 15,
  duration_max: 25,
  prep_time_min: null,
  prep_time_max: null,
  count_min: null,
  count_max: null,
  price: null,
  location: null,
  age: null,
  image: null,
  tags: [],
  workspace_id: "w1",
  reports: [] as unknown[],
  ...over,
});

/** The reading pane, so a query does not also match the rail. */
const pane = () => within(screen.getByRole("article"));

beforeEach(() => {
  permissions = "moderator";
  vi.clearAllMocks();
  fetchReviewQueue.mockResolvedValue([item()]);
  fetchReviewDetail.mockResolvedValue(detail());
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

describe("the rail and the pane", () => {
  it("flags in the rail how many objected, and says why in the pane", async () => {
    // The rail is for choosing what to read; the pane is for judging it.
    fetchReviewQueue.mockResolvedValue([
      item({ open_report_count: 2, open_report_reasons: ["unsafe", "spam"] }),
    ]);
    fetchReviewDetail.mockResolvedValue(
      detail({
        open_report_count: 2,
        reports: [{ id: "r1", reason: "unsafe", note: "Of hættulegt", created_at: "2026-09-01" }],
      })
    );
    render(<YfirferdPage />);

    expect(await screen.findByText("2 tilkynningar")).toBeInTheDocument();
    await waitFor(() => expect(pane().getByText(/Of hættulegt/)).toBeInTheDocument());
  });

  it("shows the full text, not the two truncated lines a rail can afford", async () => {
    render(<YfirferdPage />);
    await waitFor(() => expect(pane().getByText("Leiðbeiningar")).toBeInTheDocument());
    expect(pane().getByText("Myndið hring")).toBeInTheDocument();
  });

  it("shows an author's history so a first-timer does not look like a repeat", async () => {
    fetchReviewDetail.mockResolvedValue(detail({ author_strikes: 3 }));
    render(<YfirferdPage />);
    await waitFor(() => expect(pane().getByText(/3 áminningar áður/)).toBeInTheDocument());
  });

  it("says who decided and when, once something has been", async () => {
    // "Who approved this?" should not be a question only the database can answer.
    fetchReviewDetail.mockResolvedValue(
      detail({
        review_state: "approved",
        reviewed_by_name: "Signý",
        reviewed_at: "2026-09-03T09:00:00Z",
      })
    );
    render(<YfirferdPage />);
    await waitFor(() => expect(pane().getByText(/Samþykkt af Signý/)).toBeInTheDocument());
  });
});

describe("filtering", () => {
  it("opens on the unreviewed queue, which is the working view", async () => {
    render(<YfirferdPage />);
    await waitFor(() =>
      expect(fetchReviewQueue).toHaveBeenCalledWith(
        expect.objectContaining({ review_state: "unreviewed" }),
        expect.anything()
      )
    );
  });

  it("switches to the record of what was approved", async () => {
    render(<YfirferdPage />);
    await screen.findByRole("button", { name: "Samþykkt" });

    await userEvent.click(screen.getByRole("button", { name: "Samþykkt" }));

    await waitFor(() =>
      expect(fetchReviewQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({ review_state: "approved" }),
        expect.anything()
      )
    );
  });
});

describe("sweeping the queue", () => {
  it("approves with a single keystroke and says so out loud", async () => {
    render(<YfirferdPage />);
    await screen.findByText("Hlaupaleikur");

    await userEvent.keyboard("s");

    await waitFor(() =>
      expect(reviewContent).toHaveBeenCalledWith("c1", "approved", undefined, expect.anything())
    );
    expect(await screen.findByRole("status")).toHaveTextContent("samþykkt");
  });

  it("offers a way back, because one key per item will be mis-keyed", async () => {
    render(<YfirferdPage />);
    await screen.findByText("Hlaupaleikur");
    await userEvent.keyboard("s");

    await userEvent.click(await screen.findByRole("button", { name: "Afturkalla" }));

    await waitFor(() =>
      expect(reviewContent).toHaveBeenLastCalledWith(
        "c1",
        "unreviewed",
        undefined,
        expect.anything()
      )
    );
  });

  it("says the queue is clear rather than showing nothing at all", async () => {
    fetchReviewQueue.mockResolvedValue([]);
    render(<YfirferdPage />);
    expect(await screen.findByText(/Ekkert bíður yfirferðar/)).toBeInTheDocument();
  });

  it("says a filter matched nothing, which is not the same as being done", async () => {
    fetchReviewQueue.mockResolvedValue([]);
    render(<YfirferdPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Hafnað" }));
    expect(await screen.findByText(/Ekkert efni passar við þessa síu/)).toBeInTheDocument();
  });
});
