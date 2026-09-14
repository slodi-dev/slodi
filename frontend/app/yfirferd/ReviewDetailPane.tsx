"use client";

import React, { useState } from "react";
import Link from "next/link";
import Modal from "@/components/Modal/Modal";
import AuthorStandingPanel from "./AuthorStandingPanel";
import {
  CONTENT_TYPE_LABEL,
  REVIEW_STATE_LABEL,
  VISIBILITY_LABEL,
  type ReviewCommentVisibility,
  type ReviewDetail,
} from "@/services/moderation.service";
import { REPORT_REASON_LABEL } from "@/services/reports.service";
import styles from "./yfirferd.module.css";
import { cn } from "@/lib/util";
import { formatIcelandicDate } from "@/lib/format";

/** The type accent, so a Verkefni looks the same wherever a leader meets it. */
const TYPE_CLASS: Record<string, string> = {
  task: styles.typeTask,
  event: styles.typeEvent,
  program: styles.typeProgram,
};

/**
 * Openers, not templates.
 *
 * Most notes to an author start with one of a handful of sentences, and typing
 * them out forty times a shift is the biggest single time sink in the job.
 * They append rather than replace, so the reviewer still writes the part that
 * is about *this* item — a note that is only a canned sentence helps nobody.
 */
const CANNED = [
  "Takk fyrir innsendinguna. ",
  "Gætirðu bætt við leiðbeiningum um framkvæmdina? ",
  "Það vantar upplýsingar um búnað. ",
  "Gætirðu sett inn aldursbil? ",
  "Þetta á betur heima undir öðru efnisformi. ",
];

