"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/util";
import { userErrorMessage, type UserAction } from "./userRules";
import styles from "./UserManagement.module.css";

export interface ConfirmRequest {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  /** The confirm button while `run` is working, e.g. "Eyði…". */
  busyLabel: string;
  tone: "primary" | "danger";
  /** Does the change. If it throws, the dialog stays open with the reason. */
  run: () => Promise<void>;
  /** Which failure message to show when `run` throws. */
  action: UserAction;
  /** Called once, with true after `run` succeeded and false when cancelled. */
  settle: (done: boolean) => void;
}

/**
 * A confirm step for a change that grants power or can't be undone (UX rule 5).
 * Native `<dialog>` with `showModal()`: it traps focus, makes the page inert and
 * closes on Escape. Focus starts on "Hætta við" and returns to what opened it.
 */
export default function ConfirmDialog({
  request,
  onClosed,
}: {
  request: ConfirmRequest | null;
  onClosed: () => void;
}) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const done = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = request !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement as HTMLElement | null;
      done.current = false;
      setBusy(false);
      setError(null);
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const confirm = async () => {
    if (!request) return;
    setBusy(true);
    setError(null);
    try {
      await request.run();
      done.current = true;
      ref.current?.close();
    } catch (err) {
      setError(userErrorMessage(err, request.action));
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={`${id}-t`}
      // Nothing closes it half-way through a change.
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      onClose={() => {
        request?.settle(done.current);
        onClosed();
        // The opener may be gone (a deleted user's panel); then the page decides.
        if (opener.current?.isConnected) opener.current.focus();
      }}
    >
      {request && (
        <>
          <h2 id={`${id}-t`} className={styles.dialogTitle}>
            {request.title}
          </h2>
          <div className={styles.dialogBody}>{request.body}</div>
          <p role="alert" className={styles.inlineError}>
            {error}
          </p>
          <div className={styles.dialogActions}>
            <button
              ref={cancelRef}
              type="button"
              className={cn(styles.button, styles.buttonGhost)}
              disabled={busy}
              onClick={() => ref.current?.close()}
            >
              Hætta við
            </button>
            <button
              type="button"
              className={cn(
                styles.button,
                request.tone === "danger" ? styles.buttonDanger : styles.buttonPrimary
              )}
              disabled={busy}
              onClick={confirm}
            >
              {busy ? request.busyLabel : request.confirmLabel}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
