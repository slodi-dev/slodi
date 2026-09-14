"use client";

import { useEffect, useState } from "react";

import Modal from "@/components/Modal/Modal";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/util";
import { documentBlobName, getDownloadUrl } from "@/services/uploads.service";

import styles from "./DocumentViewer.module.css";

export type ViewableDocument = {
  name: string;
  url: string;
  content_type?: string | null;
};

/** Formats to `1,2 MB` — Icelandic uses a comma for the decimal mark. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** What the browser can render on its own, without a plugin or a converter. */
function previewKind(type: string, name: string): "pdf" | "image" | "text" | "none" {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (type === "application/pdf" || ext === "pdf") return "pdf";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("text/") || ext === "md" || ext === "txt") return "text";
  return "none";
}

/**
 * Read a document without leaving the page.
 *
 * The bytes are fetched rather than linked. Two reasons, and both are
 * deliberate upstream decisions rather than workarounds:
 *
 *  - Documents live in a **private** container, so the stored URL is not
 *    readable on its own. Azure answers an unauthenticated read with
 *    `ResourceNotFound` rather than 403, so a direct link looked like a
 *    missing file rather than a permissions problem.
 *  - The signed URL carries `content-disposition: attachment`, so that a file
 *    with a disguised type cannot be rendered — and executed — in the browser.
 *    Pointing an `iframe` at it would download rather than display.
 *
 * Fetching sidesteps both: the response becomes a `Blob` whose only carried
 * property is its MIME type, and an object URL from that renders inline while
 * the original stays download-only. The object URL is revoked on close, since
 * a 3 MB PDF held per opened document adds up.
 */
export default function DocumentViewer({
  doc,
  open,
  onClose,
}: {
  doc: ViewableDocument | null;
  open: boolean;
  onClose: () => void;
}) {
  const { getToken } = useAuth();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const [type, setType] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !doc) return;

    let cancelled = false;
    let created: string | null = null;

    setLoading(true);
    setError(null);
    setObjectUrl(null);
    setSize(null);

    (async () => {
      try {
        const blobName = documentBlobName(doc.url);
        if (!blobName) throw new Error("Slóðin á skjalið er ógild.");

        const { download_url } = await getDownloadUrl(blobName, doc.name, getToken);
        const res = await fetch(download_url);
        if (!res.ok) throw new Error(`Skjalið svaraði með ${res.status}.`);

        const blob = await res.blob();
        if (cancelled) return;

        created = URL.createObjectURL(blob);
        setObjectUrl(created);
        setSize(blob.size);
        setType(blob.type || doc.content_type || "");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Ekki tókst að sækja skjalið.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [open, doc, getToken]);

  if (!doc) return null;

  const kind = previewKind(type || doc.content_type || "", doc.name);

  return (
    <Modal open={open} onClose={onClose} title={doc.name} size="wide">
      <div className={styles.viewer}>
        <div className={styles.frame}>
          {loading && (
            <p className={styles.status}>
              <span className={styles.spinner} aria-hidden="true" />
              Sæki skjalið…
            </p>
          )}

          {!loading && error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          {!loading && !error && objectUrl && kind === "pdf" && (
            <iframe src={objectUrl} title={doc.name} />
          )}

          {!loading && !error && objectUrl && kind === "image" && (
            /* eslint-disable-next-line @next/next/no-img-element -- object URL for an in-memory blob; the optimiser cannot fetch it */
            <img src={objectUrl} alt={doc.name} />
          )}

          {!loading && !error && objectUrl && kind === "text" && (
            <iframe src={objectUrl} title={doc.name} />
          )}

          {!loading && !error && objectUrl && kind === "none" && (
            <div className={styles.fallback}>
              <p>
                Ekki er hægt að skoða <strong>{doc.name}</strong> í vafranum.
              </p>
              <p>Sæktu skjalið til að opna það í forritinu sem á við.</p>
            </div>
          )}
        </div>

        <div className={styles.bar}>
          <p className={styles.meta}>
            {size !== null ? formatBytes(size) : ""}
            {size !== null && type ? " · " : ""}
            {type}
          </p>

          {objectUrl && (
            <a className={cn(styles.action, styles.primary)} href={objectUrl} download={doc.name}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 4v11" />
                <path d="m7.5 11 4.5 4.5 4.5-4.5" />
                <path d="M5 19h14" />
              </svg>
              Sækja skjalið
            </a>
          )}

          <button type="button" className={styles.action} onClick={onClose}>
            Loka
          </button>
        </div>
      </div>
    </Modal>
  );
}
