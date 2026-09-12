"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  type AuthorStanding,
  MAX_DAYS,
  SUSPENSION_PRESETS,
  fetchAuthorStanding,
  liftSuspension,
  suspendAuthor,
} from "@/services/suspensions.service";
import styles from "./yfirferd.module.css";
import { formatIcelandicNumber, formatIcelandicDate } from "@/lib/format";

/** Initials for the monogram. Decorative — it carries nothing the name does not. */
function monogram(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Icelandic counts, where the singular is a different word rather than a suffix. */
function plural(n: number, one: string, many: string): string {
  return `${formatIcelandicNumber(n)} ${n === 1 ? one : many}`;
}

/**
 * Who a reviewer is dealing with, and the one action that is about the person
 * rather than the content.
 *
 * Reads top to bottom as three questions: **who is this**, **what has
 * happened**, **what can I do**. The earlier version answered none of them in
 * order — four bare numbers and six buttons on one row, in a surface where you
 * are judging a person, with the name nowhere on it.
 */
export default function AuthorStandingPanel({
  authorId,
  authorName,
  summary,
}: {
  authorId: string;
  authorName: string;
  /** Carried on the item's detail, so a fifty-item sweep does not fetch this
   *  separately for every row. The full history is fetched alongside. */
  summary: { reports: number; strikes: number; spells: number; suspendedUntil: string | null };
}) {
  const { getToken } = useAuth();
  const [standing, setStanding] = useState<AuthorStanding | null>(null);
  const [customDays, setCustomDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setStanding(await fetchAuthorStanding(authorId, getToken));
    } catch {
      setMessage("Ekki tókst að sækja sögu höfundar.");
    }
  }, [authorId, getToken]);

  // A new item means a new person: drop the previous one's history rather than
  // showing it under a new name while the fetch is in flight.
  useEffect(() => {
    setStanding(null);
    setMessage("");
    setCustomDays("");
    void load();
  }, [authorId, load]);

  async function suspend(days: number | null) {
    if (days === null) {
      // Open-ended has no end to announce, so it is confirmed separately. It is
      // still reversible — that is worth saying, or it reads as a ban.
      const sure = window.confirm(
        `Setja ${authorName} ótímabundið í skammarkrók?\n\n` +
          `Það gildir þar til einhver afléttir því. Hægt er að aflétta hvenær sem er.`
      );
      if (!sure) return;
    }
    const span = days === null ? "ótímabundið" : `í ${days} daga`;
    const reason = window.prompt(
      `Af hverju fer ${authorName} ${span} í skammarkrók? ${authorName} sér þessa ástæðu.`
    );
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await suspendAuthor(authorId, days, reason, getToken);
      setMessage(
        days === null
          ? `${authorName} getur ekki sent inn efni fyrr en því er aflétt.`
          : `${authorName} getur ekki sent inn efni næstu ${days} daga.`
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ekki tókst að vista.");
    } finally {
      setBusy(false);
    }
  }

  async function lift(id: string) {
    const reason = window.prompt("Af hverju er skammarkróknum aflétt?");
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await liftSuspension(id, reason, getToken);
      setMessage(`${authorName} getur sent inn efni aftur.`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ekki tókst að aflétta.");
    } finally {
      setBusy(false);
    }
  }

  const reports = standing?.reports_received ?? summary.reports;
  const strikes = standing?.strikes ?? summary.strikes;
  const spells = standing?.suspensions.length ?? summary.spells;
  const active = standing?.active_suspension ?? null;
  const clean = reports === 0 && strikes === 0 && spells === 0;

  return (
    <section className={styles.standing} aria-labelledby={`au-${authorId}`}>
      <div className={styles.auHead}>
        <span className={styles.auMono} aria-hidden="true">
          {monogram(authorName)}
        </span>
        <h3 className={styles.auName} id={`au-${authorId}`}>
          {authorName}
        </h3>
      </div>

      {/* Three separate numbers on purpose. Reports received is context —
          anyone can be reported. Strikes are decisions somebody actually made.
          Spells are what was done about them. One combined score would hide
          the difference between being complained about and being wrong. */}
      <dl className={styles.auStats}>
        <div className={`${styles.stat} ${reports === 0 ? styles.statZero : styles.statFlag}`}>
          <dt className={styles.statLabel}>tilkynningar alls</dt>
          <dd className={styles.statNum}>{formatIcelandicNumber(reports)}</dd>
        </div>
        <div className={`${styles.stat} ${strikes === 0 ? styles.statZero : styles.statFlag}`}>
          <dt className={styles.statLabel}>áminningar</dt>
          <dd className={styles.statNum}>{formatIcelandicNumber(strikes)}</dd>
        </div>
        <div className={`${styles.stat} ${spells === 0 ? styles.statZero : styles.statFlag}`}>
          <dt className={styles.statLabel}>{spells === 1 ? "sinni" : "sinnum"} í skammarkrók</dt>
          <dd className={styles.statNum}>{formatIcelandicNumber(spells)}</dd>
        </div>
      </dl>

      <div className={styles.auSec}>
        <h4 className={styles.auHeading}>Það sem hefur gerst</h4>
        {clean ? (
          // An absence stated in a sentence is a finding; an empty box is an
          // ambiguity, and the reader cannot tell it from a failed fetch.
          <p className={styles.bodyMuted}>
            Ekkert hefur komið upp. Engin eining eftir {authorName} hefur verið tilkynnt.
          </p>
        ) : (
          <>
            {/* Only the spells can be dated: the API returns strikes and
                reports as counts, not as an event feed. A count is not a
                history — "3 áminningar" is not something you can weigh, while
                three dated lines with their reasons are — so a dated feed for
                those two is worth its own endpoint. */}
            {standing && standing.suspensions.length > 0 ? (
              <ul className={styles.hist}>
                {standing.suspensions.map((s) => (
                  <li key={s.id}>
                    <span className={styles.histDate}>{formatIcelandicDate(s.starts_at)}</span>
                    <span className={styles.histWhat}>
                      <strong>
                        {s.expires_at
                          ? `Skammarkrókur til ${formatIcelandicDate(s.expires_at)}`
                          : "Skammarkrókur, ótímabundinn"}
                      </strong>
                      — „{s.reason}“
                      {s.lifted_at && <em>· aflétt {formatIcelandicDate(s.lifted_at)}</em>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.bodyMuted}>
                {plural(reports, "tilkynning", "tilkynningar")} og{" "}
                {plural(strikes, "áminning", "áminningar")}. Enginn skammarkrókur.
              </p>
            )}
          </>
        )}
      </div>

      <div className={styles.auSec}>
        <h4 className={styles.auHeading}>Skammarkrókur</h4>
        {active ? (
          // While one is running there is exactly one decision left — whether
          // to lift it — so it is the only control on screen.
          <div className={styles.activeSuspension} role="status">
            <p>
              {active.expires_at ? (
                <>
                  Í skammarkrók til <strong>{formatIcelandicDate(active.expires_at)}</strong> — „
                  {active.reason}“
                </>
              ) : (
                <>
                  {/* Nobody should have to infer that a missing date means
                      forever. */}
                  Í skammarkrók <strong>ótímabundið</strong> — „{active.reason}“. Ekkert aflétt
                  þessu sjálfkrafa.
                </>
              )}
            </p>
            <button
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
              disabled={busy}
              onClick={() => void lift(active.id)}
            >
              Aflétta
            </button>
          </div>
        ) : (
          <>
            <div
              className={styles.durs}
              role="group"
              aria-label="Setja í skammarkrók í tiltekna daga"
            >
              {SUSPENSION_PRESETS.map((days) => (
                <button
                  key={days}
                  className={`${styles.btn} ${styles.btnQuietDanger} ${styles.btnSm}`}
                  disabled={busy}
                  onClick={() => void suspend(days)}
                >
                  {days} dagar
                </button>
              ))}
              <span className={styles.dursOr}>eða</span>
              <span className={styles.customDays}>
                <input
                  className={styles.numInput}
                  type="number"
                  min={1}
                  max={MAX_DAYS}
                  placeholder="Dagar"
                  aria-label="Fjöldi daga"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                />
                <button
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                  disabled={busy || !customDays || Number(customDays) < 1}
                  onClick={() => void suspend(Number(customDays))}
                >
                  Setja
                </button>
              </span>
            </div>
            {/* Boxed off rather than sitting at the end of the row: it is a
                different kind of act, not the longest one. The ellipsis is the
                standing convention for a control that asks before it acts. */}
            <div className={styles.auGrave}>
              <p>
                <strong>Ótímabundið</strong> — ekkert aflétt því sjálfkrafa. Einhver þarf að muna að
                taka það af.
              </p>
              <button
                className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                disabled={busy}
                onClick={() => void suspend(null)}
              >
                Ótímabundið…
              </button>
            </div>
          </>
        )}
        {/* Polite, but deliberately not role="status": the page already has
            one, for the sweep, and two status regions leave a screen reader
            user unable to tell which of them just spoke. */}
        <p className={styles.live} aria-live="polite">
          {message}
        </p>
      </div>
    </section>
  );
}
