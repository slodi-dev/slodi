import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

beforeEach(() => {
  createTag.mockReset();
  createTag.mockResolvedValue({ id: "t-1", name: "Útivist" });
});

describe("creating a tag", () => {
  it("passes the signed-in user's token getter to the API", async () => {
    const onCreated = vi.fn();
    render(<TagCreateInput onCreated={onCreated} />);

    await userEvent.type(screen.getByRole("textbox"), "Útivist{Enter}");

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(createTag).toHaveBeenCalledWith({ name: "Útivist" }, getToken);
  });
});
