/**
 * Uploads API Service
 *
 * Files never travel through the backend. The API mints a short-lived,
 * write-only SAS URL scoped to a single blob, and the browser PUTs the bytes
 * straight to Azure Blob Storage. The returned `blob_url` is the stable,
 * token-free URL that gets persisted on the content row.
 */

import { buildApiUrl } from "@/lib/api-utils";
import { fetchWithAuth } from "@/lib/api";

export type UploadPurpose = "image" | "document";

export type SasResponse = {
  /** Short-lived, write-only URL to PUT the file to. */
  upload_url: string;
  /** Stable URL of the blob once uploaded (no token). */
  blob_url: string;
  expires_at: string;
};

/** MIME types the backend will issue an image SAS for. */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Client-side size guard. The backend does not enforce this — Azure would take it. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Ask the backend for a write-only SAS URL for a single upload.
 */
export async function getUploadUrl(
  contentType: string,
  purpose: UploadPurpose,
  getToken: () => Promise<string | null>
): Promise<SasResponse> {
  return fetchWithAuth<SasResponse>(
    buildApiUrl("/uploads/sas"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_type: contentType, purpose }),
    },
    getToken
  );
}

export type DownloadSasResponse = {
  download_url: string;
  expires_at: string;
};

/**
 * The blob path inside its container, which is what the download endpoint
 * signs — `uploads/documents/{userId}/{blobId}`.
 *
 * Documents live in a **private** container, unlike images. Azure answers an
 * unauthenticated read with `ResourceNotFound` rather than 403 so it does not
 * leak whether the blob exists, which is why linking the stored URL directly
 * looked like a missing file rather than a permissions problem.
 */
export function documentBlobName(url: string): string | null {
  const match = /\/documents\/(uploads\/documents\/[0-9a-fA-F-]{36}\/[0-9a-fA-F-]{36})$/.exec(url);
  return match ? match[1] : null;
}

/**
 * Mint a short-lived read URL for a document.
 *
 * The link is good for fifteen minutes and carries a `content-disposition`
 * that forces a download, so a file with a disguised type cannot be rendered —
 * and executed — in the browser. That is the reason documents are not simply
 * public, and the reason this round trip exists.
 */
export async function getDownloadUrl(
  blobName: string,
  filename: string | null,
  getToken: () => Promise<string | null>
): Promise<DownloadSasResponse> {
  return fetchWithAuth<DownloadSasResponse>(
    buildApiUrl("/uploads/sas/download"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blob_name: blobName, filename }),
    },
    getToken
  );
}

/**
 * PUT a file to a SAS URL, reporting progress.
 *
 * Uses XMLHttpRequest rather than fetch because fetch has no upload-progress
 * event. `x-ms-blob-type` is required by Azure for block blob writes, and
 * `Content-Type` must match the type the SAS was minted for — Azure rejects a
 * mismatch.
 */
export function putToBlob(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload aborted", "AbortError"));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("x-ms-blob-type", "BlockBlob");
    xhr.setRequestHeader("Content-Type", file.type);

    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort);

    const cleanup = () => signal?.removeEventListener("abort", onAbort);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error("Upload failed: network error"));
    };

    xhr.onabort = () => {
      cleanup();
      reject(new DOMException("Upload aborted", "AbortError"));
    };

    xhr.send(file);
  });
}

/**
 * Full upload round-trip: request a SAS, PUT the bytes, return the clean blob URL
 * to persist on the content row.
 */
export async function uploadFile(
  file: File,
  purpose: UploadPurpose,
  getToken: () => Promise<string | null>,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<string> {
  const { upload_url, blob_url } = await getUploadUrl(file.type, purpose, getToken);
  await putToBlob(upload_url, file, onProgress, signal);
  return blob_url;
}
