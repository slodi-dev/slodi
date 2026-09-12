"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./ContentCreateModal.module.css";
import { cn } from "@/lib/util";
import { useAuth } from "@/contexts/AuthContext";
import { useDraft } from "@/hooks/useDraft";
import { useTags } from "@/hooks/useTags";
import { createBankContent, type Program } from "@/services/programs.service";
import type { BankContentType } from "@/components/ContentTypeChooser/ContentTypeChooser";

/** The four kinds, in the accusative — the title reads "Bæta við — verkefni". */
const TYPE_WORD: Record<BankContentType, string> = {
  task: "verkefni",
  event: "viðburði",
  program: "dagskrá",
};
const TYPE_ACCENT: Record<BankContentType, string> = {
  task: styles.typeTask,
  event: styles.typeEvent,
  program: styles.typeHringur,
};

const AGE_GROUPS = [
  "Drekaskátar",
  "Fálkaskátar",
  "Dróttskátar",
  "Rekkaskátar",
  "Róverskátar",
] as const;

type SectionId = "basic" | "info" | "equipment" | "instructions" | "extras";

const SECTIONS: { id: SectionId; label: string; required?: boolean }[] = [
  { id: "basic", label: "Grunnupplýsingar", required: true },
  { id: "info", label: "Upplýsingar" },
  { id: "equipment", label: "Gögn og búnaður" },
  { id: "instructions", label: "Leiðbeiningar" },
  { id: "extras", label: "Merkimiðar og mynd" },
];

type Draft = {
  name: string;
  description: string;
  durationMin: string;
  durationMax: string;
  prepMin: string;
  prepMax: string;
  countMin: string;
  countMax: string;
  price: string;
  location: string;
  ages: string[];
  equipment: string;
  instructions: string;
  tags: string;
  image: string;
};

const EMPTY: Draft = {
  name: "",
  description: "",
  durationMin: "",
  durationMax: "",
  prepMin: "",
  prepMax: "",
  countMin: "",
  countMax: "",
  price: "",
  location: "",
  ages: [],
  equipment: "",
  instructions: "",
  tags: "",
  image: "",
};

/** Which section each field lives in, so a failed submit can open the right one. */
const FIELD_SECTION: Record<string, SectionId> = {
  name: "basic",
  durationMin: "info",
  durationMax: "info",
  prepMin: "info",
  prepMax: "info",
  countMin: "info",
  countMax: "info",
  price: "info",
};

const numeric = (v: string) => v.trim() === "" || /^\d+$/.test(v.trim());

/**
 * The bank's create form.
 *
 * Built from the reviewed ContentCreateModal design. Three things it fixes,
 * every one of which had shipped:
 *
 *  * **The error region is pinned below the scroll.** It used to sit at the
 *    bottom of a scrolling modal, so on a phone a failed submit looked like
 *    the form had done nothing at all.
 *  * **A collapsed section reports its own error** and expands itself on
 *    submit, instead of hiding the reason the submit failed.
 *  * **The draft notice is one line in the fixed header**, so it no longer
 *    pushes the first field off screen. Info tone, not warning: a recovered
 *    draft is good news, and red is spoken for by the error region below it.
 *
 * **No date fields, anywhere.** A bank entry is a template, not an occurrence:
 * it has a length and never a start. The date comes into existence when a
 * leader places the entry in a plan, and belongs to that placement.
 */
