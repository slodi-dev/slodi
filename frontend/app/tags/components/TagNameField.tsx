"use client";

import { useEffect, useId, useRef, useState } from "react";
import { COUNTER_FROM, NAME_MAX } from "../tagRules";
import styles from "./tags.module.css";

export interface TagNameFieldProps {
  label: string;
  /** Keep the label for screen readers only (rename, where the row says which tag). */
  labelHidden?: boolean;
  hint?: string;
  submitLabel: string;
  /** UX rule 1: a busy button says what it's doing ("Vista…"). */
  busyLabel: string;
  /** Start value when the field holds its own value (rename). */
  initialValue?: string;
  /** Controlled value, when the field is also the search (create). */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Checked on submit, then on every change while the field is in error (UX rule 6). */
  validate: (name: string) => string | null;
  /** Saves the name. Resolves to the message to show, or null when it worked. */
  onSubmit: (name: string) => Promise<string | null>;
  /** Shows "Hætta við", and Escape does the same. */
  onCancel?: () => void;
  /** Empty the field after a save (create) rather than keep it (rename). */
  clearOnSuccess?: boolean;
  /** Focus and select the text on mount (rename). */
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Lets a button elsewhere submit this field with `form={formId}`. */
  formId?: string;
  type?: "text" | "search";
  className?: string;
}

/**
 * One tag name with its own submit button, for create and rename.
 *
 * While it saves only the button is disabled, never the field, so focus and
 * the phone keyboard stay where they are (UX rule 11, sc-637). An error is
 * inline, announced, marks the field `aria-invalid` and puts focus back in it.
 * The counter shows from 90% of the backend's limit.
 */
export default function TagNameField({
  label,
  labelHidden,
  hint,
  submitLabel,
  busyLabel,
  initialValue = "",
  value: controlledValue,
  onValueChange,
  validate,
  onSubmit,
  onCancel,
  clearOnSuccess,
  autoFocus,
  inputRef,
  formId,
  type = "text",
  className,
}: TagNameFieldProps) {
  const id = useId();
  const [ownValue, setOwnValue] = useState(initialValue);
  const value = controlledValue ?? ownValue;
  const setValue = (next: string) => (onValueChange ? onValueChange(next) : setOwnValue(next));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const localRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus) localRef.current?.select();
  }, [autoFocus]);

  const length = value.trim().length;
  const showCounter = length >= COUNTER_FROM;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busyRef.current) return;
    const invalid = validate(value);
    if (invalid) {
      setError(invalid);
      localRef.current?.focus();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    const failure = await onSubmit(value);
    busyRef.current = false;
    setBusy(false);
    setError(failure);
    if (!failure && clearOnSuccess) setValue("");
    // After the empty state's "Búa til" or a click on the button, typing carries on here.
    if (failure || clearOnSuccess) localRef.current?.focus();
  };

  const hintId = `${id}-hint`;
  const countId = `${id}-count`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, showCounter && countId, error && errorId]
    .filter(Boolean)
    .join(" ");

  return (
    <form id={formId} className={`${styles.field} ${className ?? ""}`} onSubmit={submit} noValidate>
      <label htmlFor={`${id}-input`} className={labelHidden ? "sl-sr-only" : styles.fieldLabel}>
        {label}
      </label>
      <div className={styles.fieldRow}>
        <input
          id={`${id}-input`}
          ref={(el) => {
            localRef.current = el;
            if (inputRef) inputRef.current = el;
          }}
          type={type}
          className={styles.input}
          value={value}
          autoComplete="off"
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(validate(e.target.value));
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && onCancel) {
              e.preventDefault();
              onCancel();
            }
          }}
        />
        <button type="submit" className={styles.primaryBtn} disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className={styles.quietBtn} onClick={onCancel}>
            Hætta við
          </button>
        ) : null}
      </div>
      {hint || showCounter ? (
        <div className={styles.fieldMeta}>
          {hint ? (
            <p id={hintId} className={styles.hint}>
              {hint}
            </p>
          ) : null}
          {showCounter ? (
            <p
              id={countId}
              className={`${styles.counter} ${length > NAME_MAX ? styles.counterOver : ""}`}
            >
              {length} / {NAME_MAX}
            </p>
          ) : null}
        </div>
      ) : null}
      {/* Always in the DOM, so a new message is announced rather than just inserted. */}
      <p id={errorId} role="alert" className={styles.fieldError}>
        {error}
      </p>
    </form>
  );
}
