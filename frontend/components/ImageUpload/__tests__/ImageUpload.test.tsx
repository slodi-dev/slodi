import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImageUpload from "../ImageUpload";

// ── Mock dependencies ────────────────────────────────────────────────────────

const mockUploadFile = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ getToken: async () => "fake-token" }),
}));

vi.mock("@/services/uploads.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/uploads.service")>();
  return { ...actual, uploadFile: (...args: unknown[]) => mockUploadFile(...args) };
});

vi.mock("next/image", () => ({
  default: ({ src, alt }: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src as string} alt={alt as string} />
  ),
}));

const BLOB_URL = "https://acct.blob.core.windows.net/content-images/uploads/images/u1/f1";

function pngFile(name = "mynd.png", size = 1024) {
  const file = new File(["x"], name, { type: "image/png" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("ImageUpload", () => {
  beforeEach(() => {
    mockUploadFile.mockReset();
  });

  it("uploads the picked file and reports the blob URL", async () => {
    mockUploadFile.mockResolvedValue(BLOB_URL);
    const onChange = vi.fn();
    render(<ImageUpload value="" onChange={onChange} />);

    await userEvent.upload(screen.getByLabelText("Mynd"), pngFile());

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(BLOB_URL));
    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.any(File),
      "image",
      expect.any(Function),
      expect.any(Function),
      expect.any(AbortSignal)
    );
  });

  it("rejects a file over 5 MB without calling the upload", async () => {
    const onChange = vi.fn();
    render(<ImageUpload value="" onChange={onChange} />);

    await userEvent.upload(screen.getByLabelText("Mynd"), pngFile("stor.png", 6 * 1024 * 1024));

    expect(await screen.findByRole("alert")).toHaveTextContent("Myndin má mest vera 5 MB");
    expect(mockUploadFile).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  // `accept` only filters the OS file dialog — a user can still pick "all files",
  // so the component re-checks the MIME type itself. fireEvent bypasses the
  // accept filter that userEvent.upload applies, exercising that path.
  it("rejects a disallowed MIME type without calling the upload", async () => {
    const onChange = vi.fn();
    render(<ImageUpload value="" onChange={onChange} />);

    const input = screen.getByLabelText("Mynd") as HTMLInputElement;
    const gif = new File(["x"], "mynd.gif", { type: "image/gif" });
    Object.defineProperty(input, "files", { value: [gif], configurable: true });
    fireEvent.change(input);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Aðeins JPG, PNG og WebP myndir eru leyfðar"
    );
    expect(mockUploadFile).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("surfaces an error when the upload fails", async () => {
    mockUploadFile.mockRejectedValue(new Error("boom"));
    const onChange = vi.fn();
    render(<ImageUpload value="" onChange={onChange} />);

    await userEvent.upload(screen.getByLabelText("Mynd"), pngFile());

    expect(await screen.findByRole("alert")).toHaveTextContent("Ekki tókst að hlaða upp mynd");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows a preview and clears it back to an empty value", async () => {
    const onChange = vi.fn();
    render(<ImageUpload value={BLOB_URL} onChange={onChange} />);

    expect(screen.getByAltText("Forskoðun myndar")).toHaveAttribute("src", BLOB_URL);
    expect(screen.getByRole("button", { name: "Skipta um mynd" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Fjarlægja mynd" }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("disables the picker while the parent form is disabled", () => {
    render(<ImageUpload value="" onChange={vi.fn()} disabled />);

    expect(screen.getByRole("button", { name: "Velja mynd" })).toBeDisabled();
    expect(screen.getByLabelText("Mynd")).toBeDisabled();
  });
});