/** A range like "15–25 mín", or a single value, or nothing at all. */
function range(min: number | null, max: number | null, unit: string): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${min}–${max} ${unit}`;
  return `${min ?? max} ${unit}`;
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className={styles.fact}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue}>{value}</dd>
    </div>
  );
}

/**
 * The reading pane.
 *
 * The list can only afford two truncated lines per row, which is enough to
 * choose what to look at and not enough to judge it. Everything a decision
 * rests on lives here: the full text, what it needs, who wrote it, what people
 * objected to, and — once decided — who decided and when.
 */
export default function ReviewDetailPane({
  detail,
  loading,
  failed = false,
  busy,
  onAct,
  onComment,
  shareUrl,
}: {
  detail: ReviewDetail | null;
  loading: boolean;
  /** The load failed, as distinct from nothing being selected. */
  failed?: boolean;
  busy: boolean;
  onAct: (action: "approve" | "reject" | "hide" | "unhide") => void;
  onComment: (body: string, visibility: ReviewCommentVisibility) => Promise<void>;
  shareUrl: string | null;
}) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function submit(visibility: ReviewCommentVisibility) {
    if (!note.trim() || sending) return;
    setSending(true);
    try {
      await onComment(note, visibility);
      setNote("");
      setConfirming(false);
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <p className={styles.state}>Hleð…</p>;
  if (failed) {
    return (
      <p className={styles.state} role="alert">
        Ekki tókst að sækja efnið. Reyndu aftur eða veldu annað atriði.
      </p>
    );
  }
  if (!detail) {
    return <p className={styles.state}>Veldu efni til vinstri til að lesa það í heild.</p>;
  }

  // A field the backend has not shipped yet must cost this pane a section, not
  // the whole screen. A frontend can be deployed ahead of its API.
  const documents = detail.documents ?? [];
  const notes = detail.review_comments ?? [];
  const reports = detail.reports ?? [];

  const decided = detail.reviewed_at
    ? `${REVIEW_STATE_LABEL[detail.review_state]} af ${detail.reviewed_by_name ?? "óþekktum"} · ${formatIcelandicDate(
        detail.reviewed_at
      )}`
    : null;

  return (
    <article className={styles.detail} aria-live="polite">
      <header className={styles.detailHead}>
        <p className={styles.meta}>
          <span className={cn(styles.chip, styles.chipType, TYPE_CLASS[detail.content_type])}>
            {CONTENT_TYPE_LABEL[detail.content_type]}
          </span>
          <span>eftir {detail.author_name}</span>
          <span>{formatIcelandicDate(detail.created_at)}</span>
          {detail.hidden_at && <span className={cn(styles.chip, styles.chipWarning)}>Falið</span>}
          {detail.author_strikes > 0 && (
            <span className={cn(styles.chip, styles.chipWarning)}>
              {detail.author_strikes} áminning{detail.author_strikes === 1 ? "" : "ar"} áður
            </span>
          )}
        </p>
        <h2 className={styles.detailTitle}>{detail.name}</h2>
        {/* The record of what was done, stated plainly — this is the answer to
            "who approved this, and when?". */}
        {decided && <p className={styles.bodyMuted}>{decided}</p>}
        {detail.review_note && <p className={styles.reviewNote}>„{detail.review_note}“</p>}
      </header>

      {reports.length > 0 && (
        <section className={styles.reportsBox}>
          <h3 className={styles.sectionTitle}>Tilkynningar ({detail.reports.length})</h3>
          <ul className={styles.reportsList}>
            {reports.map((r) => (
              <li key={r.id}>
                <span className={r.reason === "unsafe" ? styles.reasonUrgent : styles.reason}>
                  {REPORT_REASON_LABEL[r.reason]}
                </span>{" "}
                {r.note ? `„${r.note}“` : <em>engin skýring gefin</em>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail.description && (
        <section>
          <h3 className={styles.sectionTitle}>Um efnið</h3>
          <p className={styles.detailBody}>{detail.description}</p>
        </section>
      )}

      {detail.instructions && (
        <section>
          <h3 className={styles.sectionTitle}>Leiðbeiningar</h3>
          <p className={styles.detailBody}>{detail.instructions}</p>
        </section>
      )}

      {detail.image && (
        <section>
          <h3 className={styles.sectionTitle}>Mynd</h3>
          {/* Plain <img>: the pane shows one image at a time and the URL is a
              blob URL the optimiser is not configured for. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.image} src={detail.image} alt="" />
        </section>
      )}

      {documents.length > 0 && (
        <section>
          <h3 className={styles.sectionTitle}>Skjöl</h3>
          <ul className={styles.documents}>
            {documents.map((doc) => (
              <li key={doc.url}>
                {/* New tab: a reviewer opening a PDF should not lose their
                    place in a fifty-item sweep. */}
                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                  {doc.name}
                </a>
                {doc.content_type && <span className={styles.docType}>{doc.content_type}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <dl className={styles.facts}>
        <Fact label="Lengd" value={range(detail.duration_min, detail.duration_max, "mín")} />
        <Fact
          label="Undirbúningur"
          value={range(detail.prep_time_min, detail.prep_time_max, "mín")}
        />
        <Fact label="Fjöldi" value={range(detail.count_min, detail.count_max, "þátttakendur")} />
        <Fact label="Kostnaður" value={detail.price != null ? `${detail.price} kr.` : null} />
        <Fact label="Staðsetning" value={detail.location} />
        <Fact label="Aldur" value={detail.age?.length ? detail.age.join(", ") : null} />
        <Fact
          label="Búnaður"
          value={detail.equipment?.length ? detail.equipment.join(", ") : null}
        />
        <Fact label="Merkimiðar" value={detail.tags.length ? detail.tags.join(", ") : null} />
      </dl>

      <AuthorStandingPanel
        authorId={detail.author_id}
        authorName={detail.author_name}
        summary={{
          reports: detail.author_reports_received ?? 0,
          strikes: detail.author_strikes ?? 0,
          spells: detail.author_suspension_count ?? 0,
          suspendedUntil: detail.author_suspended_until ?? null,
        }}
      />

      <section className={styles.notes}>
        <h3 className={styles.sectionTitle}>Athugasemdir yfirferðar</h3>
        {notes.length === 0 ? (
          <p className={styles.bodyMuted}>Engar athugasemdir enn.</p>
        ) : (
          <ul className={styles.noteList}>
            {notes.map((c) => (
              <li
                key={c.id}
                className={
                  c.visibility === "to_author" ? `${styles.note} ${styles.noteSent}` : styles.note
                }
              >
                <p className={styles.noteMeta}>
                  {/* The badge is the point: a reviewer must be able to see at a
                      glance whether the author was told. */}
                  <span
                    className={
                      c.visibility === "to_author" ? styles.sentBadge : styles.internalBadge
                    }
                  >
                    {VISIBILITY_LABEL[c.visibility]}
                  </span>
                  <span>{c.author_name ?? "óþekktur"}</span>
                  <span>{formatIcelandicDate(c.created_at)}</span>
                </p>
                <p className={styles.detailBody}>{c.body}</p>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.canned}>
          {CANNED.map((opener) => (
            <button
              key={opener}
              type="button"
              className={styles.cannedBtn}
              onClick={() => setNote((n) => (n ? `${n.trimEnd()} ${opener}` : opener))}
            >
              {opener.trim()}
            </button>
          ))}
        </div>

        <label className={styles.noteComposer}>
          <span className="sl-sr-only">Skrifa athugasemd</span>
          <textarea
            className={styles.noteInput}
            rows={2}
            maxLength={2000}
            placeholder="Athugasemd eða ábending…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className={styles.noteActions}>
          {/* Two buttons rather than a dropdown and one: the choice of audience
              is the decision, so it is the thing being clicked. */}
          <button
            className={cn(styles.btn, styles.btnSecondary)}
            disabled={!note.trim() || sending}
            onClick={() => void submit("internal")}
          >
            Vista innanhúss
          </button>
          <button
            className={cn(styles.btn, styles.btnSend)}
            disabled={!note.trim() || sending}
            onClick={() => setConfirming(true)}
          >
            Senda höfundi
          </button>
        </div>

        {/* A note to an author is the one thing on this screen that cannot be
            taken back — it leaves as an email the moment it is saved. Everything
            else here has an undo; this gets a question instead. */}
        <Modal
          open={confirming}
          onClose={() => setConfirming(false)}
          title="Senda ábendingu til höfundar?"
        >
          <p className={styles.confirmBody}>
            {detail.author_name} fær tölvupóst með þessari athugasemd. Ekki er hægt að afturkalla
            hana.
          </p>
          <blockquote className={styles.confirmQuote}>{note}</blockquote>
          <div className={styles.noteActions}>
            <button
              className={cn(styles.btn, styles.btnSecondary)}
              onClick={() => setConfirming(false)}
            >
              Hætta við
            </button>
            <button
              className={cn(styles.btn, styles.btnSend)}
              disabled={sending}
              onClick={() => void submit("to_author")}
            >
              {sending ? "Sendi…" : "Já, senda höfundi"}
            </button>
          </div>
        </Modal>
      </section>

      <footer className={styles.detailActions}>
        <span className={styles.actionsLabel}>Efnið</span>
        {/* The shortcut is printed on the control rather than hidden in a help
            modal, so a reviewer who never reads help still learns the keyboard
            by using the mouse. */}
        <button
          className={cn(styles.btn, styles.btnPrimary)}
          disabled={busy}
          onClick={() => onAct("approve")}
        >
          Samþykkja <kbd className={styles.key}>s</kbd>
        </button>
        <button
          className={cn(styles.btn, styles.btnQuietDanger)}
          disabled={busy}
          onClick={() => onAct("reject")}
        >
          Hafna <kbd className={styles.key}>h</kbd>
        </button>
        {detail.hidden_at ? (
          <button
            className={cn(styles.btn, styles.btnSecondary)}
            disabled={busy}
            onClick={() => onAct("unhide")}
          >
            Sýna aftur <kbd className={styles.key}>f</kbd>
          </button>
        ) : (
          <button
            className={cn(styles.btn, styles.btnSecondary)}
            disabled={busy}
            onClick={() => onAct("hide")}
          >
            Fela <kbd className={styles.key}>f</kbd>
          </button>
        )}
        <button className={styles.shareBtn} onClick={() => void copyLink()} disabled={!shareUrl}>
          {copied ? "Hlekkur afritaður" : "Afrita hlekk"}
        </button>
        <Link href={`/programs/${detail.id}`} className={styles.openLink}>
          Opna í bankanum →
        </Link>
      </footer>
    </article>
  );
}
