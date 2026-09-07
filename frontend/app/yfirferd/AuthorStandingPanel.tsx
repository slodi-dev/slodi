"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  type AuthorStanding,
  MODERATOR_MAX_DAYS,
  SUSPENSION_PRESETS,
  fetchAuthorStanding,
  liftSuspension,
  suspendAuthor,
} from "@/services/suspensions.service";
import styles from "./yfirferd.module.css";

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
}: {
  authorId: string;
  authorName: string;
}) {
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
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

  // A new item means a new person; collapse rather than show the last one's.
  useEffect(() => {
    setOpen(false);
    setStanding(null);
    setMessage("");
  }, [authorId]);

  async function suspend(days: number) {
    const reason = window.prompt(
      `Af hverju fer ${authorName} í skammarkrók í ${days} daga? ${authorName} sér þessa ástæðu.`
    );
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await suspendAuthor(authorId, days, reason, getToken);
      setMessage(`${authorName} getur ekki sent inn efni næstu ${days} daga.`);
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
                    <strong>
                      {new Date(standing.active_suspension.expires_at).toLocaleDateString("is-IS", {
                        dateStyle: "medium",
                      })}
                    </strong>{" "}
                    — „{standing.active_suspension.reason}“
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
                  <span className={styles.bodyMuted}>
                    Lengur en {MODERATOR_MAX_DAYS} daga þarf stjórnanda.
                  </span>
                </div>
              )}

              {standing.suspensions.length > 0 && (
                <ul className={styles.suspensionList}>
                  {standing.suspensions.map((s) => (
                    <li key={s.id}>
                      {new Date(s.starts_at).toLocaleDateString("is-IS")} –{" "}
                      {new Date(s.expires_at).toLocaleDateString("is-IS")} · „{s.reason}“
                      {s.lifted_at && <em> — aflétt: „{s.lift_reason}“</em>}
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
