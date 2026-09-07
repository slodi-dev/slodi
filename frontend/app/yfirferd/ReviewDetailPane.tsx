"use client";

import React from "react";
import Link from "next/link";
import {
  CONTENT_TYPE_LABEL,
  REVIEW_STATE_LABEL,
  type ReviewDetail,
} from "@/services/moderation.service";
import { REPORT_REASON_LABEL } from "@/services/reports.service";
import styles from "./yfirferd.module.css";

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
  busy,
  onAct,
}: {
  detail: ReviewDetail | null;
  loading: boolean;
  busy: boolean;
  onAct: (action: "approve" | "reject" | "hide" | "unhide") => void;
}) {
  if (loading) return <p className={styles.state}>Hleð…</p>;
  if (!detail) {
    return <p className={styles.state}>Veldu efni til vinstri til að lesa það í heild.</p>;
  }

  const decided = detail.reviewed_at
    ? `${REVIEW_STATE_LABEL[detail.review_state]} af ${detail.reviewed_by_name ?? "óþekktum"} · ${new Date(
        detail.reviewed_at
      ).toLocaleDateString("is-IS", { dateStyle: "medium" })}`
    : null;

  return (
    <article className={styles.detail} aria-live="polite">
      <header className={styles.detailHead}>
        <p className={styles.meta}>
          <span className={styles.type}>{CONTENT_TYPE_LABEL[detail.content_type]}</span>
          <span>eftir {detail.author_name}</span>
          <span>
            {new Date(detail.created_at).toLocaleDateString("is-IS", { dateStyle: "medium" })}
          </span>
          {detail.hidden_at && <span className={styles.reportFlag}>Falið</span>}
          {detail.author_strikes > 0 && (
            <span className={styles.strikes}>
              {detail.author_strikes} áminning{detail.author_strikes === 1 ? "" : "ar"} áður
            </span>
          )}
        </p>
        <h2 className={styles.detailTitle}>{detail.name}</h2>
        {/* The record of what was done, stated plainly — this is the answer to
            "who approved this, and when?". */}
        {decided && <p className={styles.decided}>{decided}</p>}
        {detail.review_note && <p className={styles.reviewNote}>„{detail.review_note}“</p>}
      </header>

      {detail.reports.length > 0 && (
        <section className={styles.reportsBox}>
          <h3 className={styles.sectionTitle}>Tilkynningar ({detail.reports.length})</h3>
          <ul className={styles.reportsList}>
            {detail.reports.map((r) => (
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

      <footer className={styles.detailActions}>
        <span className={styles.actionsLabel}>Efnið</span>
        <button className={styles.approve} disabled={busy} onClick={() => onAct("approve")}>
          Samþykkja
        </button>
        <button className={styles.reject} disabled={busy} onClick={() => onAct("reject")}>
          Hafna
        </button>
        {detail.hidden_at ? (
          <button className={styles.reject} disabled={busy} onClick={() => onAct("unhide")}>
            Sýna aftur
          </button>
        ) : (
          <button className={styles.hide} disabled={busy} onClick={() => onAct("hide")}>
            Fela
          </button>
        )}
        <Link href={`/programs/${detail.id}`} className={styles.openLink}>
          Opna í bankanum →
        </Link>
      </footer>
    </article>
  );
}
