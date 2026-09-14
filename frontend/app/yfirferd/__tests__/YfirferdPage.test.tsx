import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import YfirferdPage from "../page";

const fetchReviewQueue = vi.fn();
const fetchReviewDetail = vi.fn();
const fetchOpenReports = vi.fn();
const addReviewComment = vi.fn();
const reviewContent = vi.fn();
const setContentHidden = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

vi.mock("@/services/moderation.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/moderation.service")>()),
  fetchReviewQueue: (...a: unknown[]) => fetchReviewQueue(...a),
  fetchReviewDetail: (...a: unknown[]) => fetchReviewDetail(...a),
  fetchOpenReports: (...a: unknown[]) => fetchOpenReports(...a),
  addReviewComment: (...a: unknown[]) => addReviewComment(...a),
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
  review_comments: [] as unknown[],
  documents: [] as unknown[],
  ...over,
});

/** The reading pane, so a query does not also match the rail. */
const pane = () => within(screen.getByRole("article"));

beforeEach(() => {
  // The page writes the selected item into the address bar, and jsdom keeps it
  // between tests — so without this each test inherits the last one's link.
  window.history.replaceState(null, "", "/yfirferd");
  permissions = "moderator";
  vi.clearAllMocks();
  fetchReviewQueue.mockResolvedValue({ items: [item()], total: 1 });
  fetchReviewDetail.mockResolvedValue(detail());
  fetchOpenReports.mockResolvedValue({ items: [], total: 0 });
  reviewContent.mockResolvedValue(item({ review_state: "approved" }));
  setContentHidden.mockResolvedValue(item({ hidden_at: "2026-09-02T10:00:00Z" }));
  addReviewComment.mockResolvedValue({ id: "n1" });
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
    fetchReviewQueue.mockResolvedValue({
      items: [item({ open_report_count: 2, open_report_reasons: ["unsafe", "spam"] })],
      total: 1,
    });
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

    await userEvent.click(await screen.findByRole("button", { name: /Taka aftur/ }));

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
    fetchReviewQueue.mockResolvedValue({ items: [], total: 0 });
    render(<YfirferdPage />);
    expect(await screen.findByText("Röðin er tóm.")).toBeInTheDocument();
  });

  it("says a filter matched nothing, which is not the same as being done", async () => {
    fetchReviewQueue.mockResolvedValue({ items: [], total: 0 });
    render(<YfirferdPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Hafnað" }));
    // Two different findings, two different sentences: one says look somewhere
    // else, the other says you are done.
    expect(await screen.findByText("Ekkert bíður í þessari síu.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hreinsa síuna" })).toBeInTheDocument();
  });

  it("does not congratulate a reviewer for reaching the end of a filter", async () => {
    fetchReviewQueue.mockResolvedValue({ items: [], total: 0 });
    render(<YfirferdPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Hafnað" }));
    expect(screen.queryByText(/vel gert/i)).not.toBeInTheDocument();
  });
});

describe("the audit view", () => {
  it("asks for every state by name, not with an empty value", async () => {
    // `review_state=` is ambiguous between "every state" and "the caller
    // forgot", and the API answers 422 to it — which is how Allt shipped broken.
    render(<YfirferdPage />);
    await screen.findByRole("button", { name: "Allt" });

    await userEvent.click(screen.getByRole("button", { name: "Allt" }));

    await waitFor(() =>
      expect(fetchReviewQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({ review_state: "all" }),
        expect.anything()
      )
    );
  });
});

