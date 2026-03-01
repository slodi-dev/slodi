"use client";

import React from "react";
import Modal from "@/components/Modal/Modal";
import styles from "./DeleteConfirmModal.module.css";

type Props = {
  open: boolean;
  /** Name of the item being deleted — shown in the warning text. */
  programName?: string | null;
  isDeleting?: boolean;
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
  onClose,
  onConfirm,
}: Props) {
  return (
    <Modal open={open} onClose={isDeleting ? () => {} : onClose} title="Eyða dagskrá">
      <div className={styles.body}>
        <p className={styles.warning}>
          Ertu viss um að þú viljir eyða{" "}
          {programName ? (
            <>
              <strong>&bdquo;{programName}&rdquo;</strong>?
            </>
          ) : (
            "þessa dagskrá?"
          )}{" "}
          Þetta er óafturkræft.
        </p>

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
            {isDeleting ? "Eyði…" : "Eyða dagskrá"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
