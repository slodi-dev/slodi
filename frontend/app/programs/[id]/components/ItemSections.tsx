"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import Button from "@/components/Button/Button";
import { formatIcelandicDate } from "@/lib/format";
import { isOptimisableImageUrl } from "@/lib/image-hosts";
import { cn } from "@/lib/util";
import type { ContentComment, Program } from "@/services/programs.service";
import type { ViewableDocument } from "@/components/DocumentViewer/DocumentViewer";

import styles from "../efnissida.module.css";
import { kindCopy } from "../kind";
import type { HeroImage } from "./ItemHero";

/** „Sigrún Þórsdóttir" → „SÞ". Two letters at most; one is fine. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** „skjal.pdf" → „PDF". Falls back to the MIME subtype, then to „SKJAL". */
function docKind(name: string, contentType?: string | null): string {
  const ext = name.split(".").pop();
  if (ext && ext.length <= 5 && ext !== name) return ext.toUpperCase();
  const sub = contentType?.split("/").pop();
  if (sub) return sub.slice(0, 4).toUpperCase();
  return "SKJAL";
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

/**
 * The body of the page: every section present, in order, on one scroll.
 *
 * There are no tabs. A tab hides how much there is behind it, and an empty tab
 * has to be either dimmed — which looks broken — or removed, which makes the
 * control change length between items. A section that has nothing simply says
 * so, in place.
 */
export default function ItemSections({
  program,
  images,
  heroIndex,
  onHeroIndexChange,
  comments,
  canComment,
  onSubmitComment,
  currentUserName,
  heroSlot,
  onOpenDocument,
  onReportComment,
  onRemoveComment,
  onEditComment,
  canEditComment,
  canRemoveComment,
}: {
  program: Program;
  images: HeroImage[];
  heroIndex: number;
  onHeroIndexChange: (next: number) => void;
  comments: ContentComment[];
  canComment: boolean;
  onSubmitComment: (body: string) => Promise<void>;
  currentUserName: string | null;
  heroSlot: React.ReactNode;
  onOpenDocument: (doc: ViewableDocument) => void;
  onReportComment: (c: ContentComment) => void;
  onRemoveComment: (c: ContentComment) => void;
  onEditComment: (c: ContentComment, body: string) => Promise<void>;
  canEditComment: (c: ContentComment) => boolean;
  canRemoveComment: (c: ContentComment) => boolean;
}) {
  const copy = kindCopy(program.content_type);

  const equipment = program.equipment ?? [];
  const documents = program.media?.documents ?? [];
  const tags = program.tags ?? [];

  const instructions = program.instructions?.trim();

  return (
    <div className={styles.sections}>
      {heroSlot}

      <section className={styles.sec} id="ef-yfirlit" aria-labelledby="h-yfirlit">
        <h2 className={styles.secTitle} id="h-yfirlit">
          {copy.about}
        </h2>
        {program.description ? (
          <p className={styles.lead}>{program.description}</p>
        ) : (
          <Empty>Engin lýsing fylgir.</Empty>
        )}
        {tags.length > 0 && (
          <>
            <p className={styles.subLabel}>Merkimiðar</p>
            <div className={styles.taglist}>
              {tags.map((tag) => (
                <span key={tag.id} className={styles.tag}>
                  {tag.name}
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      <section className={styles.sec} id="ef-leidbeiningar" aria-labelledby="h-leidbeiningar">
        <h2 className={styles.secTitle} id="h-leidbeiningar">
          Leiðbeiningar
        </h2>
        {/* As the author typed it: a line per paragraph, a blank line as a
            gap. Not numbered — pressing Enter to space text out does not make
            it a list of steps. */}
        {instructions ? (
          instructions
            .split("\n")
            .map((line, i) => (line.trim() ? <p key={i}>{line}</p> : <br key={i} />))
        ) : (
          <Empty>Engar leiðbeiningar fylgja.</Empty>
        )}
      </section>

      <section className={styles.sec} id="ef-bunadur" aria-labelledby="h-bunadur">
        <h2 className={styles.secTitle} id="h-bunadur">
          Búnaður
        </h2>
        {equipment.length ? (
          <ul className={styles.kit}>
            {equipment.map((item, i) => (
              <li key={`${item}-${i}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <Empty>Enginn búnaður tilgreindur.</Empty>
        )}
      </section>

      {(images.length > 1 || documents.length > 0) && (
        <section className={styles.sec} id="ef-myndir" aria-labelledby="h-myndir">
          <h2 className={styles.secTitle} id="h-myndir">
            Myndir og skjöl
          </h2>

          {images.length > 1 && (
            <div className={styles.shots}>
              {images.map((img, i) => (
                <button
                  key={img.url}
                  type="button"
                  className={styles.shot}
                  aria-current={i === heroIndex}
                  aria-label={`Sýna mynd ${i + 1}: ${img.alt}`}
                  onClick={() => onHeroIndexChange(i)}
                >
                  {/* Tiles are minmax(150px, 1fr) in a column of at most 760px, so
                      never wider than ~185px. */}
                  <Image
                    src={img.url}
                    alt=""
                    fill
                    sizes="185px"
                    unoptimized={!isOptimisableImageUrl(img.url)}
                  />
                </button>
              ))}
            </div>
          )}

          {documents.length > 0 && (
            <>
              <p className={styles.subLabel}>Skjöl</p>
              <div className={styles.docs}>
                {documents.map((doc) => (
                  <button
                    key={doc.url}
                    type="button"
                    className={styles.doc}
                    onClick={() => onOpenDocument(doc)}
                  >
                    <span className={styles.docKind}>{docKind(doc.name, doc.content_type)}</span>
                    <span className={styles.docName}>{doc.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <CommentSection
        comments={comments}
        canComment={canComment}
        onSubmit={onSubmitComment}
        currentUserName={currentUserName}
        onReportComment={onReportComment}
        onRemoveComment={onRemoveComment}
        onEditComment={onEditComment}
        canEditComment={canEditComment}
        canRemoveComment={canRemoveComment}
      />
    </div>
  );
}

function CommentSection({
  comments,
  canComment,
  onSubmit,
  currentUserName,
  onReportComment,
  onRemoveComment,
  onEditComment,
  canEditComment,
  canRemoveComment,
}: {
  comments: ContentComment[];
  canComment: boolean;
  onSubmit: (body: string) => Promise<void>;
  currentUserName: string | null;
  onReportComment: (c: ContentComment) => void;
  onRemoveComment: (c: ContentComment) => void;
  onEditComment: (c: ContentComment, body: string) => Promise<void>;
  canEditComment: (c: ContentComment) => boolean;
  canRemoveComment: (c: ContentComment) => boolean;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // One comment is edited at a time, in place.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function startEdit(c: ContentComment) {
    // Moving to another comment discards this edit, so it asks the same way.
    const current = comments.find((x) => x.id === editingId);
    if (current && editDraft.trim() !== current.body && !window.confirm("Henda breytingum?")) {
      return;
    }
    setEditingId(c.id);
    setEditDraft(c.body);
    setEditError(null);
  }

  function cancelEdit(c: ContentComment) {
    if (editDraft.trim() !== c.body && !window.confirm("Henda breytingum?")) return;
    setEditingId(null);
  }

  async function saveEdit(c: ContentComment) {
    const body = editDraft.trim();
    if (!body || editSaving) return;
    if (body === c.body) {
      setEditingId(null);
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await onEditComment(c, body);
      setEditingId(null);
    } catch (e) {
      // The box stays open so the rewritten text is not lost.
      setEditError(e instanceof Error ? e.message : "Ekki tókst að vista breytinguna.");
    } finally {
      setEditSaving(false);
    }
  }

  /* Autogrow: reset to auto first so the field can shrink again on delete,
     then take scrollHeight. The CSS max-height caps it and hands scrolling
     back to the textarea past roughly ten lines. */
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
    el.style.overflowY = el.scrollHeight > 320 ? "auto" : "hidden";
  }, [draft]);

  async function submit() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSubmit(body);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ekki tókst að senda athugasemdina.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className={styles.sec} id="ef-athugasemdir" aria-labelledby="h-athugasemdir">
      <h2 className={styles.secTitle} id="h-athugasemdir">
        Athugasemdir og endurmat
        {comments.length > 0 && <span className={styles.countPill}>{comments.length}</span>}
      </h2>

      <div className={styles.comments}>
        {comments.length === 0 && <Empty>Engar athugasemdir enn.</Empty>}

        {comments.map((c) => (
          <article key={c.id} className={styles.comment}>
            <span className={styles.avatar} aria-hidden="true">
              {initials(c.author_name)}
            </span>
            <div className={styles.commentHead}>
              <span className={styles.commentName}>{c.author_name}</span>
              <span className={styles.commentWhen}>{formatIcelandicDate(c.created_at)}</span>
            </div>
            {editingId === c.id ? (
              <form
                className={styles.commentEdit}
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveEdit(c);
                }}
              >
                <label className={styles.srOnly} htmlFor={`ef-edit-${c.id}`}>
                  Breyta athugasemd
                </label>
                <textarea
                  id={`ef-edit-${c.id}`}
                  value={editDraft}
                  rows={3}
                  autoFocus
                  onChange={(e) => setEditDraft(e.target.value)}
                  // Same keys as the reply box, plus Escape to back out.
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      void saveEdit(c);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEdit(c);
                    }
                  }}
                />
                {editError && (
                  <p className={styles.commentEditError} role="alert">
                    {editError}
                  </p>
                )}
                <div className={styles.commentEditActs}>
                  <Button variant="ghost" onClick={() => cancelEdit(c)} disabled={editSaving}>
                    Hætta við
                  </Button>
                  <Button type="submit" disabled={editSaving || !editDraft.trim()}>
                    {editSaving ? "Vista…" : "Vista"}
                  </Button>
                </div>
              </form>
            ) : (
              <p className={styles.commentText}>{c.body}</p>
            )}
            {/*
              Edit and remove show only to those the server allows
              (lib/permissions.ts), so a click never ends in a 403 nobody sees.
              Report shows on everyone else's comments: this is the one place a
              stranger writes free text under someone else's idea.
            */}
            <div className={styles.commentActs} hidden={editingId === c.id}>
              {canEditComment(c) && (
                <button
                  type="button"
                  className={styles.commentAct}
                  onClick={() => startEdit(c)}
                  aria-label="Breyta athugasemdinni þinni"
                  title="Breyta"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </svg>
                </button>
              )}
              {!canEditComment(c) && (
                <button
                  type="button"
                  className={styles.commentAct}
                  onClick={() => onReportComment(c)}
                  aria-label={`Tilkynna athugasemd frá ${c.author_name}`}
                  title="Tilkynna"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 21V4" />
                    <path d="M6 4.5h12l-2.8 4.2L18 13H6z" />
                  </svg>
                </button>
              )}
              {canRemoveComment(c) && (
                <button
                  type="button"
                  className={styles.commentAct}
                  onClick={() => onRemoveComment(c)}
                  aria-label={`Fjarlægja athugasemd frá ${c.author_name}`}
                  title="Fjarlægja"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 7h16" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M6 7l1 13h10l1-13" />
                    <path d="M9 7V4h6v3" />
                  </svg>
                </button>
              )}
            </div>
          </article>
        ))}

        {canComment && (
          <form
            className={styles.reply}
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className={cn(styles.avatar, styles.avatarMe)} aria-hidden="true">
              {initials(currentUserName ?? "")}
            </div>
            <div className={styles.replyField}>
              <label className={styles.srOnly} htmlFor="ef-reply-input">
                Skrifa athugasemd
              </label>
              <span id="ef-reply-hint" className={styles.srOnly}>
                Ýttu á Ctrl og Enter til að senda.
              </span>
              <textarea
                id="ef-reply-input"
                ref={areaRef}
                rows={1}
                value={draft}
                placeholder="Hvernig gekk hjá þínum hóp?"
                aria-describedby="ef-reply-hint"
                onChange={(e) => setDraft(e.target.value)}
                /*
                 * Ctrl/Cmd+Enter posts. Plain Enter has to stay a newline —
                 * this is a multi-line box and a comment about how a fundur
                 * went is often more than one line.
                 */
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                disabled={sending}
              />
              <button
                type="submit"
                className={styles.send}
                aria-label="Senda athugasemd"
                title="Senda — Ctrl+Enter"
                disabled={sending || !draft.trim()}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.9}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 3 10.5 13.5" />
                  <path d="M21 3 14.8 21l-4.3-7.5L3 9.2z" />
                </svg>
              </button>
            </div>
          </form>
        )}

        <span aria-live="polite" className={styles.srOnly}>
          {error ?? ""}
        </span>
        {error && <Empty>{error}</Empty>}
      </div>
    </section>
  );
}
