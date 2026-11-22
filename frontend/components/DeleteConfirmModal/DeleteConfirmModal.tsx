"use client";

import React from "react";
import Modal from "@/components/Modal/Modal";
import styles from "./DeleteConfirmModal.module.css";

/** Shown in the modal when the delete request fails, whatever the cause. */
export const DELETE_FAILED_MESSAGE = "Ekki tókst að eyða. Reyndu aftur síðar.";

type Props = {
  open: boolean;
  /** Name of the item being deleted — shown in the warning text. */
  programName?: string | null;
  isDeleting?: boolean;
  /** Why the last attempt failed, shown inside the modal so it is not lost. */
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

/**
 * Reusable deletion confirmation modal.
 * Parent is responsible for performing the actual delete in `onConfirm`.
 */
export function DeleteConfirmModal({
  open,
  programName,
  isDeleting = false,
  error = null,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Modal open={open} onClose={isDeleting ? () => {} : onClose} title="Eyða">
      <div className={styles.body}>
        <p className={styles.warning}>
          Ertu viss um að þú viljir eyða{" "}
          {programName ? (
            <>
              <strong>&bdquo;{programName}&rdquo;</strong>?
            </>
          ) : (
            "þessu?"
          )}{" "}
          Þetta er óafturkræft.
        </p>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isDeleting}
          >
            Hætta við
          </button>
          <button
            type="button"
            className={styles.deleteButton}
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Eyði…" : "Eyða"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
