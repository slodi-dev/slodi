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
import { formatIcelandicDate } from "@/lib/format";

/**
 * Who a reviewer is dealing with, and the one action that is about the person
 * rather than the content.
 *
 * Kept behind a disclosure. Most decisions are about the item in front of you,
 * and a permanent record of somebody's past mistakes sitting open next to it
 * invites judging the person instead of the thing.
 */
export default function AuthorStandingPanel({
  authorId,
  authorName,
  summary,
}: {
  authorId: string;
  authorName: string;
  /** Carried on the item's detail, so a fifty-item sweep does not fetch this
   *  separately for every row. The full history is fetched only on opening. */
  summary: { reports: number; strikes: number; spells: number; suspendedUntil: string | null };
}) {
  const { getToken } = useAuth();
  const hasHistory =
    summary.strikes > 0 || summary.spells > 0 || summary.suspendedUntil !== undefined;
  // Open itself when there is something to see. A first-time contributor stays
  // quiet; a repeat one should be impossible to miss.
  const [open, setOpen] = useState(summary.strikes > 0 || summary.spells > 0);
  const [customDays, setCustomDays] = useState("");
  const [standing, setStanding] = useState<AuthorStanding | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setStanding(await fetchAuthorStanding(authorId, getToken));
    } catch {
      setMessage("Ekki tókst að sækja sögu höfundar.");
    }
  }, [authorId, getToken]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // A new item means a new person: reset, and open again only if this one has
  // a history of their own.
  useEffect(() => {
    setOpen(summary.strikes > 0 || summary.spells > 0);
    setStanding(null);
    setMessage("");
    setCustomDays("");
  }, [authorId, summary.strikes, summary.spells]);

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

  return (
    <section className={styles.standing}>
      <button
        className={styles.standingToggle}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "▾" : "▸"} Saga höfundar — {authorName}
      </button>

      {open && (
        <div className={styles.standingBody}>
          {!standing ? (
            <p className={styles.bodyMuted}>Hleð…</p>
          ) : (
            <>
              <dl className={styles.facts}>
                <div className={styles.fact}>
                  {/* Context, not evidence: anyone can report anyone. */}
                  <dt className={styles.factLabel}>Tilkynningar alls</dt>
                  <dd className={styles.factValue}>{standing.reports_received}</dd>
                </div>
                <div className={styles.fact}>
                  <dt className={styles.factLabel}>Áminningar</dt>
                  <dd className={styles.factValue}>{standing.strikes}</dd>
                </div>
                <div className={styles.fact}>
                  <dt className={styles.factLabel}>Skammarkrókur</dt>
                  <dd className={styles.factValue}>{standing.suspensions.length} sinnum</dd>
                </div>
              </dl>

              {standing.active_suspension ? (
                <div className={styles.activeSuspension}>
                  <p>
                    Í skammarkrók til{" "}
                    <strong>{formatIcelandicDate(standing.active_suspension.expires_at)}</strong> —
                    „{standing.active_suspension.reason}“
                  </p>
                  <button
                    className={styles.reject}
                    disabled={busy}
                    onClick={() => void lift(standing.active_suspension!.id)}
                  >
                    Aflétta
                  </button>
                </div>
              ) : (
                <div className={styles.suspendRow}>
                  <span className={styles.actionsLabel}>Skammarkrókur</span>
                  {SUSPENSION_PRESETS.map((days) => (
                    <button
                      key={days}
                      className={styles.hide}
                      disabled={busy}
                      onClick={() => void suspend(days)}
                    >
                      {days} dagar
                    </button>
                  ))}
                  <label className={styles.customDays}>
                    <span className="sl-sr-only">Annar fjöldi daga</span>
                    <input
                      className={styles.date}
                      type="number"
                      min={1}
                      max={MAX_DAYS}
                      placeholder="Dagar"
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                    />
                    <button
                      className={styles.hide}
                      disabled={busy || !customDays || Number(customDays) < 1}
                      onClick={() => void suspend(Number(customDays))}
                    >
                      Setja
                    </button>
                  </label>
                  {/* Last, and worded rather than numbered: it is a different
                      kind of decision, not a longer one. */}
                  <button
                    className={styles.permanentBtn}
                    disabled={busy}
                    onClick={() => void suspend(null)}
                  >
                    Ótímabundið
                  </button>
                </div>
              )}

              {standing.suspensions.length > 0 && (
                <ul className={styles.suspensionList}>
                  {standing.suspensions.map((s) => (
                    <li key={s.id}>
                      {formatIcelandicDate(s.starts_at)} – {formatIcelandicDate(s.expires_at)} · „
                      {s.reason}“{s.lifted_at && <em> — aflétt: „{s.lift_reason}“</em>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <p className={styles.live} role="status" aria-live="polite">
            {message}
          </p>
        </div>
      )}
    </section>
  );
}
