"use client";

import Link from "next/link";
import { cn } from "@/lib/util";
import { formatIcelandicDate } from "@/lib/format";
import type { ReportQueueItem } from "@/services/moderation.service";
import { reportReasonLabel } from "@/services/reports.service";
import styles from "./yfirferd.module.css";

/**
 * A report on a comment, judged as a comment.
 *
 * Moderating a comment is not moderating the item it hangs under, so this
 * replaces the item pane rather than sitting under it: the words, who wrote
 * them, why someone objected, and the two decisions that fit — take the
 * comment down, or keep it and drop the report. The item is a link, not the
 * thing on trial.
 */
export default function CommentReportPane({
  report,
  busy,
  onRemove,
  onDismiss,
}: {
  report: ReportQueueItem;
  busy: boolean;
  onRemove: () => void;
  onDismiss: () => void;
}) {
  const author = report.comment_author_name ?? "óþekktum";

  return (
    <article className={styles.detail} aria-live="polite">
      <header className={styles.detailHead}>
        <p className={styles.meta}>
          <span className={styles.chip}>Athugasemd</span>
          <span>eftir {author}</span>
          {report.comment_created_at && (
            <span>{formatIcelandicDate(report.comment_created_at)}</span>
          )}
        </p>
        <h2 className={styles.detailTitle}>Tilkynnt athugasemd</h2>
      </header>

      <section>
        <blockquote className={styles.commentQuote}>
          {report.comment_body ?? <em>Athugasemdin fannst ekki.</em>}
        </blockquote>
        <p className={styles.bodyMuted}>
          Við „
          <Link href={`/programs/${report.content_id}#ef-athugasemdir`} className={styles.openLink}>
            {report.content_name}
          </Link>
          “
        </p>
      </section>

      <section>
        <h3 className={styles.sectionTitle}>Tilkynningin</h3>
        <p className={styles.detailBody}>
          <span className={report.reason === "unsafe" ? styles.reasonUrgent : styles.reason}>
            {reportReasonLabel(report)}
          </span>{" "}
          · {formatIcelandicDate(report.created_at)}
        </p>
        <p className={styles.detailBody}>
          {report.note ? `„${report.note}“` : <em>engin skýring gefin</em>}
        </p>
      </section>

      <div className={styles.reportActions}>
        <button
          className={cn(styles.btn, styles.btnDanger)}
          disabled={busy || !report.comment_body}
          onClick={onRemove}
        >
          Fjarlægja athugasemd
        </button>
        <button className={cn(styles.btn, styles.btnSecondary)} disabled={busy} onClick={onDismiss}>
          Fella niður
        </button>
      </div>
    </article>
  );
}
