"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./NewProgramForm.module.css";
import type { Program } from "@/services/programs.service";
import { createProgram } from "@/services/programs.service";
import { useTags } from "@/hooks/useTags";
import { useDraft } from "@/hooks/useDraft";
import { handleApiErrorIs } from "@/lib/api-utils";
import { useAuth } from "@/hooks/useAuth";

// ── Types ────────────────────────────────────────────────────────────────────

type ProgramDraft = {
  name: string;
  description: string;
  image: string;
  instructions: string;
  equipment: string[];
  durationMin: string;
  durationMax: string;
  prepTimeMin: string;
  prepTimeMax: string;
  selectedAgeGroups: string[];
  location: string;
  countMin: string;
  countMax: string;
  price: string;
  selectedTags: string[];
};

type SectionId = "basic" | "info" | "equipment" | "instructions" | "extras";

// ── Constants ────────────────────────────────────────────────────────────────

const INITIAL_DRAFT: ProgramDraft = {
  name: "",
  description: "",
  image: "",
  instructions: "",
  equipment: [],
  durationMin: "",
  durationMax: "",
  prepTimeMin: "",
  prepTimeMax: "",
  selectedAgeGroups: [],
  location: "",
  countMin: "",
  countMax: "",
  price: "",
  selectedTags: [],
};

const SECTIONS: Array<{ id: SectionId; title: string; required?: boolean }> = [
  { id: "basic", title: "Grunnupplýsingar", required: true },
  { id: "info", title: "Upplýsingar" },
  { id: "equipment", title: "Gögn og búnaður" },
  { id: "instructions", title: "Leiðbeiningar" },
  { id: "extras", title: "Merkimiðar og mynd" },
];

const AGE_GROUPS = [
  "Hrefnuskátar",
  "Drekaskátar",
  "Fálkaskátar",
  "Dróttskátar",
  "Rekkaskátar",
  "Róverskátar",
  "Vættaskátar",
];

const PLACEHOLDER_TAGS = [
  "útivist", "innileikur", "list", "sköpun",
  "matreiðsla", "leikur", "fræðsla", "náttúrufræði",
];

// ── Props ────────────────────────────────────────────────────────────────────

type Props = {
  workspaceId: string;
  onCreated?: (program: Program) => void;
  onCancel?: () => void;
};

// ── Component ────────────────────────────────────────────────────────────────

