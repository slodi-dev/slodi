"use client";

import React from "react";
import Modal from "@/components/Modal/Modal";
import styles from "./yfirferd.module.css";
import { cn } from "@/lib/util";

export type AuthorAction = "to_author" | "needs_changes" | "reject";

const COPY: Record<AuthorAction, { title: string; outcome: string | null; confirm: string }> = {
  to_author: {
    title: "Senda ábendingu til höfundar?",
    outcome: null,
    confirm: "Já, senda höfundi",
  },
  needs_changes: {
    title: "Þarfnast lagfæringar?",
    outcome:
      "Efnið fer úr bankanum þar til höfundur hefur lagað það. Þá fer það aftur í bankann og í yfirferð.",
    confirm: "Já, senda til lagfæringar",
  },
  reject: {
    title: "Hafna efninu?",
    outcome: "Efnið fer úr bankanum og höfundur getur aðeins eytt því.",
    confirm: "Já, hafna efninu",
  },
};

/** Confirms emailing the note in the composer to the author, with or without a decision. */
export default function DecisionModal({
  action,
  authorName,
  note,
  sending,
  onConfirm,
  onClose,
}: {
  action: AuthorAction | null;
  authorName: string;
  note: string;
  sending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const copy = action ? COPY[action] : null;
  return (
    <Modal open={copy !== null} onClose={onClose} title={copy?.title ?? ""}>
      {copy && (
        <>
          <p className={styles.confirmBody}>
            {authorName} fær tölvupóst með þessari athugasemd. Ekki er hægt að afturkalla hana.
            {copy.outcome && ` ${copy.outcome}`}
          </p>
          <blockquote className={styles.confirmQuote}>{note}</blockquote>
          <div className={styles.noteActions}>
            <button className={cn(styles.btn, styles.btnSecondary)} onClick={onClose}>
              Hætta við
            </button>
            <button
              className={cn(styles.btn, action === "reject" ? styles.btnDanger : styles.btnSend)}
              disabled={sending}
              onClick={onConfirm}
            >
              {sending ? "Sendi…" : copy.confirm}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