describe("ten thousand items", () => {
  it("shows how many of the total are loaded, and offers the rest", async () => {
    // Without the count a reviewer cannot tell a short queue from the top of a
    // long one, and "Sýna fleiri" is a leap of faith.
    fetchReviewQueue.mockResolvedValue({ items: [item()], total: 5002 });
    render(<YfirferdPage />);

    expect(await screen.findByText("1 af 5002")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sýna fleiri" })).toBeInTheDocument();
  });

  it("asks for the next page from where the list ends", async () => {
    fetchReviewQueue.mockResolvedValue({ items: [item()], total: 5002 });
    render(<YfirferdPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Sýna fleiri" }));

    // Not "last": the debounced filter effect can fire a two-argument reload
    // afterwards. What matters is that the next page was asked for at all.
    await waitFor(() =>
      expect(fetchReviewQueue).toHaveBeenCalledWith(expect.anything(), expect.anything(), 1)
    );
  });

  it("offers nothing more once everything is loaded", async () => {
    fetchReviewQueue.mockResolvedValue({ items: [item()], total: 1 });
    render(<YfirferdPage />);
    await screen.findByText("Hlaupaleikur");
    expect(screen.queryByRole("button", { name: "Sýna fleiri" })).not.toBeInTheDocument();
  });
});

describe("finding things", () => {
  it("searches by author, debounced so typing is not one request per key", async () => {
    render(<YfirferdPage />);
    await userEvent.type(await screen.findByPlaceholderText("Höfundur…"), "Signý");

    await waitFor(() =>
      expect(fetchReviewQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({ author: "Signý" }),
        expect.anything()
      )
    );
  });

  it("labels the date range by the date the view is actually ordered by", async () => {
    // "frá" alone is a guess: submitted, or decided?
    render(<YfirferdPage />);
    expect(await screen.findByText(/Sent inn frá/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Samþykkt" }));
    expect(await screen.findByText(/Afgreitt frá/)).toBeInTheDocument();
  });
});

describe("reviewer notes", () => {
  it("makes the choice of audience the thing you click", async () => {
    // Not a dropdown plus one button: whether a note reaches the author is the
    // decision, so it should be the action, not a setting on the action.
    render(<YfirferdPage />);
    await waitFor(() => expect(pane().getByText("Athugasemdir yfirferðar")).toBeInTheDocument());

    expect(pane().getByRole("button", { name: "Vista innanhúss" })).toBeDisabled();
    expect(pane().getByRole("button", { name: "Senda höfundi" })).toBeDisabled();

    await userEvent.type(
      pane().getByPlaceholderText("Athugasemd eða ábending…"),
      "Bættu við aldri"
    );
    expect(pane().getByRole("button", { name: "Senda höfundi" })).toBeEnabled();
  });

  it("asks before anything leaves the building", async () => {
    // Every other action here has an undo. This one is an email — it cannot be
    // taken back, so it gets a question instead.
    render(<YfirferdPage />);
    await waitFor(() => expect(pane().getByText("Athugasemdir yfirferðar")).toBeInTheDocument());

    await userEvent.type(
      pane().getByPlaceholderText("Athugasemd eða ábending…"),
      "Bættu við aldri"
    );
    await userEvent.click(pane().getByRole("button", { name: "Senda höfundi" }));

    expect(await screen.findByText(/Ekki er hægt að afturkalla hana/)).toBeInTheDocument();
    expect(addReviewComment).not.toHaveBeenCalled();
  });

  it("backing out of the confirmation sends nothing", async () => {
    render(<YfirferdPage />);
    await waitFor(() => expect(pane().getByText("Athugasemdir yfirferðar")).toBeInTheDocument());
    await userEvent.type(
      pane().getByPlaceholderText("Athugasemd eða ábending…"),
      "Bættu við aldri"
    );
    await userEvent.click(pane().getByRole("button", { name: "Senda höfundi" }));

    await userEvent.click(await screen.findByRole("button", { name: "Hætta við" }));

    expect(addReviewComment).not.toHaveBeenCalled();
  });

  it("sends a suggestion once confirmed, and says so", async () => {
    render(<YfirferdPage />);
    await waitFor(() => expect(pane().getByText("Athugasemdir yfirferðar")).toBeInTheDocument());

    await userEvent.type(
      pane().getByPlaceholderText("Athugasemd eða ábending…"),
      "Bættu við aldri"
    );
    await userEvent.click(pane().getByRole("button", { name: "Senda höfundi" }));
    await userEvent.click(await screen.findByRole("button", { name: "Já, senda höfundi" }));

    await waitFor(() =>
      expect(addReviewComment).toHaveBeenCalledWith(
        "c1",
        "Bættu við aldri",
        "to_author",
        expect.anything()
      )
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Ábending send höfundi");
  });

  it("saves an internal note with no ceremony, because it goes nowhere", async () => {
    render(<YfirferdPage />);
    await waitFor(() => expect(pane().getByText("Athugasemdir yfirferðar")).toBeInTheDocument());

    await userEvent.type(pane().getByPlaceholderText("Athugasemd eða ábending…"), "Muna að spyrja");
    await userEvent.click(pane().getByRole("button", { name: "Vista innanhúss" }));

    await waitFor(() =>
      expect(addReviewComment).toHaveBeenCalledWith(
        "c1",
        "Muna að spyrja",
        "internal",
        expect.anything()
      )
    );
  });

  it("marks each note with whether the author was told", async () => {
    fetchReviewDetail.mockResolvedValue(
      detail({
        review_comments: [
          {
            id: "n1",
            body: "Innri minnispunktur",
            visibility: "internal",
            created_at: "2026-09-01",
            author_name: "Signý",
          },
          {
            id: "n2",
            body: "Ábending",
            visibility: "to_author",
            created_at: "2026-09-02",
            author_name: "Signý",
          },
        ],
      })
    );
    render(<YfirferdPage />);

    await waitFor(() => expect(pane().getByText("Innanhúss")).toBeInTheDocument());
    expect(pane().getByText("Senda höfundi", { selector: "span" })).toBeInTheDocument();
  });
});

describe("sharing what is on screen", () => {
  it("keeps the selected item in the address bar so the URL can be sent", async () => {
    render(<YfirferdPage />);
    await screen.findByText("Hlaupaleikur");
    await waitFor(() => expect(window.location.search).toContain("efni=c1"));
  });

  it("shows pictures and documents, which a rail cannot", async () => {
    fetchReviewDetail.mockResolvedValue(
      detail({
        image: "https://blob/mynd.png",
        documents: [{ name: "Leiðbeiningar.pdf", url: "https://blob/1.pdf", content_type: null }],
      })
    );
    render(<YfirferdPage />);

    await waitFor(() => expect(pane().getByText("Mynd")).toBeInTheDocument());
    expect(pane().getByRole("link", { name: "Leiðbeiningar.pdf" })).toHaveAttribute(
      "target",
      "_blank"
    );
  });
});

describe("version skew", () => {
  it("degrades rather than white-screening when the API predates the UI", async () => {
    // A frontend can be deployed ahead of its backend. A field that has not
    // shipped yet should cost this pane a section, not the whole screen —
    // which is exactly what it did the first time it was run for real.
    const older = detail();
    delete (older as Record<string, unknown>).documents;
    delete (older as Record<string, unknown>).review_comments;
    delete (older as Record<string, unknown>).reports;
    fetchReviewDetail.mockResolvedValue(older);

    render(<YfirferdPage />);

    await waitFor(() => expect(pane().getByText("Kveikjuleikur")).toBeInTheDocument());
    expect(pane().getByText("Athugasemdir yfirferðar")).toBeInTheDocument();
  });
});