export default function NewProgramForm({ workspaceId, onCreated, onCancel }: Props) {
  const { getToken } = useAuth();
  const { tagNames: availableTags } = useTags();
  const displayTags = availableTags && availableTags.length > 0 ? availableTags : PLACEHOLDER_TAGS;

  // Draft state — workspace-scoped key so drafts don't bleed between workspaces
  const draftKey = `prog-draft-${workspaceId}`;
  const { draft, updateDraft, clearDraft } = useDraft<ProgramDraft>(draftKey, INITIAL_DRAFT);

  // Transient UI state (not persisted)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [equipmentInput, setEquipmentInput] = useState("");
  const [openSections, setOpenSections] = useState<SectionId[]>(["basic"]);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  // Show draft-restored banner if localStorage had meaningful content on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(draftKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<ProgramDraft>;
      const hasContent =
        !!parsed.name ||
        !!parsed.description ||
        !!parsed.instructions ||
        (parsed.equipment?.length ?? 0) > 0 ||
        (parsed.selectedTags?.length ?? 0) > 0;
      setShowDraftBanner(hasContent);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // ── Accordion helpers ──────────────────────────────────────────────────────

  const toggleSection = (id: SectionId) => {
    setOpenSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  /** Returns true if the section has any filled content. */
  const sectionHasData = (id: SectionId): boolean => {
    switch (id) {
      case "basic":
        return !!draft.name || !!draft.description;
      case "info":
        return (
          !!draft.durationMin || !!draft.durationMax ||
          !!draft.prepTimeMin || !!draft.prepTimeMax ||
          !!draft.location || !!draft.price ||
          !!draft.countMin || !!draft.countMax ||
          draft.selectedAgeGroups.length > 0
        );
      case "equipment":
        return draft.equipment.length > 0;
      case "instructions":
        return !!draft.instructions;
      case "extras":
        return draft.selectedTags.length > 0 || !!draft.image;
    }
  };

  /** Short summary shown in the collapsed header when the section has data. */
  const sectionSummary = (id: SectionId): string | null => {
    switch (id) {
      case "basic":
        return draft.name || null;
      case "info": {
        const parts: string[] = [];
        if (draft.durationMin || draft.durationMax)
          parts.push(`${draft.durationMin || "?"}–${draft.durationMax || "?"}m`);
        if (draft.location) parts.push(draft.location);
        if (draft.selectedAgeGroups.length > 0)
          parts.push(`${draft.selectedAgeGroups.length} hópar`);
        return parts.length > 0 ? parts.join(" · ") : null;
      }
      case "equipment":
        return draft.equipment.length > 0 ? `${draft.equipment.length} hlutir` : null;
      case "instructions":
        return draft.instructions
          ? draft.instructions.slice(0, 48) + (draft.instructions.length > 48 ? "…" : "")
          : null;
      case "extras":
        return draft.selectedTags.length > 0
          ? `${draft.selectedTags.length} merkar`
          : null;
    }
  };

  // ── Equipment helpers ──────────────────────────────────────────────────────

  const addEquipmentItem = () => {
    const trimmed = equipmentInput.trim();
    if (!trimmed || draft.equipment.includes(trimmed)) return;
    updateDraft({ equipment: [...draft.equipment, trimmed] });
    setEquipmentInput("");
  };

  const removeEquipmentItem = (item: string) => {
    updateDraft({ equipment: draft.equipment.filter((e) => e !== item) });
  };

  const handleEquipmentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addEquipmentItem();
    }
  };

  // ── Submit / Reset ─────────────────────────────────────────────────────────

  const handleDiscard = () => {
    clearDraft();
    setEquipmentInput("");
    setShowDraftBanner(false);
    setError(null);
    setOpenSections(["basic"]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!draft.name.trim()) {
      setError("Heiti hugmyndar er nauðsynlegt");
      if (!openSections.includes("basic")) setOpenSections((prev) => [...prev, "basic"]);
      return;
    }

    setLoading(true);
    try {
      const program = await createProgram(
        {
          name: draft.name.trim(),
          description: draft.description.trim() || undefined,
          image: draft.image.trim() || undefined,
          instructions: draft.instructions.trim() || undefined,
          equipment: draft.equipment.length > 0 ? draft.equipment : undefined,
          duration:
            draft.durationMin || draft.durationMax
              ? [draft.durationMin, draft.durationMax].filter(Boolean).join("–") + " mín"
              : undefined,
          prep_time:
            draft.prepTimeMin || draft.prepTimeMax
              ? [draft.prepTimeMin, draft.prepTimeMax].filter(Boolean).join("–") + " mín"
              : undefined,
          age:
            draft.selectedAgeGroups.length > 0
              ? draft.selectedAgeGroups.join(", ")
              : undefined,
          location: draft.location.trim() || undefined,
          count: draft.countMin !== "" ? Number(draft.countMin) : undefined,
          price: draft.price !== "" ? Number(draft.price) : undefined,
          tags: draft.selectedTags.length > 0 ? draft.selectedTags : undefined,
          workspaceId,
        },
        getToken
      );
      clearDraft();
      setEquipmentInput("");
      setShowDraftBanner(false);
      setOpenSections(["basic"]);
      onCreated?.(program);
    } catch (err) {
      setError(handleApiErrorIs(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <form className={styles.form} onSubmit={handleSubmit} aria-label="Ný dagskrá">

      {/* ── Draft restored banner ── */}
      {showDraftBanner && (
        <div className={styles.draftBanner} role="status">
          <span className={styles.draftBannerText}>
            📝 Óvisttar drakar fundust og voru endurheimt
          </span>
          <button
            type="button"
            className={styles.draftBannerDiscard}
            onClick={handleDiscard}
          >
            Fleygja drögum
          </button>
        </div>
      )}

      {/* ── Accordion sections ── */}
      {SECTIONS.map(({ id, title, required }) => {
        const isOpen = openSections.includes(id);
        const hasFilled = sectionHasData(id);
        const summary = sectionSummary(id);

        return (
          <div key={id} className={styles.accordionItem}>

            {/* Header */}
            <button
              type="button"
              id={`accordion-btn-${id}`}
              className={styles.accordionHeader}
              onClick={() => toggleSection(id)}
              aria-expanded={isOpen}
              aria-controls={`accordion-${id}`}
            >
              <span
                className={`${styles.accordionDot} ${hasFilled ? styles.accordionDotFilled : ""}`}
                aria-hidden="true"
              />
              <span className={styles.accordionTitle}>
                {title}
                {required && <em className={styles.accordionRequired}> *</em>}
              </span>
              {!isOpen && summary && (
                <span className={styles.accordionSummary} aria-hidden="true">
                  {summary}
                </span>
              )}
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={`${styles.accordionChevron} ${isOpen ? styles.accordionChevronOpen : ""}`}
              />
            </button>

            {/* Animated content */}
            <div
              id={`accordion-${id}`}
              className={`${styles.accordionContent} ${isOpen ? styles.accordionContentOpen : ""}`}
              role="region"
              aria-labelledby={`accordion-btn-${id}`}
            >
              <div className={styles.accordionContentInner}>
                <div className={styles.accordionBody}>
                  {id === "basic" && (
                    <SectionBasic draft={draft} updateDraft={updateDraft} />
                  )}
                  {id === "info" && (
                    <SectionInfo draft={draft} updateDraft={updateDraft} />
                  )}
                  {id === "equipment" && (
                    <SectionEquipment
                      draft={draft}
                      updateDraft={updateDraft}
                      equipmentInput={equipmentInput}
                      setEquipmentInput={setEquipmentInput}
                      addEquipmentItem={addEquipmentItem}
                      removeEquipmentItem={removeEquipmentItem}
                      handleEquipmentKeyDown={handleEquipmentKeyDown}
                    />
                  )}
                  {id === "instructions" && (
                    <SectionInstructions draft={draft} updateDraft={updateDraft} />
                  )}
                  {id === "extras" && (
                    <SectionExtras
                      draft={draft}
                      updateDraft={updateDraft}
                      displayTags={displayTags}
                    />
                  )}
                </div>
              </div>
            </div>

          </div>
        );
      })}

      {/* ── Error ── */}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {/* ── Actions ── */}
      <div className={styles.actions}>
        {onCancel && (
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={onCancel}
            disabled={loading}
          >
            Hætta við
          </button>
        )}
        <button
          type="button"
          className={styles.buttonSecondary}
          onClick={handleDiscard}
          disabled={loading}
        >
          Hreinsa
        </button>
        <button
          type="submit"
          className={styles.buttonPrimary}
          disabled={loading || !draft.name.trim()}
        >
          {loading ? "Býr til…" : "Búa til hugmynd"}
        </button>
      </div>

    </form>
  );
}

// ── Section sub-components ───────────────────────────────────────────────────

type DraftProps = {
  draft: ProgramDraft;
  updateDraft: (patch: Partial<ProgramDraft> | ((prev: ProgramDraft) => ProgramDraft)) => void;
};

function SectionBasic({ draft, updateDraft }: DraftProps) {
  return (
    <>
      <div className={styles.field}>
        <label htmlFor="program-name" className={styles.label}>
          Heiti hugmyndar <span className={styles.required}>*</span>
        </label>
        <input
          id="program-name"
          type="text"
          className={styles.input}
          value={draft.name}
          onChange={(e) => updateDraft({ name: e.target.value })}
          placeholder="t.d. Náttúruganga í skóginum"
          required
          maxLength={100}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="program-description" className={styles.label}>
          Lýsing
        </label>
        <textarea
          id="program-description"
          className={styles.textarea}
          value={draft.description}
          onChange={(e) => updateDraft({ description: e.target.value })}
          placeholder="Stutt lýsing sem hjálpar öðrum að skilja hugmyndina..."
          rows={3}
          maxLength={1000}
        />
        <p className={styles.hint}>{draft.description.length}/1000</p>
      </div>
    </>
  );
}

function SectionInfo({ draft, updateDraft }: DraftProps) {
  return (
    <>
      <div className={styles.fieldGrid}>

        <div className={styles.field}>
          <label className={styles.label}>Tímalengd (mín)</label>
          <div className={styles.rangeRow}>
            <input
              id="program-duration-min"
              type="number"
              className={styles.input}
              value={draft.durationMin}
              onChange={(e) => updateDraft({ durationMin: e.target.value })}
              placeholder="Frá"
              min={0}
              aria-label="Lágmarkstímalengd í mínútum"
            />
            <span className={styles.rangeSeparator} aria-hidden="true">–</span>
            <input
              id="program-duration-max"
              type="number"
              className={styles.input}
              value={draft.durationMax}
              onChange={(e) => updateDraft({ durationMax: e.target.value })}
              placeholder="Til"
              min={0}
              aria-label="Hámarkstímalengd í mínútum"
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Undirbúningstími (mín)</label>
          <div className={styles.rangeRow}>
            <input
              id="program-prep-min"
              type="number"
              className={styles.input}
              value={draft.prepTimeMin}
              onChange={(e) => updateDraft({ prepTimeMin: e.target.value })}
              placeholder="Frá"
              min={0}
              aria-label="Lágmarks undirbúningstími í mínútum"
            />
            <span className={styles.rangeSeparator} aria-hidden="true">–</span>
            <input
              id="program-prep-max"
              type="number"
              className={styles.input}
              value={draft.prepTimeMax}
              onChange={(e) => updateDraft({ prepTimeMax: e.target.value })}
              placeholder="Til"
              min={0}
              aria-label="Hámarks undirbúningstími í mínútum"
            />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="program-location" className={styles.label}>Staðsetning</label>
          <input
            id="program-location"
            type="text"
            className={styles.input}
            value={draft.location}
            onChange={(e) => updateDraft({ location: e.target.value })}
            placeholder="t.d. Úti, Inni"
            maxLength={255}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="program-price" className={styles.label}>Kostnaður</label>
          <select
            id="program-price"
            className={styles.select}
            value={draft.price}
            onChange={(e) => updateDraft({ price: e.target.value })}
          >
            <option value="">Veldu kostnaðarstig</option>
            <option value="0">Kostnaðarlaust</option>
            <option value="1">kr — Lítill kostnaður</option>
            <option value="2">kr kr — Meðal kostnaður</option>
            <option value="3">kr kr kr — Hár kostnaður</option>
          </select>
        </div>

      </div>

      <div className={styles.field}>
        <label className={styles.label}>Fjöldi þátttakenda</label>
        <div className={styles.rangeRow}>
          <input
            id="program-count-min"
            type="number"
            className={styles.input}
            value={draft.countMin}
            onChange={(e) => updateDraft({ countMin: e.target.value })}
            placeholder="Frá"
            min={1}
            aria-label="Lágmarksfjöldi þátttakenda"
          />
          <span className={styles.rangeSeparator} aria-hidden="true">–</span>
          <input
            id="program-count-max"
            type="number"
            className={styles.input}
            value={draft.countMax}
            onChange={(e) => updateDraft({ countMax: e.target.value })}
            placeholder="Til"
            min={1}
            aria-label="Hámarksfjöldi þátttakenda"
          />
        </div>
      </div>

      <div className={styles.field}>
        <p className={styles.label} id="age-groups-label">Aldurshópar</p>
        <div
          className={styles.checkboxGrid}
          role="group"
          aria-labelledby="age-groups-label"
        >
          {AGE_GROUPS.map((group) => (
            <label key={group} className={styles.checkboxOption}>
              <input
                type="checkbox"
                className={styles.checkboxInput}
                checked={draft.selectedAgeGroups.includes(group)}
                onChange={() => {
                  const next = draft.selectedAgeGroups.includes(group)
                    ? draft.selectedAgeGroups.filter((g) => g !== group)
                    : [...draft.selectedAgeGroups, group];
                  updateDraft({ selectedAgeGroups: next });
                }}
              />
              <span className={styles.checkboxLabel}>{group}</span>
            </label>
          ))}
        </div>
        {draft.selectedAgeGroups.length > 0 && (
          <p className={styles.hint}>
            {draft.selectedAgeGroups.length === AGE_GROUPS.length
              ? "Allir aldurshópar valdir"
              : `${draft.selectedAgeGroups.length} aldurshópar valdir`}
          </p>
        )}
      </div>
    </>
  );
}

type SectionEquipmentProps = DraftProps & {
  equipmentInput: string;
  setEquipmentInput: (v: string) => void;
  addEquipmentItem: () => void;
  removeEquipmentItem: (item: string) => void;
  handleEquipmentKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

function SectionEquipment({
  draft,
  equipmentInput,
  setEquipmentInput,
  addEquipmentItem,
  removeEquipmentItem,
  handleEquipmentKeyDown,
}: SectionEquipmentProps) {
  return (
    <div className={styles.field}>
      <label htmlFor="program-equipment" className={styles.label}>Búnaðarlisti</label>
      <div className={styles.equipmentInputRow}>
        <input
          id="program-equipment"
          type="text"
          className={styles.input}
          value={equipmentInput}
          onChange={(e) => setEquipmentInput(e.target.value)}
          onKeyDown={handleEquipmentKeyDown}
          placeholder="t.d. Límbandi — Enter til að bæta við"
          maxLength={100}
        />
        <button
          type="button"
          className={styles.addButton}
          onClick={addEquipmentItem}
          disabled={!equipmentInput.trim()}
        >
          Bæta við
        </button>
      </div>
      {draft.equipment.length > 0 && (
        <div className={styles.equipmentList}>
          {draft.equipment.map((item) => (
            <span key={item} className={styles.equipmentTag}>
              {item}
              <button
                type="button"
                className={styles.equipmentRemove}
                onClick={() => removeEquipmentItem(item)}
                aria-label={`Fjarlægja ${item}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionInstructions({ draft, updateDraft }: DraftProps) {
  return (
    <div className={styles.field}>
      <label htmlFor="program-instructions" className={styles.label}>Framkvæmd</label>
      <textarea
        id="program-instructions"
        className={styles.textarea}
        value={draft.instructions}
        onChange={(e) => updateDraft({ instructions: e.target.value })}
        placeholder="Skrifaðu skref-fyrir-skref leiðbeiningar..."
        rows={6}
        maxLength={5000}
      />
      <p className={styles.hint}>{draft.instructions.length}/5000</p>
    </div>
  );
}

type SectionExtrasProps = DraftProps & { displayTags: string[] };

function SectionExtras({ draft, updateDraft, displayTags }: SectionExtrasProps) {
  return (
    <>
      <div className={styles.field}>
        <div className={styles.tagGrid}>
          {displayTags.map((tag) => {
            const isSelected = draft.selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                className={`${styles.tagButton} ${isSelected ? styles.tagButtonActive : ""}`}
                onClick={() => {
                  const next = isSelected
                    ? draft.selectedTags.filter((t) => t !== tag)
                    : [...draft.selectedTags, tag];
                  updateDraft({ selectedTags: next });
                }}
                aria-pressed={isSelected}
              >
                {tag}
              </button>
            );
          })}
        </div>
        {draft.selectedTags.length > 0 && (
          <p className={styles.hint}>{draft.selectedTags.length} merkimiðar valdir</p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="program-image" className={styles.label}>Vefslóð myndar</label>
        <input
          id="program-image"
          type="url"
          className={styles.input}
          value={draft.image}
          onChange={(e) => updateDraft({ image: e.target.value })}
          placeholder="https://example.com/mynd.jpg"
        />
        <p className={styles.hint}>Slóð á mynd sem lýsir hugmyndinni</p>
      </div>
    </>
  );
}
