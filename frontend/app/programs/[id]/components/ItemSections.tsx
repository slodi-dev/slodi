"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { formatIcelandicDate } from "@/lib/format";
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

/**
 * Turn free-text instructions into steps.
 *
 * A leader writing steps either uses line breaks or types them inline — „1. …
 * 2. … 3. …" in one paragraph is just as common, and splitting only on
 * newlines rendered that as a wall of prose with the numbers buried in it. So
 * fall back to splitting on the inline markers, and strip the marker from each
 * step because the `<ol>` supplies the number itself.
 *
 * A single block with no markers stays prose — one numbered item is worse than
 * a paragraph.
 */
export function splitSteps(instructions: string | null | undefined): string[] {
  const text = (instructions ?? "").trim();
  if (!text) return [];

  const lines = text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1) return lines.map(stripMarker);

  const inline = text
    .split(/(?=\b\d{1,2}[.)]\s)/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (inline.length > 1) return inline.map(stripMarker);

  return [text];
}

function stripMarker(step: string): string {
  return step.replace(/^\d{1,2}[.)]\s*/, "").trim();
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
}) {
  const copy = kindCopy(program.content_type);

  const equipment = program.equipment ?? [];
  const documents = program.media?.documents ?? [];
  const tags = program.tags ?? [];

  const steps = splitSteps(program.instructions);

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
        {steps.length > 1 ? (
          <ol className={styles.steps}>
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        ) : steps.length === 1 ? (
          <p>{steps[0]}</p>
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
                  <Image src={img.url} alt="" fill sizes="150px" unoptimized />
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
      />
    </div>
  );
}

function CommentSection({
  comments,
  canComment,
  onSubmit,
  currentUserName,
}: {
  comments: ContentComment[];
  canComment: boolean;
  onSubmit: (body: string) => Promise<void>;
  currentUserName: string | null;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

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
            <p className={styles.commentText}>{c.body}</p>
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
              <textarea
                id="ef-reply-input"
                ref={areaRef}
                rows={1}
                value={draft}
                placeholder="Hvernig gekk hjá þínum hóp?"
                onChange={(e) => setDraft(e.target.value)}
                disabled={sending}
              />
              <button
                type="submit"
                className={styles.send}
                aria-label="Senda athugasemd"
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
