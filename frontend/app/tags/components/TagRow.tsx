"use client";

import { useEffect, useRef, useState } from "react";
import type { Tag } from "@/services/tags.service";
import styles from "./TagRow.module.css";

interface TagRowProps {
  tag: Tag;
  isEditing: boolean;
  isDeleting: boolean;
  contentCount?: number;
  onEdit: () => void;
  onRequestDelete: () => void;
  onSave: (newName: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}

export default function TagRow({
  tag,
  isEditing,
  isDeleting,
  contentCount,
  onEdit,
  onRequestDelete,
  onSave,
  onDelete,
  onCancel,
}: TagRowProps) {
  const [editName, setEditName] = useState(tag.name);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditName(tag.name);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing, tag.name]);

  const handleSave = async () => {
    const trimmed = editName.trim();
    if (trimmed.length === 0) {
      setError("Nafn má ekki vera tómt");
      return;
    }
    if (trimmed.length > 50) {
      setError("Nafn má mest vera 50 stafir");
      return;
    }
    if (trimmed === tag.name) {
      onCancel();
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("already exists") || msg.includes("409")) {
        setError("Flokkur með þessu nafni er þegar til");
      } else {
        setError("Villa kom upp");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await onDelete();
    } catch {
      setError("Villa kom upp við að eyða flokki");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  // Delete confirmation state
  if (isDeleting) {
    const message =
      contentCount && contentCount > 0
        ? `Þessi flokkur er á ${contentCount} dagskrám. Ertu viss?`
        : "Ertu viss?";

    return (
      <li className={styles.row} role="alert">
        <span className={styles.deleteMessage}>{message}</span>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={handleDelete}
            disabled={isSaving}
          >
            Já, eyða
          </button>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={isSaving}
          >
            Hætta við
          </button>
        </div>
      </li>
    );
  }

  // Edit state
  if (isEditing) {
    return (
      <li className={styles.row}>
        <div className={styles.editWrapper}>
          <input
            ref={inputRef}
            type="text"
            className={styles.editInput}
            value={editName}
            onChange={(e) => {
              setEditName(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            aria-label="Nýtt nafn flokks"
            maxLength={50}
            disabled={isSaving}
          />
          {error && <p className={styles.error}>{error}</p>}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={isSaving || editName.trim().length === 0}
          >
            {isSaving ? "..." : "Vista"}
          </button>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={isSaving}
          >
            Hætta
          </button>
        </div>
      </li>
    );
  }

  // View state
  return (
    <li className={styles.row}>
      <span className={styles.tagName}>{tag.name}</span>
      {contentCount !== undefined && (
        <span className={styles.tagCount}>
          {contentCount} {contentCount === 1 ? "dagskrá" : "dagskrár"}
        </span>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.editBtn}
          onClick={onEdit}
          aria-label={`Breyta flokk: ${tag.name}`}
        >
          Breyta
        </button>
        <button
          type="button"
          className={styles.deleteBtn}
          onClick={onRequestDelete}
          aria-label={`Eyða flokki: ${tag.name}`}
        >
          Eyða
        </button>
      </div>
    </li>
  );
}
