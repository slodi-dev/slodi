"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./ContentCreateModal.module.css";
import { cn } from "@/lib/util";
import { useAuth } from "@/contexts/AuthContext";
import { useDraft } from "@/hooks/useDraft";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { useTags } from "@/hooks/useTags";
import ChipList from "./ChipList";
import TagPicker from "./TagPicker";
import FileDropZone, { type Attachment } from "./FileDropZone";
import { AGE_GROUPS, getAgeGroupPatrol } from "@/lib/format";
import DocumentViewer from "@/components/DocumentViewer/DocumentViewer";
import { createBankContent, updateBankContent, type Program } from "@/services/programs.service";
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

type SectionId = "basic" | "info" | "equipment" | "instructions" | "tags" | "media";

const SECTIONS: { id: SectionId; label: string; required?: boolean }[] = [
  { id: "basic", label: "Grunnupplýsingar", required: true },
  { id: "info", label: "Upplýsingar" },
  { id: "equipment", label: "Búnaður" },
  { id: "instructions", label: "Leiðbeiningar" },
  { id: "tags", label: "Merkimiðar" },
  { id: "media", label: "Myndir og skjöl" },
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
  equipment: string[];
  instructions: string;
  tagList: string[];
  images: Attachment[];
  documents: Attachment[];
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
  equipment: [],
  instructions: "",
  tagList: [],
  images: [],
  documents: [],
};

/**
 * Seed the form from an existing item.
 *
 * Every numeric field is a string here because the inputs are text: a number
 * input that has been cleared reports `""`, and treating that as 0 is how a
 * duration a leader deleted came back as "0 mín".
 */
function draftFromProgram(p: Program): Draft {
  const num = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  return {
    name: p.name ?? "",
    description: p.description ?? "",
    durationMin: num(p.duration_min),
    durationMax: num(p.duration_max),
    prepMin: num(p.prep_time_min),
    prepMax: num(p.prep_time_max),
    countMin: num(p.count_min),
    countMax: num(p.count_max),
    price: num(p.price),
    location: p.location ?? "",
    ages: p.age ?? [],
    equipment: p.equipment ?? [],
    instructions: p.instructions ?? "",
    tagList: (p.tags ?? []).map((t) => t.name),
    // Older items predate the list and carry only a hero; treat that as a
    // one-image list so nothing has to be migrated.
    images:
      p.media?.images?.map((i) => ({
        name: i.name,
        url: i.url,
        content_type: i.content_type ?? undefined,
      })) ?? (p.image ? [{ name: "Mynd", url: p.image }] : []),
    documents:
      p.media?.documents?.map((d) => ({
        name: d.name,
        url: d.url,
        content_type: d.content_type ?? undefined,
      })) ?? [],
  };
}

/**
 * Add an image the leader already has hosted somewhere.
 *
 * Its own small control rather than a plain field, because it appends to a
 * list: a text input bound straight to the list would add a new image on every
 * keystroke.
 */
