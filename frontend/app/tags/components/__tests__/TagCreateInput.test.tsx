import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagRequestError } from "@/services/tags.service";
import TagCreateInput from "../TagCreateInput";

const createTag = vi.fn();
const getToken = vi.fn(async () => "token");

vi.mock("@/services/tags.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/tags.service")>()),
  createTag: (...args: unknown[]) => createTag(...args),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ getToken }),
}));

const FIELD = "Leita eða búa til merkimiða";

beforeEach(() => {
  createTag.mockReset();
  createTag.mockResolvedValue({ id: "t-1", name: "Útivist" });
});

describe("creating a tag", () => {
  it("creates on Enter with the signed-in user's token getter, then empties the field", async () => {
    const onCreated = vi.fn();
    render(<TagCreateInput onCreated={onCreated} />);

    await userEvent.type(screen.getByLabelText(FIELD), "Útivist{Enter}");

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: "t-1", name: "Útivist" }));
    expect(createTag).toHaveBeenCalledWith({ name: "Útivist" }, getToken);
    expect(screen.getByLabelText(FIELD)).toHaveValue("");
  });

  it("refuses a name that exists without sending it", async () => {
    render(<TagCreateInput tags={[{ id: "t-9", name: "Útivist" }]} onCreated={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(FIELD), "útivist{Enter}");

    expect(screen.getByRole("alert")).toHaveTextContent("Merkimiði með þessu nafni er þegar til");
    expect(screen.getByLabelText(FIELD)).toHaveAttribute("aria-invalid", "true");
    expect(createTag).not.toHaveBeenCalled();
  });

  it("keeps the field enabled and focused while saving; only the button waits (sc-637)", async () => {
    let finish: (tag: unknown) => void = () => {};
    createTag.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<TagCreateInput onCreated={vi.fn()} />);
    const field = screen.getByLabelText(FIELD);

    await userEvent.type(field, "Útivist{Enter}");

    expect(screen.getByRole("button", { name: "Bý til…" })).toBeDisabled();
    expect(field).toBeEnabled();
    expect(field).toHaveFocus();
    finish({ id: "t-1", name: "Útivist" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Búa til" })).toBeEnabled());
  });

  it("shows a 409 from the server as the duplicate message, chosen by status", async () => {
    createTag.mockRejectedValue(new TagRequestError(409, "whatever the backend says"));
    render(<TagCreateInput onCreated={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(FIELD), "Útivist{Enter}");

    expect(await screen.findByText(/þegar til\. Veldu annað nafn\./)).toBeInTheDocument();
    expect(screen.getByLabelText(FIELD)).toHaveFocus();
  });

  it("shows the counter from 45 characters", async () => {
    render(<TagCreateInput onCreated={vi.fn()} />);
    const field = screen.getByLabelText(FIELD);

    await userEvent.type(field, "a".repeat(44));
    expect(screen.queryByText("44 / 50")).not.toBeInTheDocument();
    await userEvent.type(field, "a");
    expect(screen.getByText("45 / 50")).toBeInTheDocument();
  });
});