export default function ContentCreateModal({
  contentType,
  workspaceId,
  onCreated,
  onClose,
}: {
  contentType: BankContentType;
  workspaceId: string;
  onCreated: (created: Program) => void;
  onClose: () => void;
}) {
  const { getToken } = useAuth();
  const { tagNames } = useTags();

  // Keyed by workspace *and* type: with four kinds, a half-written viðburður
  // reappearing inside a new verkefni reads as the form being haunted.
  const draftKey = `bank-draft-${workspaceId}-${contentType}`;
  const { draft, updateDraft, clearDraft } = useDraft<Draft>(draftKey, EMPTY);

  const [open, setOpen] = useState<SectionId[]>(["basic"]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftOffer, setDraftOffer] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = `create-${contentType}`;

  // An unsent draft is offered, never silently restored: reopening the form and
  // finding someone else's half-finished text already in it is worse than
  // losing it.
  useEffect(() => {
    const meaningful = draft.name.trim() || draft.description.trim();
    if (meaningful) setDraftOffer(true);
    // once, on mount — later keystrokes are the author's own
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus the first field, and trap focus in the dialog. Escape closes.
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("input, textarea, button")?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'input, textarea, button, [href], select, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    },
    [onClose]
  );

  const toggle = (id: SectionId) =>
    setOpen((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  /** A section is complete when it holds data and no errors. */
  const filled = useMemo<Record<SectionId, boolean>>(
    () => ({
      basic: Boolean(draft.name.trim() || draft.description.trim()),
      info: Boolean(
        draft.durationMin ||
        draft.durationMax ||
        draft.prepMin ||
        draft.prepMax ||
        draft.countMin ||
        draft.countMax ||
        draft.price ||
        draft.location.trim() ||
        draft.ages.length
      ),
      equipment: Boolean(draft.equipment.trim()),
      instructions: Boolean(draft.instructions.trim()),
      extras: Boolean(draft.tags.trim() || draft.image.trim()),
    }),
    [draft]
  );

  const errorsIn = (id: SectionId) =>
    Object.keys(errors).filter((f) => FIELD_SECTION[f] === id).length;

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!draft.name.trim()) next.name = "Heiti hugmyndar er nauðsynlegt";
    for (const [field, label] of [
      ["durationMin", "Lengd"],
      ["durationMax", "Lengd"],
      ["prepMin", "Undirbúningur"],
      ["prepMax", "Undirbúningur"],
      ["countMin", "Fjöldi þátttakenda"],
      ["countMax", "Fjöldi þátttakenda"],
      ["price", "Kostnaður"],
    ] as const) {
      if (!numeric(draft[field])) next[field] = `${label} þarf að vera tala`;
    }
    return next;
  }

  async function submit() {
    const found = validate();
    setErrors(found);
    const count = Object.keys(found).length;

    if (count > 0) {
      // Open every section that holds an error — a closed one would hide the
      // reason the submit failed — then say so and move focus to the first.
      const sections = new Set(Object.keys(found).map((f) => FIELD_SECTION[f]));
      setOpen((prev) => [...new Set([...prev, ...sections])]);
      setSummary(
        count === 1
          ? "Einn reitur vantar eða er ekki réttur. Hann er merktur hér fyrir ofan."
          : `${count} reitir vantar eða eru ekki réttir. Þeir eru merktir hér fyrir ofan.`
      );
      setDone(null);
      // after the section has unrolled, or focus lands on a clipped field
      window.setTimeout(() => {
        dialogRef.current
          ?.querySelector<HTMLElement>(`[data-field="${Object.keys(found)[0]}"]`)
          ?.focus();
      }, 60);
      return;
    }

    setSummary(null);
    setBusy(true);
    const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
    try {
      const created = await createBankContent(
        contentType,
        {
          name: draft.name.trim(),
          description: draft.description.trim() || undefined,
          instructions: draft.instructions.trim() || undefined,
          image: draft.image.trim() || undefined,
          equipment: draft.equipment
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean),
          duration_min: num(draft.durationMin),
          duration_max: num(draft.durationMax),
          prep_time_min: num(draft.prepMin),
          prep_time_max: num(draft.prepMax),
          count_min: num(draft.countMin),
          count_max: num(draft.countMax),
          price: num(draft.price),
          location: draft.location.trim() || undefined,
          age: draft.ages.length ? draft.ages : undefined,
          tagNames: draft.tags
            .split(/[,#]/)
            .map((t) => t.trim())
            .filter(Boolean),
          workspaceId,
        },
        getToken
      );
      setDone(`${draft.name.trim()} er komið í bankann.`);
      clearDraft();
      onCreated(created);
    } catch (e) {
      setSummary(e instanceof Error ? e.message : "Ekki tókst að vista. Reyndu aftur.");
    } finally {
      setBusy(false);
    }
  }

  const field = (
    name: keyof Draft,
    label: string,
    extra?: {
      area?: boolean;
      num?: boolean;
      placeholder?: string;
      help?: string;
      required?: boolean;
    }
  ) => {
    const bad = errors[name];
    const id = `f-${name}`;
    const Tag = extra?.area ? "textarea" : "input";
    return (
      <div className={cn(styles.fld, bad && styles.fldError)} key={name}>
        <label className={styles.lab} htmlFor={id}>
          {label} {extra?.required && <span aria-hidden="true">*</span>}
        </label>
        <Tag
          id={id}
          data-field={name}
          className={cn(styles.input, extra?.num && styles.inputNum)}
          rows={extra?.area ? 2 : undefined}
          inputMode={extra?.num ? "numeric" : undefined}
          placeholder={extra?.placeholder}
          aria-invalid={bad ? true : undefined}
          aria-describedby={bad ? `${id}-err` : extra?.help ? `${id}-help` : undefined}
          aria-required={extra?.required}
          value={String(draft[name] ?? "")}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            updateDraft({ [name]: e.target.value } as Partial<Draft>)
          }
        />
        {extra?.help && !bad && (
          <p className={styles.help} id={`${id}-help`}>
            {extra.help}
          </p>
        )}
        {bad && (
          <p className={styles.err} id={`${id}-err`}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="8" x2="12" y2="13" />
              <line x1="12" y1="16" x2="12" y2="16" />
            </svg>
            {bad}
          </p>
        )}
      </div>
    );
  };

  const panels: Record<SectionId, React.ReactNode> = {
    basic: (
      <>
        {field("name", "Heiti hugmyndar", {
          required: true,
          placeholder: "t.d. Kötturinn og músin",
        })}
        {field("description", "Lýsing", { area: true, placeholder: "Hvað gerist og til hvers?" })}
      </>
    ),
    info: (
      <>
        {field("durationMin", "Lengd (mínútur)", {
          num: true,
          placeholder: "t.d. 15",
          help: "Hvað eining tekur. Dagsetningin verður til þegar þú setur hana í dagskrá.",
        })}
        {field("durationMax", "Lengd, að hámarki (mínútur)", { num: true, placeholder: "t.d. 25" })}
        <fieldset className={styles.fld}>
          <legend className={styles.lab}>Aldurshópur</legend>
          {AGE_GROUPS.map((group) => (
            <label key={group} className={styles.help} style={{ display: "flex", gap: 8 }}>
              <input
                type="checkbox"
                checked={draft.ages.includes(group)}
                onChange={(e) =>
                  updateDraft({
                    ages: e.target.checked
                      ? [...draft.ages, group]
                      : draft.ages.filter((a) => a !== group),
                  })
                }
              />
              {group}
            </label>
          ))}
        </fieldset>
        {field("countMin", "Fjöldi þátttakenda, minnst", { num: true, placeholder: "t.d. 12" })}
        {field("countMax", "Fjöldi þátttakenda, mest", { num: true, placeholder: "t.d. 30" })}
        {field("prepMin", "Undirbúningur (mínútur)", { num: true, placeholder: "t.d. 10" })}
        {field("price", "Kostnaður (kr.)", { num: true, placeholder: "0" })}
        {field("location", "Staðsetning", { placeholder: "Inni, úti, í skála…" })}
      </>
    ),
    equipment: field("equipment", "Búnaður", { placeholder: "Reipi, blindföt, kubbar" }),
    instructions: field("instructions", "Hvernig gengur þetta fyrir sig?", {
      area: true,
      placeholder: "Skref fyrir skref",
    }),
    extras: (
      <>
        {field("tags", "Merkimiðar", {
          placeholder: "#leikur #inni",
          help: tagNames?.length ? `Til eru t.d. ${tagNames.slice(0, 4).join(", ")}.` : undefined,
        })}
        {field("image", "Mynd (vefslóð)", { placeholder: "https://…" })}
      </>
    ),
  };

  return (
    <div
      className={styles.backdrop}
      // Clicking away closes it, but only from the scrim itself — a click that
      // started inside the form and drifted out must not discard the draft.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={cn(styles.dialog, TYPE_ACCENT[contentType])}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <div className={styles.head}>
          <div className={styles.headRow}>
            <h2 className={styles.title} id={titleId}>
              Bæta við — <em>{TYPE_WORD[contentType]}</em>
            </h2>
            <button type="button" className={styles.close} aria-label="Loka" onClick={onClose}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>
          {draftOffer && (
            <div className={styles.draft} role="status">
              <svg
                className={styles.draftIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="11" x2="12" y2="16" />
                <line x1="12" y1="8" x2="12" y2="8" />
              </svg>
              <p className={styles.draftText}>Þú áttir ósent drög frá því síðast.</p>
              <button
                type="button"
                className={styles.draftAct}
                onClick={() => setDraftOffer(false)}
              >
                Halda áfram með þau
              </button>
              <button
                type="button"
                className={styles.draftAct}
                onClick={() => {
                  clearDraft();
                  setDraftOffer(false);
                }}
              >
                Byrja upp á nýtt
              </button>
            </div>
          )}
        </div>

        <div className={styles.body}>
          {SECTIONS.map(({ id, label, required }) => {
            const isOpen = open.includes(id);
            const bad = errorsIn(id);
            const panelId = `panel-${id}`;
            return (
              <div
                key={id}
                className={cn(
                  styles.sec,
                  isOpen && styles.secOpen,
                  bad > 0 ? styles.secError : filled[id] && styles.secComplete
                )}
              >
                <button
                  type="button"
                  className={styles.secBtn}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(id)}
                >
                  <span className={styles.dot} aria-hidden="true">
                    {bad > 0 ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      >
                        <line x1="12" y1="7" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12" y2="17" />
                      </svg>
                    ) : filled[id] ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : null}
                  </span>
                  <span className={styles.secLabel}>
                    {label}{" "}
                    {required && (
                      <span className={styles.req} aria-hidden="true">
                        *
                      </span>
                    )}
                  </span>
                  {/* A closed section still says it holds an error. */}
                  {bad > 0 && (
                    <span className={styles.flag}>{bad === 1 ? "1 villa" : `${bad} villur`}</span>
                  )}
                  <svg
                    className={styles.chev}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <div className={styles.panelWrap}>
                  <div className={styles.panel} id={panelId}>
                    {panels[id]}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.foot}>
          {summary && (
            <p className={styles.errBar} role="alert">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="8" x2="12" y2="13" />
                <line x1="12" y1="16" x2="12" y2="16" />
              </svg>
              {summary}
            </p>
          )}
          {done && (
            <p className={styles.okBar} role="status">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {done}
            </p>
          )}
          <div className={styles.acts}>
            <button
              type="button"
              className={cn(styles.btn, styles.btnGhost)}
              onClick={() => {
                clearDraft();
                setErrors({});
                setSummary(null);
                setDone(null);
              }}
            >
              Hreinsa
            </button>
            <button
              type="button"
              className={cn(styles.btn, styles.btnPrimary)}
              aria-disabled={busy}
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy && <span className={styles.spin} aria-hidden="true" />}
              Bæta í bankann
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
