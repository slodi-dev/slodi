/**
 * Pieces every tag-management look shares: the name field (create and rename), the status
 * bar with "Afturkalla", and the loading, error and empty states.
 */
import React, { useEffect, useId, useRef, useState } from "react";
import { countIs } from "@/lib/format";
import { COUNTER_FROM, NAME_MAX, type Notice } from "./tagLab";
import styles from "./TagsLab.module.css";

// ── Name field ────────────────────────────────────────────────────────────────

export interface NameFieldProps {
  label: string;
  /** Keep the label for screen readers only. */
  labelHidden?: boolean;
  placeholder?: string;
  hint?: string;
  submitLabel: string;
  /** Rule 1: busy buttons say what they're doing. */
  busyLabel: string;
  /** Uncontrolled start value (rename). */
  initial?: string;
  /** Controlled value, when the field doubles as the search (look A). */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Sync check, for validating on every change once the field is in error (rule 6). */
  validate: (name: string) => string | null;
  /** Saves; resolves to an error message, or null when it worked. */
  onSubmit: (name: string) => Promise<string | null>;
  onCancel?: () => void;
  /** Empty the field after a successful save (create) rather than keep it (rename). */
  clearOnSuccess?: boolean;
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  type?: "text" | "search";
  className?: string;
}

/**
 * One text field with its own submit. The field is never disabled, only the button, so focus
 * and the phone keyboard stay put while it saves (rule 11, sc-637).
 */
export function NameField({
  label,
  labelHidden,
  placeholder,
  hint,
  submitLabel,
  busyLabel,
  initial = "",
  value: controlled,
  onValueChange,
  validate,
  onSubmit,
  onCancel,
  clearOnSuccess,
  autoFocus,
  inputRef,
  type = "text",
  className,
}: NameFieldProps) {
  const id = useId();
  const [own, setOwn] = useState(initial);
  const value = controlled ?? own;
  const setValue = (v: string) => (onValueChange ? onValueChange(v) : setOwn(v));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const localRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus) localRef.current?.select();
  }, [autoFocus]);

  const length = value.trim().length;
  const showCounter = length >= COUNTER_FROM;
  const over = length > NAME_MAX;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busyRef.current) return;
    const invalid = validate(value);
    if (invalid) {
      setError(invalid);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    const result = await onSubmit(value);
    busyRef.current = false;
    setBusy(false);
    setError(result);
    if (!result && clearOnSuccess) setValue("");
  };

  const describedBy = [hint && `${id}-hint`, showCounter && `${id}-count`, error && `${id}-error`]
    .filter(Boolean)
    .join(" ");

  return (
    <form className={`${styles.field} ${className ?? ""}`} onSubmit={submit} noValidate>
      <label htmlFor={`${id}-input`} className={labelHidden ? "sl-sr-only" : styles.fieldLabel}>
        {label}
      </label>
      <div className={styles.fieldRow}>
        <input
          id={`${id}-input`}
          ref={(el) => {
            localRef.current = el;
            if (typeof inputRef === "function") inputRef(el);
            else if (inputRef) (inputRef as React.RefObject<HTMLInputElement | null>).current = el;
          }}
          type={type}
          className={styles.input}
          value={value}
          placeholder={placeholder}
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
      <div className={styles.fieldMeta}>
        {hint ? (
          <p id={`${id}-hint`} className={styles.hint}>
            {hint}
          </p>
        ) : null}
        {showCounter ? (
          <p id={`${id}-count`} className={`${styles.counter} ${over ? styles.counterOver : ""}`}>
            {length} / {NAME_MAX}
          </p>
        ) : null}
      </div>
      {/* Always in the DOM so a new message is announced, not just inserted. */}
      <p id={`${id}-error`} role="alert" className={styles.fieldError}>
        {error}
      </p>
    </form>
  );
}

// ── Notice bar ────────────────────────────────────────────────────────────────

const NOTICE_MS = 10_000;

/**
 * The page's one status region (rule 4). A delete or merge moves focus to "Afturkalla", since
 * the button that started it has gone; the timer pauses while focus or the pointer is inside.
 */
