"use client";

import { useEffect, useRef } from "react";
import type { Tag } from "@/services/tags.service";
import { tagErrorMessage, usageText } from "../tagRules";
import TagNameField from "./TagNameField";
import styles from "./tags.module.css";

interface TagRowProps {
  tag: Tag;
  /** How many items carry it; null or undefined while unknown. */
  usageCount?: number | null;
  /** The search text, marked in the name. */
  query?: string;
  /** The name is exactly what was typed in the field: highlighted and marked "Er til". */
  isMatch?: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  /** Checks a new name; returns the message to show, or null. */
  validateName: (name: string) => string | null;
  /** Saves a new name. Throws on failure; the row shows why. */
  onRename: (name: string) => Promise<void>;
  /** Opens the delete dialog; the button is where focus goes back to on cancel. */
  onRequestDelete: (trigger: HTMLButtonElement) => void;
}

/** One tag: its name and usage, renamed in place, or sent to the delete dialog. */
export default function TagRow({
  tag,
  usageCount,
  query = "",
  isMatch = false,
  isEditing,
  onEdit,
  onCancelEdit,
  validateName,
  onRename,
  onRequestDelete,
}: TagRowProps) {
  const renameRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(isEditing);

  // Back on "Endurnefna" when the rename closes, saved or not.
  useEffect(() => {
    if (wasEditing.current && !isEditing) renameRef.current?.focus();
    wasEditing.current = isEditing;
  }, [isEditing]);

  const save = async (name: string): Promise<string | null> => {
    if (name.trim() === tag.name) {
      onCancelEdit();
      return null;
    }
    try {
      await onRename(name.trim());
      return null;
    } catch (err) {
      return tagErrorMessage(err, "rename");
    }
  };

  if (isEditing) {
    return (
      <li className={styles.row}>
        <TagNameField
          label={`Nýtt nafn á „${tag.name}“`}
          labelHidden
          initialValue={tag.name}
          submitLabel="Vista"
          busyLabel="Vista…"
          autoFocus
          validate={validateName}
          onSubmit={save}
          onCancel={onCancelEdit}
          className={styles.renameField}
        />
      </li>
    );
  }

  const usage = usageText(usageCount);
  return (
    <li className={`${styles.row} ${isMatch ? styles.rowMatch : ""}`}>
      <span className={styles.rowName}>
        <Highlight name={tag.name} query={query} />
        {isMatch ? <span className={styles.flag}>Er til</span> : null}
      </span>
      <span className={styles.usage}>{usage}</span>
      <span className={styles.actions}>
        <button ref={renameRef} type="button" className={styles.quietBtn} onClick={onEdit}>
          Endurnefna<span className="sl-sr-only"> {tag.name}</span>
        </button>
        <button
          type="button"
          className={styles.dangerBtn}
          onClick={(e) => onRequestDelete(e.currentTarget)}
        >
          Eyða<span className="sl-sr-only"> {tag.name}</span>
        </button>
      </span>
    </li>
  );
}

/** The name with the search text marked. */
function Highlight({ name, query }: { name: string; query: string }) {
  const q = query.trim().toLowerCase();
  const at = q ? name.toLowerCase().indexOf(q) : -1;
  if (at === -1) return <>{name}</>;
  return (
    <>
      {name.slice(0, at)}
      <mark className={styles.mark}>{name.slice(at, at + q.length)}</mark>
      {name.slice(at + q.length)}
    </>
  );
}
