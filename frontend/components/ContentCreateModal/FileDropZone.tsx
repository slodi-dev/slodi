"use client";

import React, { useRef, useState } from "react";
import styles from "./ContentCreateModal.module.css";
import { cn } from "@/lib/util";
import { useAuth } from "@/contexts/AuthContext";
import { uploadFile } from "@/services/uploads.service";

export type Attachment = { name: string; url: string; content_type?: string };

/* Both allowlists must match `ALLOWED_MIME_TYPES` in
   `app/domain/upload_constraints.py`. Offering a format the SAS endpoint will
   refuse is worse than not offering it. */
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const DOC_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  // Word, Excel, PowerPoint — current and legacy
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // OpenDocument — the ISO open standard LibreOffice writes
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
];

/** Must match `MAX_UPLOAD_BYTES` in `app/domain/upload_constraints.py`.
 *  A guard, not a control: the SAS lets the client PUT any size straight to
 *  Azure, so this saves a doomed upload rather than preventing an oversized
 *  one. Real enforcement has to happen when the record is saved. */
const MAX_BYTES: Record<"image" | "document", number> = {
  image: 10 * 1024 * 1024,
  document: 25 * 1024 * 1024,
};

const mb = (n: number) => `${Math.round(n / (1024 * 1024))} MB`;
const ACCEPT = [
  ...IMAGE_TYPES,
  ...DOC_TYPES,
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".md",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".odt",
  ".ods",
  ".odp",
].join(",");

/** Browsers frequently send an empty or wrong type for .md and .txt. */
function typeFor(file: File): string {
  if (file.type && [...IMAGE_TYPES, ...DOC_TYPES].includes(file.type)) return file.type;
  if (/\.md$/i.test(file.name)) return "text/markdown";
  if (/\.txt$/i.test(file.name)) return "text/plain";
  if (/\.docx$/i.test(file.name)) return DOC_TYPES[2];
  if (/\.doc$/i.test(file.name)) return "application/msword";
  if (/\.pdf$/i.test(file.name)) return "application/pdf";
  if (/\.xlsx$/i.test(file.name))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (/\.xls$/i.test(file.name)) return "application/vnd.ms-excel";
  if (/\.pptx$/i.test(file.name))
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (/\.ppt$/i.test(file.name)) return "application/vnd.ms-powerpoint";
  if (/\.odt$/i.test(file.name)) return "application/vnd.oasis.opendocument.text";
  if (/\.ods$/i.test(file.name)) return "application/vnd.oasis.opendocument.spreadsheet";
  if (/\.odp$/i.test(file.name)) return "application/vnd.oasis.opendocument.presentation";
  return file.type || "application/octet-stream";
}

/**
 * One drop zone for pictures and documents, sorted by type.
 *
 * A leader has the photo and the leiðbeining in the same folder. Two separate
 * uploaders make them decide which control takes which file before they can
 * start; one zone that reads the type does not. Images become *the* picture —
 * a bank entry has one — and everything else joins the document list.
 *
 * **Dragging is never the only way in.** A drop zone cannot be reached by
 * keyboard at all, so the same element is a button that opens the file picker,
 * and every result is announced politely rather than only appearing.
 */
export default function FileDropZone({
  image,
  documents,
  onImage,
  onDocuments,
}: {
  image: string;
  documents: Attachment[];
  onImage: (url: string) => void;
  onDocuments: (next: Attachment[]) => void;
}) {
  const { getToken } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const [failed, setFailed] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);

  async function take(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setFailed(null);
    const added: Attachment[] = [];
    let picture: { url: string; name: string } | null = null;

    for (const file of Array.from(files)) {
      const contentType = typeFor(file);
      const isImage = IMAGE_TYPES.includes(contentType);
      if (!isImage && !DOC_TYPES.includes(contentType)) {
        // Name the file and the reason. "Unsupported file" after dropping five
        // of them tells the reader nothing about which one to convert.
        setFailed(`„${file.name}“ er ekki á sniði sem bankinn tekur við.`);
        continue;
      }
      const purpose = isImage ? "image" : "document";
      if (file.size > MAX_BYTES[purpose]) {
        // Name the file and the ceiling. "File too large" leaves the reader
        // guessing at both which one and by how much.
        setFailed(`„${file.name}“ er ${mb(file.size)} — hámarkið er ${mb(MAX_BYTES[purpose])}.`);
        continue;
      }
      try {
        const payload =
          contentType === file.type ? file : new File([file], file.name, { type: contentType });
        const url = await uploadFile(payload, purpose, getToken);
        if (isImage) picture = { url, name: file.name };
        else added.push({ name: file.name, url, content_type: contentType });
      } catch (e) {
        setFailed(
          `Ekki tókst að hlaða upp „${file.name}“. ${e instanceof Error ? e.message : ""}`.trim()
        );
      }
    }

    if (picture) {
      onImage(picture.url);
      setImageName(picture.name);
    }
    if (added.length) onDocuments([...documents, ...added]);

    const parts = [
      picture ? "mynd" : null,
      added.length ? `${added.length} skjal${added.length === 1 ? "" : "i"}` : null,
    ].filter(Boolean);
    if (parts.length) setSaid(`${parts.join(" og ")} komin inn.`);

    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={styles.fld}>
      <span className={styles.lab} id="drop-label">
        Mynd og önnur gögn
      </span>
      <div
        className={cn(styles.drop, over && styles.dropOver)}
        // preventDefault on dragover as well as drop, or the browser navigates
        // away to the dropped file and the half-filled form is gone.
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void take(e.dataTransfer.files);
        }}
      >
        <div className={styles.dropHead}>
          <p className={styles.dropText}>
            <strong>Dragðu skrár hingað</strong> — myndir verða forsíðumynd, annað fer í
            gagnalistann. PDF, Word, Excel, PowerPoint, OpenDocument, texti og Markdown — mest 25 MB
            hvert.
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="sl-sr-only"
            id="drop-input"
            onChange={(e) => void take(e.target.files)}
          />
          {/* Dragging is unreachable from a keyboard, so the picker is the
              primary control rather than a fallback. */}
          <button
            type="button"
            className={cn(styles.btn, styles.btnGhost)}
            onClick={() => inputRef.current?.click()}
          >
            {busy && <span className={styles.spin} aria-hidden="true" />}
            Velja skrár
          </button>
        </div>

        {image && (
          <div className={styles.preview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.previewImg} src={image} alt="" />
            <span className={styles.previewName}>{imageName ?? "Forsíðumynd"}</span>
            <button
              type="button"
              className={cn(styles.btn, styles.btnGhost)}
              onClick={() => {
                onImage("");
                setImageName(null);
              }}
            >
              Fjarlægja mynd
            </button>
          </div>
        )}

        {documents.length > 0 && (
          <ul className={styles.chips} aria-labelledby="drop-label">
            {documents.map((doc) => (
              <li key={doc.url} className={styles.chip}>
                <span className={styles.chipText}>{doc.name}</span>
                <button
                  type="button"
                  className={styles.chipBtn}
                  aria-label={`Fjarlægja ${doc.name}`}
                  onClick={() => onDocuments(documents.filter((d) => d.url !== doc.url))}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="18" y1="6" x2="6" y2="18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {failed && (
        <p className={styles.err} role="alert">
          {failed}
        </p>
      )}
      {/* What arrived, for anyone who cannot see it appear. */}
      <p className="sl-sr-only" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}