export function NoticeBar({
  notice,
  onDismiss,
  returnFocusTo,
}: {
  notice: Notice | null;
  onDismiss: () => void;
  returnFocusTo: React.RefObject<HTMLElement | null>;
}) {
  const undoRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (notice?.undo) undoRef.current?.focus();
  }, [notice]);

  useEffect(() => {
    if (!notice || paused) return;
    const t = setTimeout(onDismiss, NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice, paused, onDismiss]);

  const close = () => {
    onDismiss();
    returnFocusTo.current?.focus();
  };

  return (
    <div
      ref={boxRef}
      role="status"
      className={notice ? styles.notice : styles.noticeEmpty}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!boxRef.current?.contains(e.relatedTarget as Node)) setPaused(false);
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {notice ? (
        <>
          <p className={styles.noticeText}>{notice.text}</p>
          {notice.undo ? (
            <button
              ref={undoRef}
              type="button"
              className={styles.noticeBtn}
              onClick={() => {
                notice.undo?.();
                closeRef.current?.focus();
              }}
            >
              Afturkalla
            </button>
          ) : null}
          <button ref={closeRef} type="button" className={styles.noticeClose} onClick={close}>
            <span aria-hidden="true">✕</span>
            <span className="sl-sr-only">Loka</span>
          </button>
        </>
      ) : null}
    </div>
  );
}

// ── Load states ───────────────────────────────────────────────────────────────

/** Rule 11: a skeleton shaped like the finished layout; static under reduced motion. */
export function LoadingState({ shape }: { shape: "rows" | "chips" | "table" | "split" }) {
  const blocks = shape === "chips" ? 12 : 6;
  return (
    <div role="status" className={`${styles.skeleton} ${styles[`skeleton-${shape}`]}`}>
      <span className="sl-sr-only">Hleð merkimiðum…</span>
      {Array.from({ length: blocks }, (_, i) => (
        <span key={i} aria-hidden="true" className={styles.skeletonBlock} data-n={i % 4} />
      ))}
    </div>
  );
}

/** Rule 3: inline, announced, says what to do next, offers "Reyna aftur". */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className={styles.loadError}>
      <p className={styles.loadErrorTitle}>Ekki tókst að sækja merkimiðana.</p>
      <p className={styles.loadErrorBody}>Athugaðu nettenginguna og reyndu aftur.</p>
      <button type="button" className={styles.secondaryBtn} onClick={onRetry}>
        Reyna aftur
      </button>
    </div>
  );
}

export function EmptyState({
  searching,
  query,
  onClear,
}: {
  searching: boolean;
  query: string;
  onClear?: () => void;
}) {
  if (searching) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Enginn merkimiði heitir „{query.trim()}“.</p>
        {onClear ? (
          <button type="button" className={styles.secondaryBtn} onClick={onClear}>
            Hreinsa leit
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>Engir merkimiðar enn.</p>
      <p className={styles.emptyBody}>
        Merkimiðar hjálpa foringjum að finna efni í bankanum. Búðu til þann fyrsta hér fyrir ofan.
      </p>
    </div>
  );
}

/** Heading block shared by every look. */
export function PageHeader({ total, loading }: { total: number; loading: boolean }) {
  return (
    <div className={styles.header}>
      <h2 className={styles.title}>Merkimiðar</h2>
      <p className={styles.lede}>
        Sameiginlegur orðaforði bankans. Ný nöfn og breytingar ná til allra eininga sem bera
        merkimiðann.
      </p>
      {!loading ? (
        <p className={styles.total}>{countIs(total, "merkimiði", "merkimiðar")}</p>
      ) : null}
    </div>
  );
}

/** Splits `name` around the search text so the match can be marked. */
export function Highlight({ name, query }: { name: string; query: string }) {
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

/** Focus an element inside `root` after React has rendered it. */
export function focusSoon(root: React.RefObject<HTMLElement | null>, selector: string) {
  setTimeout(() => root.current?.querySelector<HTMLElement>(selector)?.focus(), 0);
}