function ImageUrlAdd({ onAdd }: { onAdd: (url: string) => void }) {
  const [value, setValue] = useState("");
  const id = "image-url-add";

  function add() {
    const url = value.trim();
    if (!url) return;
    onAdd(url);
    setValue("");
  }

  return (
    <div className={styles.fld}>
      <label className={styles.lab} htmlFor={id}>
        Eða vefslóð myndar
      </label>
      <div className={styles.chipRow}>
        <input
          id={id}
          className={styles.input}
          value={value}
          placeholder="https://…"
          onChange={(e) => setValue(e.target.value)}
          // Enter adds the image; it must not submit the whole form.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          className={cn(styles.btn, styles.btnGhost)}
          onClick={add}
          disabled={!value.trim()}
        >
          Bæta við
        </button>
      </div>
    </div>
  );
}

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
  variant = "modal",
  initial = null,
}: {
  contentType: BankContentType;
  workspaceId: string;
  onCreated: (saved: Program) => void;
  onClose: () => void;
  /**
   * `inline` drops the scrim and the dialog role and renders the same form in
   * the page. Editing an item happens in place, and the alternative — a second
   * form kept in step with this one by hand — is how the two drifted apart in
   * the first place.
   */
  variant?: "modal" | "inline";
  /** When present the form edits this item instead of creating a new one. */
  initial?: Program | null;
}) {
  const editing = initial !== null;
  const { getToken } = useAuth();
  const { tagNames } = useTags();
  // Three layouts, one form. Above 620px nothing collapses, so "an error
  // inside a collapsed section" cannot occur at those widths at all.
  const mode = useLayoutMode();
  const flowing = mode !== "phone";

  // Keyed by workspace *and* type: with four kinds, a half-written viðburður
  // reappearing inside a new verkefni reads as the form being haunted.
  const draftKey = editing ? `bank-edit-${initial.id}` : `bank-draft-${workspaceId}-${contentType}`;
  // Editing starts from what is stored, not from an empty form; `useDraft`
  // still restores an interrupted edit, keyed by the item so it cannot bleed
  // into a different one.
  const seed = useMemo(() => (initial ? draftFromProgram(initial) : EMPTY), [initial]);
  const { draft, updateDraft, clearDraft } = useDraft<Draft>(draftKey, seed);

  const [open, setOpen] = useState<SectionId[]>(["basic"]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftOffer, setDraftOffer] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Attachment | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const [here, setHere] = useState<SectionId>("basic");
  const titleId = `create-${contentType}`;

  // Which block the reader is looking at, so the index can say so. Observed
  // rather than computed from scrollTop: the blocks are different heights and
  // the last one is usually shorter than the viewport, which a proportional
  // calculation gets wrong at exactly the moment it matters.
  useEffect(() => {
    if (!flowing) return;
    const root = flowRef.current;
    if (!root) return;
    // Capability check, not a polyfill: without it the index simply stops
    // reporting position. Everything it points at is on screen anyway, so
    // losing the highlight costs nothing — crashing the form would cost
    // everything.
    if (typeof IntersectionObserver === "undefined") return;
    const blocks = [...root.querySelectorAll<HTMLElement>("[data-block]")];
    if (blocks.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setHere(top.target.getAttribute("data-block") as SectionId);
      },
      { root, rootMargin: "-8px 0px -60% 0px", threshold: 0 }
    );
    blocks.forEach((b) => observer.observe(b));
    return () => observer.disconnect();
  }, [flowing]);

  /** The index is a map, not a gate: it scrolls, then hands over the caret. */
  const goTo = useCallback((id: SectionId) => {
    const block = flowRef.current?.querySelector<HTMLElement>(`[data-block="${id}"]`);
    if (!block) return;
    block.scrollIntoView({ block: "start", behavior: "smooth" });
    // Focus the first control rather than the heading: the reader asked to go
    // somewhere in order to type there.
    block.querySelector<HTMLElement>("input, textarea, button")?.focus({ preventScroll: true });
  }, []);

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
      equipment: draft.equipment.length > 0,
      instructions: Boolean(draft.instructions.trim()),
      tags: draft.tagList.length > 0,
      media: Boolean(draft.images.length || draft.documents.length),
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
      // On a phone, open every section that holds an error — a closed one
      // would hide the reason the submit failed. At wider widths nothing is
      // collapsed, so there is nothing to open and the block is scrolled to
      // instead.
      const sections = new Set(Object.keys(found).map((f) => FIELD_SECTION[f]));
      if (!flowing) setOpen((prev) => [...new Set([...prev, ...sections])]);
      setSummary(
        count === 1
          ? "Einn reitur vantar eða er ekki réttur. Hann er merktur hér fyrir ofan."
          : `${count} reitir vantar eða eru ekki réttir. Þeir eru merktir hér fyrir ofan.`
      );
      setDone(null);
      // after the section has unrolled, or focus lands on a clipped field
      window.setTimeout(() => {
        const first = dialogRef.current?.querySelector<HTMLElement>(
          `[data-field="${Object.keys(found)[0]}"]`
        );
        // scrollIntoView first: in the flow layouts the field may be far down,
        // and focus alone would jump the container without the reader seeing
        // what moved.
        if (flowing) first?.scrollIntoView({ block: "center", behavior: "smooth" });
        first?.focus({ preventScroll: flowing });
      }, 60);
      return;
    }

    setSummary(null);
    setBusy(true);
    /*
     * An emptied field has to be *sent* when editing, not omitted.
     *
     * The PATCH uses `exclude_unset=True`, so an absent key means "leave this
     * alone". Creating can omit an empty field — there is nothing to leave
     * alone — but editing cannot: removing the last document, clearing a
     * description or unticking every age band all looked like they worked and
     * then came back on reload, because the payload simply left them out.
     *
     * So `blank` is `undefined` while creating and an explicit `null` while
     * editing.
     */
    const blank = editing ? null : undefined;
    const num = (v: string) => (v.trim() === "" ? blank : Number(v));
    const text = (v: string) => v.trim() || blank;

    try {
      const payload = {
        name: draft.name.trim(),
        description: text(draft.description),
        instructions: text(draft.instructions),
        image: draft.images[0]?.url ?? blank,
        equipment: draft.equipment,
        duration_min: num(draft.durationMin),
        duration_max: num(draft.durationMax),
        prep_time_min: num(draft.prepMin),
        prep_time_max: num(draft.prepMax),
        count_min: num(draft.countMin),
        count_max: num(draft.countMax),
        price: num(draft.price),
        location: text(draft.location),
        age: draft.ages.length ? draft.ages : blank,
        tagNames: draft.tagList,
        // Preserve any other keys `media` carries; only `documents` is ours.
        // `image` stays the hero so cards, Yfirferð and the listings keep
        // reading one URL; `media.images` carries the order.
        media: editing
          ? { ...(initial.media ?? {}), images: draft.images, documents: draft.documents }
          : draft.images.length || draft.documents.length
            ? { images: draft.images, documents: draft.documents }
            : undefined,
        workspaceId,
      };

      // Editing PATCHes the subtype's own route. `/programs/{id}` matches only
      // rows whose content_type is "program", so assuming it here is what made
      // saving a Verkefni fail the same way reading one did.
      const saved = editing
        ? await updateBankContent(contentType, initial.id, payload, getToken)
        : await createBankContent(contentType, payload, getToken);

      setDone(
        editing
          ? `Breytingar á ${draft.name.trim()} eru vistaðar.`
          : `${draft.name.trim()} er komið í bankann.`
      );
      clearDraft();
      onCreated(saved);
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

  /** The state dot. Shape as well as colour — an empty ring, a tick, or an
   *  exclamation — because colour alone would not survive greyscale. */
  const marker = (id: SectionId) => {
    const bad = errorsIn(id) > 0;
    return (
      <span
        className={cn(styles.dot, bad ? styles.secError : filled[id] && styles.secComplete)}
        aria-hidden="true"
      >
        {bad ? (
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
    );
  };

  /** The same state in words, for anyone who cannot see the dot. */
  const stateWord = (id: SectionId) => {
    const bad = errorsIn(id);
    if (bad > 0) return bad === 1 ? "— 1 villa" : `— ${bad} villur`;
    if (filled[id]) return "— útfyllt";
    return "— ekkert útfyllt";
  };

  /** Two numbers that are one value. A single „Lengd" box cannot say whether
   *  it means the minimum or the whole span, and two separately-labelled boxes
   *  make the reader assemble the range themselves. */
  const range = (
    label: string,
    from: keyof Draft,
    to: keyof Draft,
    unit: string,
    help?: string
  ) => {
    const bad = errors[from] ?? errors[to];
    const id = `f-${from}`;
    return (
      <div className={cn(styles.fld, bad && styles.fldError)} key={from}>
        <label className={styles.lab} htmlFor={id}>
          {label}
        </label>
        <div className={styles.range}>
          <input
            id={id}
            data-field={from}
            className={cn(styles.input, styles.inputNum)}
            inputMode="numeric"
            placeholder="frá"
            aria-label={`${label}, frá`}
            aria-invalid={errors[from] ? true : undefined}
            value={String(draft[from] ?? "")}
            onChange={(e) => updateDraft({ [from]: e.target.value } as Partial<Draft>)}
          />
          <span className={styles.rangeSep} aria-hidden="true">
            –
          </span>
          <input
            data-field={to}
            className={cn(styles.input, styles.inputNum)}
            inputMode="numeric"
            placeholder="til"
            aria-label={`${label}, til`}
            aria-invalid={errors[to] ? true : undefined}
            value={String(draft[to] ?? "")}
            onChange={(e) => updateDraft({ [to]: e.target.value } as Partial<Draft>)}
          />
          <span className={styles.rangeUnit}>{unit}</span>
        </div>
        {help && !bad && <p className={styles.help}>{help}</p>}
        {bad && (
          <p className={styles.err}>
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
        {/* Side by side where there is room: a column of short number pairs
            wastes the width the wide layout exists to use. */}
        <div className={styles.pair}>
          {range(
            "Tímalengd",
            "durationMin",
            "durationMax",
            "mínútur",
            "Hvað einingin tekur. Dagsetningin verður til þegar þú setur hana í dagskrá — ekki hér."
          )}
          {range("Fjöldi þátttakenda", "countMin", "countMax", "þátttakendur")}
        </div>
        <div className={styles.pair}>
          {range("Undirbúningstími", "prepMin", "prepMax", "mínútur")}
          {field("price", "Kostnaður (kr.)", { num: true, placeholder: "0" })}
        </div>
        <fieldset className={styles.group}>
          <legend className={styles.groupLegend}>Aldurshópur</legend>
          <div className={styles.checkGrid}>
            {AGE_GROUPS.map((group) => (
              <label
                key={group}
                className={styles.check}
                // Each band ticks in its own colour, so the list reads as the
                // bands a leader already knows rather than seven grey boxes.
                style={
                  {
                    "--patrol": `var(--sl-color-patrol-${getAgeGroupPatrol(group) ?? "adrir"})`,
                  } as React.CSSProperties
                }
              >
                <input
                  type="checkbox"
                  checked={draft.ages.includes(group)}
                  onChange={(e) => {
                    // Functional update: `[...draft.ages, group]` read the
                    // array captured at render, so ticking two bands in quick
                    // succession lost the first.
                    const on = e.target.checked;
                    updateDraft((prev) => ({
                      ...prev,
                      ages: on ? [...prev.ages, group] : prev.ages.filter((a) => a !== group),
                    }));
                  }}
                />
                {group}
              </label>
            ))}
          </div>
        </fieldset>
        {field("location", "Staðsetning", { placeholder: "Inni, úti, í skála…" })}
      </>
    ),
    equipment: (
      <>
        <ChipList
          // Not "Búnaður": the section is already called that, and a field
          // repeating its own section's name is noise a screen reader reads
          // twice. The form asks questions elsewhere — so does this.
          label="Hvað þarf?"
          addLabel="Bæta búnaði á lista"
          placeholder="Kaðall, karabínur, hjálmar"
          items={draft.equipment}
          onAdd={(value) =>
            updateDraft((prev) => ({ ...prev, equipment: [...prev.equipment, value] }))
          }
          onRemove={(value) =>
            updateDraft((prev) => ({
              ...prev,
              equipment: prev.equipment.filter((e) => e !== value),
            }))
          }
        />
      </>
    ),
    instructions: field("instructions", "Hvernig gengur þetta fyrir sig?", {
      area: true,
      placeholder: "Skref fyrir skref",
    }),
    tags: (
      <TagPicker
        available={tagNames ?? []}
        selected={draft.tagList}
        onToggle={(tag) =>
          updateDraft((prev) => ({
            ...prev,
            tagList: prev.tagList.includes(tag)
              ? prev.tagList.filter((t) => t !== tag)
              : [...prev.tagList, tag],
          }))
        }
      />
    ),
    media: (
      <>
        <FileDropZone
          images={draft.images}
          documents={draft.documents}
          onAddImages={(added) =>
            updateDraft((prev) => ({ ...prev, images: [...prev.images, ...added] }))
          }
          onRemoveImage={(url) =>
            updateDraft((prev) => ({ ...prev, images: prev.images.filter((i) => i.url !== url) }))
          }
          onReorderImages={(from, to) =>
            updateDraft((prev) => {
              const next = [...prev.images];
              const [moved] = next.splice(from, 1);
              next.splice(to, 0, moved);
              return { ...prev, images: next };
            })
          }
          onAddDocuments={(added) =>
            updateDraft((prev) => ({ ...prev, documents: [...prev.documents, ...added] }))
          }
          onPreviewDocument={setPreviewDoc}
          onReorderDocuments={(from, to) =>
            updateDraft((prev) => {
              const next = [...prev.documents];
              const [moved] = next.splice(from, 1);
              next.splice(to, 0, moved);
              return { ...prev, documents: next };
            })
          }
          onRemoveDocument={(url) =>
            updateDraft((prev) => ({
              ...prev,
              documents: prev.documents.filter((d) => d.url !== url),
            }))
          }
        />
        {/* …or a link. A leader who already has the picture hosted should not
            have to download it in order to re-upload it. It appends to the
            list like any other image. */}
        <ImageUrlAdd
          onAdd={(url) =>
            updateDraft((prev) => ({
              ...prev,
              images: [...prev.images, { name: "Mynd af vefslóð", url }],
            }))
          }
        />
      </>
    ),
  };

  const form = (
    <div
      ref={dialogRef}
      className={cn(
        styles.dialog,
        variant === "inline" && styles.inline,
        mode === "wide" && styles.wide,
        mode === "half" && styles.half,
        TYPE_ACCENT[contentType]
      )}
      // Inline is part of the page, not a layer over it: no dialog role, no
      // modal semantics, and Escape belongs to the page rather than to this.
      role={variant === "modal" ? "dialog" : undefined}
      aria-modal={variant === "modal" ? true : undefined}
      aria-labelledby={titleId}
      onKeyDown={variant === "modal" ? onKeyDown : undefined}
    >
      <div className={styles.head}>
        <div className={styles.headRow}>
          <h2 className={styles.title} id={titleId}>
            {editing ? "Breyta" : "Bæta við"} — <em>{TYPE_WORD[contentType]}</em>
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
            <p className={styles.draftText}>
              {editing
                ? "Þú áttir óvistaðar breytingar frá því síðast."
                : "Þú áttir ósent drög frá því síðast."}
            </p>
            <button type="button" className={styles.draftAct} onClick={() => setDraftOffer(false)}>
              {editing ? "Halda áfram með þær" : "Halda áfram með þau"}
            </button>
            <button
              type="button"
              className={styles.draftAct}
              onClick={() => {
                clearDraft();
                setDraftOffer(false);
              }}
            >
              {editing ? "Byrja frá því sem er vistað" : "Byrja upp á nýtt"}
            </button>
          </div>
        )}
      </div>

      {flowing ? (
        <div className={cn(styles.body)}>
          {/* Wide gets a rail beside the flow; half gets the same flow with the
              index as a chip row. Both are `nav` landmarks with the same label,
              so the shape changes and the meaning does not. */}
          {mode === "wide" ? (
            <nav className={styles.nav} aria-label="Hlutar eyðublaðsins">
              <p className={styles.navTitle}>Á eyðublaðinu</p>
              {SECTIONS.map(({ id, label, required }) => (
                <button
                  key={id}
                  type="button"
                  className={cn(styles.navItem, here === id && styles.navHere)}
                  aria-current={here === id ? "true" : undefined}
                  onClick={() => goTo(id)}
                >
                  {marker(id)}
                  <span className={styles.navLabel}>
                    {label}{" "}
                    {required && (
                      <span className={styles.blockReq} aria-hidden="true">
                        *
                      </span>
                    )}
                  </span>
                  {/* The dot is decorative; this is the same state in words. */}
                  <span className="sl-sr-only">{stateWord(id)}</span>
                </button>
              ))}
            </nav>
          ) : null}

          <div className={styles.flow} ref={flowRef}>
            {mode === "half" && (
              <nav className={styles.rail} aria-label="Hlutar eyðublaðsins">
                {SECTIONS.map(({ id, label, required }) => (
                  <button
                    key={id}
                    type="button"
                    className={cn(styles.railChip, here === id && styles.railHere)}
                    aria-current={here === id ? "true" : undefined}
                    onClick={() => goTo(id)}
                  >
                    {marker(id)}
                    {label}
                    {required && (
                      <span className={styles.blockReq} aria-hidden="true">
                        *
                      </span>
                    )}
                    <span className="sl-sr-only">{stateWord(id)}</span>
                  </button>
                ))}
              </nav>
            )}

            {SECTIONS.map(({ id, label, required }) => (
              <section
                key={id}
                className={styles.block}
                data-block={id}
                aria-labelledby={`h-${id}`}
              >
                <div className={styles.blockHead}>
                  {marker(id)}
                  <h3 className={styles.blockLabel} id={`h-${id}`}>
                    {label}{" "}
                    {required && (
                      <span className={styles.blockReq} aria-hidden="true">
                        *
                      </span>
                    )}
                  </h3>
                  {errorsIn(id) > 0 && (
                    <span className={styles.flag}>
                      {errorsIn(id) === 1 ? "1 villa" : `${errorsIn(id)} villur`}
                    </span>
                  )}
                </div>
                {panels[id]}
              </section>
            ))}
          </div>
        </div>
      ) : (
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
                  {marker(id)}
                  <span className={styles.secLabel}>
                    {label}{" "}
                    {required && (
                      <span className={styles.req} aria-hidden="true">
                        *
                      </span>
                    )}
                  </span>
                  <span className="sl-sr-only">{stateWord(id)}</span>
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
      )}

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
              if (editing) onClose();
            }}
          >
            {editing ? "Hætta við" : "Hreinsa"}
          </button>
          <button
            type="button"
            className={cn(styles.btn, styles.btnPrimary)}
            aria-disabled={busy}
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy && <span className={styles.spin} aria-hidden="true" />}
            {editing ? "Vista breytingar" : "Bæta í bankann"}
          </button>
        </div>
      </div>
    </div>
  );

  const withPreview = (
    <>
      {form}
      <DocumentViewer
        doc={previewDoc}
        open={previewDoc !== null}
        onClose={() => setPreviewDoc(null)}
      />
    </>
  );

  if (variant === "inline") return withPreview;

  return (
    <div
      className={styles.backdrop}
      // Clicking away closes it, but only from the scrim itself — a click that
      // started inside the form and drifted out must not discard the draft.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {withPreview}
    </div>
  );
}
