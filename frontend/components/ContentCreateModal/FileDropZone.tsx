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
/** „gatlisti.pdf" → „PDF". Falls back to the MIME subtype, then to „SKJAL". */
function extOf(doc: Attachment): string {
  const ext = doc.name.split(".").pop();
  if (ext && ext !== doc.name && ext.length <= 5) return ext.toUpperCase();
  const sub = doc.content_type?.split("/").pop();
  return sub ? sub.slice(0, 4).toUpperCase() : "SKJAL";
}

export default function FileDropZone({
  images,
  documents,
  onAddImages,
  onRemoveImage,
  onReorderImages,
  onAddDocuments,
  onRemoveDocument,
  onReorderDocuments,
  onPreviewDocument,
}: {
  /** Ordered. The first is the one the item leads with. */
  images: Attachment[];
  documents: Attachment[];
  onAddImages: (added: Attachment[]) => void;
  onRemoveImage: (url: string) => void;
  onReorderImages: (from: number, to: number) => void;
  /** Emit what arrived, not the whole list — see the note in TagPicker. */
  onAddDocuments: (added: Attachment[]) => void;
  onRemoveDocument: (url: string) => void;
  onReorderDocuments: (from: number, to: number) => void;
  /** Omitted where there is nowhere to show a preview. */
  onPreviewDocument?: (doc: Attachment) => void;
}) {
  const { getToken } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const [failed, setFailed] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  /* Separate from the image indices: one shared pair would let a document be
     dropped into the picture order. */
  const [docFrom, setDocFrom] = useState<number | null>(null);
  const [docOver, setDocOver] = useState<number | null>(null);

  async function take(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setFailed(null);
    setSkipped(null);
    const added: Attachment[] = [];
    const pictures: Attachment[] = [];

    // Every image is kept now, in the order they arrived. The first in the
    // list is the one the item leads with, and it can be changed by reordering
    // rather than by re-uploading.
    const chosen = Array.from(files);

    for (const file of chosen) {
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
        if (isImage) pictures.push({ name: file.name, url, content_type: contentType });
        else added.push({ name: file.name, url, content_type: contentType });
      } catch (e) {
        setFailed(
          `Ekki tókst að hlaða upp „${file.name}“. ${e instanceof Error ? e.message : ""}`.trim()
        );
      }
    }

    if (pictures.length) onAddImages(pictures);
    if (added.length) onAddDocuments(added);

    const parts = [
      pictures.length ? `${pictures.length} mynd${pictures.length === 1 ? "" : "ir"}` : null,
      added.length ? `${added.length} skjal${added.length === 1 ? "" : "i"}` : null,
    ].filter(Boolean);
    if (parts.length) setSaid(`${parts.join(" og ")} komin inn.`);

    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={styles.fld}>
      <span className={styles.lab} id="drop-label">
        Myndir og skjöl
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
            <strong>Dragðu skrár hingað</strong> — myndir raðast í myndalistann og sú fyrsta verður
            forsíðumyndin, annað fer í skjalalistann. PDF, Word, Excel, PowerPoint, OpenDocument,
            texti og Markdown — mest 25 MB hvert.
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

        {images.length > 0 && (
          <>
            <p className={styles.shotsHint}>Fyrsta myndin er forsíðumyndin. Dragðu til að raða.</p>
            <ul className={styles.shots}>
              {images.map((img, i) => (
                <li
                  key={img.url}
                  className={cn(styles.shot, dragOver === i && styles.shotOver)}
                  draggable
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(i);
                  }}
                  onDragLeave={() => setDragOver((v) => (v === i ? null : v))}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragFrom !== null && dragFrom !== i) onReorderImages(dragFrom, i);
                    setDragFrom(null);
                    setDragOver(null);
                  }}
                  onDragEnd={() => {
                    setDragFrom(null);
                    setDragOver(null);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob URL, not optimisable */}
                  <img className={styles.shotImg} src={img.url} alt="" />
                  {/*
                    Every image carries its position, not just the first. A
                    lone „Forsíðumynd" badge says which one leads but leaves
                    the rest to be counted by eye, which is the thing the
                    reader is reordering. The number is prefixed for a screen
                    reader, where a bare "3" means nothing.
                  */}
                  <span className={cn(styles.shotTag, i === 0 && styles.shotTagHero)}>
                    {i === 0 ? (
                      "Forsíðumynd"
                    ) : (
                      <>
                        <span className={styles.srOnly}>Mynd </span>
                        {i + 1}
                      </>
                    )}
                  </span>
                  <span className={styles.shotName}>{img.name}</span>
                  {/*
                    Dragging is unreachable from a keyboard, so the order is
                    also changeable with two buttons. Without them the hero
                    image could only be chosen with a mouse.
                  */}
                  <span className={styles.shotActs}>
                    <button
                      type="button"
                      className={styles.shotBtn}
                      aria-label={`Færa ${img.name} framar`}
                      disabled={i === 0}
                      onClick={() => onReorderImages(i, i - 1)}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className={styles.shotBtn}
                      aria-label={`Færa ${img.name} aftar`}
                      disabled={i === images.length - 1}
                      onClick={() => onReorderImages(i, i + 1)}
                    >
                      →
                    </button>
                    <button
                      type="button"
                      className={styles.shotBtn}
                      aria-label={`Fjarlægja ${img.name}`}
                      onClick={() => onRemoveImage(img.url)}
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {documents.length > 0 && (
          <>
            <p className={styles.shotsHint}>Skjölin sem fylgja einingunni. Dragðu til að raða.</p>
            <ul className={styles.shots}>
              {documents.map((doc, i) => (
                <li
                  key={doc.url}
                  className={cn(styles.shot, docOver === i && styles.shotOver)}
                  draggable
                  onDragStart={() => setDocFrom(i)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDocOver(i);
                  }}
                  onDragLeave={() => setDocOver((v) => (v === i ? null : v))}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (docFrom !== null && docFrom !== i) onReorderDocuments(docFrom, i);
                    setDocFrom(null);
                    setDocOver(null);
                  }}
                  onDragEnd={() => {
                    setDocFrom(null);
                    setDocOver(null);
                  }}
                >
                  {/*
                    A tile rather than a rendered page. Thumbnailing every
                    document would mean fetching all of them — and minting a
                    signature for each — the moment the form opens, most of
                    which nobody looks at. The kind and the name identify it;
                    the tile opens the real preview.
                  */}
                  <button
                    type="button"
                    className={styles.docThumb}
                    onClick={() => onPreviewDocument?.(doc)}
                    aria-label={`Skoða ${doc.name}`}
                    disabled={!onPreviewDocument}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                      <path d="M14 3v5h5" />
                    </svg>
                    <span className={styles.docExt}>{extOf(doc)}</span>
                  </button>
                  <span className={cn(styles.shotTag, styles.shotTagDoc)}>
                    <span className={styles.srOnly}>Skjal </span>
                    {i + 1}
                  </span>
                  <span className={styles.shotName} title={doc.name}>
                    {doc.name}
                  </span>
                  <span className={styles.shotActs}>
                    <button
                      type="button"
                      className={styles.shotBtn}
                      aria-label={`Færa ${doc.name} framar`}
                      disabled={i === 0}
                      onClick={() => onReorderDocuments(i, i - 1)}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className={styles.shotBtn}
                      aria-label={`Færa ${doc.name} aftar`}
                      disabled={i === documents.length - 1}
                      onClick={() => onReorderDocuments(i, i + 1)}
                    >
                      →
                    </button>
                    <button
                      type="button"
                      className={styles.shotBtn}
                      aria-label={`Fjarlægja ${doc.name}`}
                      onClick={() => onRemoveDocument(doc.url)}
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {failed && (
        <p className={styles.err} role="alert">
          {failed}
        </p>
      )}
      {skipped && (
        <p className={styles.help} role="status">
          {skipped}
        </p>
      )}
      {/* What arrived, for anyone who cannot see it appear. */}
      <p className="sl-sr-only" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}
