import { describe, expect, it, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { getUploadUrl, putToBlob, uploadFile, documentBlobName } from "../uploads.service";

const FAKE_TOKEN = "fake-token";
const BLOB_URL = "https://acct.blob.core.windows.net/content-images/uploads/images/u1/f1";
const UPLOAD_URL = `${BLOB_URL}?sig=abc`;

const getToken = async () => FAKE_TOKEN;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const sasBody = {
  upload_url: UPLOAD_URL,
  blob_url: BLOB_URL,
  expires_at: "2026-08-13T12:15:00Z",
};

describe("uploads service — getUploadUrl", () => {
  // Typed against fetch itself. The bare `ReturnType<typeof vi.spyOn>` resolves
  // to a generic MockInstance that fetch's overloaded signature is not
  // assignable to, which fails `npm run typecheck`.
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("POSTs content_type and purpose and returns the SAS payload", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, sasBody));

    const result = await getUploadUrl("image/png", "image", getToken);

    expect(result).toEqual(sasBody);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/uploads/sas");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      content_type: "image/png",
      purpose: "image",
    });
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${FAKE_TOKEN}`);
  });

  it("throws when the backend rejects the MIME type", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(415, { detail: "Content type 'image/gif' is not allowed for image uploads." })
    );

    await expect(getUploadUrl("image/gif", "image", getToken)).rejects.toThrow();
  });
});

// Minimal XMLHttpRequest double — jsdom's real one would attempt a network call.
class FakeXhr {
  static instances: FakeXhr[] = [];

  status = 200;
  statusText = "OK";
  upload = { onprogress: null as ((e: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  method?: string;
  url?: string;
  headers: Record<string, string> = {};
  body: unknown;
  aborted = false;

  constructor() {
    FakeXhr.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }

  send(body: unknown) {
    this.body = body;
  }

  abort() {
    this.aborted = true;
    this.onabort?.();
  }
}

function installFakeXhr() {
  FakeXhr.instances = [];
  vi.stubGlobal("XMLHttpRequest", FakeXhr as unknown as typeof XMLHttpRequest);
  return FakeXhr;
}

describe("uploads service — putToBlob", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PUTs the file with the Azure block-blob headers", async () => {
    installFakeXhr();
    const file = new File(["bytes"], "mynd.png", { type: "image/png" });

    const promise = putToBlob(UPLOAD_URL, file);
    const xhr = FakeXhr.instances[0];
    xhr.onload!();
    await promise;

    expect(xhr.method).toBe("PUT");
    expect(xhr.url).toBe(UPLOAD_URL);
    expect(xhr.headers["x-ms-blob-type"]).toBe("BlockBlob");
    expect(xhr.headers["Content-Type"]).toBe("image/png");
    expect(xhr.body).toBe(file);
  });

  it("reports progress percentages", async () => {
    installFakeXhr();
    const file = new File(["bytes"], "mynd.png", { type: "image/png" });
    const seen: number[] = [];

    const promise = putToBlob(UPLOAD_URL, file, (p) => seen.push(p));
    const xhr = FakeXhr.instances[0];
    xhr.upload.onprogress!({ lengthComputable: true, loaded: 25, total: 100 } as ProgressEvent);
    xhr.upload.onprogress!({ lengthComputable: true, loaded: 100, total: 100 } as ProgressEvent);
    xhr.onload!();
    await promise;

    expect(seen).toEqual([25, 100]);
  });

  it("rejects on a non-2xx status", async () => {
    installFakeXhr();
    const file = new File(["bytes"], "mynd.png", { type: "image/png" });

    const promise = putToBlob(UPLOAD_URL, file);
    const xhr = FakeXhr.instances[0];
    xhr.status = 403;
    xhr.statusText = "Forbidden";
    xhr.onload!();

    await expect(promise).rejects.toThrow("Upload failed: 403 Forbidden");
  });

  it("rejects with AbortError when the signal fires", async () => {
    installFakeXhr();
    const file = new File(["bytes"], "mynd.png", { type: "image/png" });
    const controller = new AbortController();

    const promise = putToBlob(UPLOAD_URL, file, undefined, controller.signal);
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeXhr.instances[0].aborted).toBe(true);
  });
});

describe("uploads service — uploadFile", () => {
  // Typed against fetch itself. The bare `ReturnType<typeof vi.spyOn>` resolves
  // to a generic MockInstance that fetch's overloaded signature is not
  // assignable to, which fails `npm run typecheck`.
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("returns the token-free blob URL after a successful PUT", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, sasBody));
    installFakeXhr();
    const file = new File(["bytes"], "mynd.png", { type: "image/png" });

    const promise = uploadFile(file, "image", getToken);
    // Let getUploadUrl's await chain settle so the XHR exists.
    await vi.waitFor(() => expect(FakeXhr.instances.length).toBe(1));
    FakeXhr.instances[0].onload!();

    await expect(promise).resolves.toBe(BLOB_URL);
    expect(await promise).not.toContain("sig=");
  });
});

describe("documentBlobName", () => {
  const ID = "dac699a0-06a2-409e-b398-da3aa12064f3";
  const BLOB = "2665be25-1e67-4686-9aca-57d9a2df6eca";
  const url = `https://slodiblobstorage.blob.core.windows.net/documents/uploads/documents/${ID}/${BLOB}`;

  it("extracts the path the download endpoint signs", () => {
    // The container segment is also called `documents`, so a naive split on
    // that word takes the wrong half.
    expect(documentBlobName(url)).toBe(`uploads/documents/${ID}/${BLOB}`);
  });

  it("refuses anything that is not a document blob", () => {
    // Images live in a public container and never go through the signer.
    expect(
      documentBlobName(
        "https://slodiblobstorage.blob.core.windows.net/content-images/uploads/images/a/b"
      )
    ).toBeNull();
    expect(documentBlobName("https://example.com/evil.pdf")).toBeNull();
    expect(documentBlobName("")).toBeNull();
  });

  it("refuses a path with extra segments appended", () => {
    expect(documentBlobName(`${url}/../../secret`)).toBeNull();
  });
});
