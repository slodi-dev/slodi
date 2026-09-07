"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import Modal from "@/components/Modal/Modal";
import { useAuth } from "@/contexts/AuthContext";
import {
  REPORT_NOTE_MAX,
  REPORT_REASONS,
  REPORT_REASON_LABEL,
  type ReportReason,
  reportContent,
} from "@/services/reports.service";
import styles from "./ReportContentModal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  contentId: string;
  contentName: string;
};

/**
 * Flagging one item.
 *
 * The note is optional. Asking for a reason *and* a paragraph is how a report
 * does not get filed at all, and an unfiled report tells the team nothing.
 *
 * Success is announced rather than silent: someone who flags something and sees
 * nothing happen assumes it failed and does it again.
 */
export default function ReportContentModal({ open, onClose, contentId, contentName }: Props) {
  const { getToken } = useAuth();
  const groupId = useId();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const firstOptionRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason(null);
    setNote("");
    setState("idle");
    // Focus the first choice rather than the dialog, so a keyboard user lands
    // on the decision instead of having to hunt for it.
    const id = window.setTimeout(() => firstOptionRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason || state === "sending") return;
    setState("sending");
    try {
      await reportContent(contentId, reason, note, getToken);
      setState("sent");
      // Long enough to read the confirmation, short enough not to trap anyone.
      window.setTimeout(onClose, 1800);
    } catch {
      setState("error");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Tilkynna „${contentName}“`}>
      <form className={styles.form} onSubmit={submit}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Hvað er að?</legend>
          {REPORT_REASONS.map((value, index) => (
            <label key={value} className={styles.option}>
              <input
                ref={index === 0 ? firstOptionRef : undefined}
                type="radio"
                name={`${groupId}-reason`}
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                disabled={state === "sending" || state === "sent"}
              />
              <span>{REPORT_REASON_LABEL[value]}</span>
            </label>
          ))}
        </fieldset>

        <label className={styles.noteLabel}>
          <span>Viltu segja meira? (valfrjálst)</span>
          <textarea
            className={styles.note}
            value={note}
            maxLength={REPORT_NOTE_MAX}
            rows={3}
            onChange={(e) => setNote(e.target.value)}
            disabled={state === "sending" || state === "sent"}
          />
        </label>

        <p className={styles.status} role="status" aria-live="polite">
          {state === "sent" && "Takk fyrir. Teymið skoðar þetta."}
          {state === "error" && "Ekki tókst að senda tilkynninguna. Reyndu aftur."}
        </p>

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Hætta við
          </button>
          <button
            type="submit"
            className={styles.primary}
            disabled={!reason || state === "sending" || state === "sent"}
          >
            {state === "sending" ? "Sendi…" : "Senda tilkynningu"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
