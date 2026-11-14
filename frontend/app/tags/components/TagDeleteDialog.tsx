"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal/Modal";
import { countIs } from "@/lib/format";
import type { Tag } from "@/services/tags.service";
import { tagErrorMessage } from "../tagRules";
import styles from "./tags.module.css";

interface TagDeleteDialogProps {
  /** The tag to delete; null keeps the dialog closed. */
  tag: Tag | null;
  /** How many items carry it; null when not known. */
  usageCount?: number | null;
  onCancel: () => void;
  /** Deletes the tag. Throws on failure, and the dialog stays open with the reason. */
  onConfirm: () => Promise<void>;
}

/**
 * Confirms a delete, which the backend can't undo (UX rule 5): names the tag
 * and how many items lose it, "Hætta við" first and quiet, the red button
 * carries the verb, and an error keeps the dialog open.
 */
export default function TagDeleteDialog({
  tag,
  usageCount,
  onCancel,
  onConfirm,
}: TagDeleteDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const open = tag !== null;

  // Focus starts on the safe choice. The page keys the dialog by tag, so each opens fresh.
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(tagErrorMessage(err, "delete"));
      setBusy(false);
    }
  };

  // Nothing closes it half-way through a delete.
  const close = () => {
    if (!busy) onCancel();
  };

  return (
    <Modal open={open} onClose={close} title="Eyða merkimiða?">
      {tag ? (
        <div className={styles.dialogBody}>
          <p className={styles.dialogText}>
            <strong className={styles.dialogName}>„{tag.name}“</strong> {usageSentence(usageCount)}
          </p>
          <p className={styles.dialogText}>Ekki er hægt að afturkalla þetta.</p>
          <p role="alert" className={styles.fieldError}>
            {error}
          </p>
          <div className={styles.dialogActions}>
            <button ref={cancelRef} type="button" className={styles.quietBtn} onClick={close}>
              Hætta við
            </button>
            <button type="button" className={styles.deleteBtn} onClick={confirm} disabled={busy}>
              {busy ? "Eyði…" : "Eyða merkimiða"}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function usageSentence(count: number | null | undefined): string {
  if (count === null || count === undefined) {
    return "verður tekið af öllum einingum sem nota það.";
  }
  if (count === 0) return "er ekki notað á neinni einingu.";
  return `er notað á ${countIs(count, "einingu", "einingum")} og verður tekið af þeim öllum.`;
}
