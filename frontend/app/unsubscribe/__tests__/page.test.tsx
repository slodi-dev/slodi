import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => searchParams }));

import UnsubscribePage from "../page";

const TOKEN = "550e8400-e29b-41d4-a716-446655440000";
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UnsubscribePage", () => {
  it("only checks the token on load and unsubscribes on confirm", async () => {
    searchParams = new URLSearchParams({ token: TOKEN });
    fetchMock.mockResolvedValueOnce(Response.json({ subscribed: true, changed: false }));

    render(<UnsubscribePage />);

    const button = await screen.findByRole("button", { name: "Afskrá mig" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/emails/unsubscribe?token=${TOKEN}`);
    expect(fetchMock.mock.calls[0][1]).toBeUndefined();

    fetchMock.mockResolvedValueOnce(Response.json({ subscribed: false, changed: true }));
    fireEvent.click(button);

    expect(
      await screen.findByText("Netfangið þitt er ekki lengur á póstlistanum okkar.")
    ).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/emails/unsubscribe");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ token: TOKEN });
  });

  it("says 'already unsubscribed' for a used link and offers to resubscribe", async () => {
    searchParams = new URLSearchParams({ token: TOKEN });
    fetchMock.mockResolvedValueOnce(Response.json({ subscribed: false, changed: false }));

    render(<UnsubscribePage />);

    expect(await screen.findByText("Netfangið er þegar afskráð.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Afskrá mig" })).not.toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(Response.json({ subscribed: true, changed: true }));
    fireEvent.click(screen.getByRole("button", { name: "Skrá mig aftur" }));

    expect(await screen.findByText("Netfangið er aftur komið á póstlistann.")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/emails/unsubscribe");
    expect(JSON.parse(init.body)).toEqual({ token: TOKEN, action: "resubscribe" });
  });

  it("treats a second confirm (already unsubscribed) as success", async () => {
    searchParams = new URLSearchParams({ token: TOKEN });
    fetchMock.mockResolvedValueOnce(Response.json({ subscribed: true, changed: false }));

    render(<UnsubscribePage />);

    const button = await screen.findByRole("button", { name: "Afskrá mig" });
    fetchMock.mockResolvedValueOnce(Response.json({ subscribed: false, changed: false }));
    fireEvent.click(button);

    expect(await screen.findByText("Netfangið er þegar afskráð.")).toBeInTheDocument();
  });

  it("explains the sample link from a test send without calling the backend", async () => {
    searchParams = new URLSearchParams({ token: "00000000-0000-0000-0000-000000000000" });

    render(<UnsubscribePage />);

    expect(await screen.findByText(/sýnishorn af afskráningarhlekk/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Afskrá mig" })).not.toBeInTheDocument();
  });

  it("shows the error and no button for a token that never existed", async () => {
    searchParams = new URLSearchParams({ token: TOKEN });
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: "Hlekkurinn er ógildur." }, { status: 404 })
    );

    render(<UnsubscribePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Hlekkurinn er ógildur.");
    expect(screen.queryByRole("button", { name: "Afskrá mig" })).not.toBeInTheDocument();
  });

  it("offers no way to unsubscribe by typing an email address", async () => {
    searchParams = new URLSearchParams({ email: "someone@example.com" });

    render(<UnsubscribePage />);

    await waitFor(() =>
      expect(screen.getByText(/nota hlekkinn neðst í tölvupósti/)).toBeInTheDocument()
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Afskrá mig" })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
