"use client";

import React, { useState } from "react";
import type { AgeGroup, Program, ProgramUpdateInput } from "@/services/programs.service";
import { useTags } from "@/hooks/useTags";
import styles from "./ProgramDetailEdit.module.css";

// ── Parse helpers ────────────────────────────────────────────────────────────

/** Parses "10–45 mín" → ["10", "45"], "30 mín" → ["30", ""], null → ["", ""] */
function parseDuration(val: string | null | undefined): [string, string] {
  if (!val) return ["", ""];
  const cleaned = val.replace(/\s*mín\s*$/i, "").trim();
  const parts = cleaned.split(/[–\-]/);
  return [(parts[0] ?? "").trim(), (parts[1] ?? "").trim()];
}

/**
 * Normalises the age field from the Program type (AgeGroup[] | null | undefined)
 * into a plain string[] for use in form state.
 */
function parseAge(val: readonly string[] | null | undefined): string[] {
  if (!val || val.length === 0) return [];
  return [...val];
}

// ── Constants ────────────────────────────────────────────────────────────────

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

// ── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  description: string;
  public: boolean;
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
  price: string;
  selectedTags: string[];
}

export interface ProgramDetailEditProps {
  program: Program;
  /** Called with the full update payload when the user saves. */
  onSave: (data: ProgramUpdateInput) => Promise<void>;
  onCancel: () => void;
  /** Called when the user presses "Eyða dagskrá" — parent handles confirmation. */
  onDeleteRequest: () => void;
  /** When true, disable all controls (deletion in progress). */
  isDeleting?: boolean;
}


// ── Component ─────────────────────────────────────────────────────────────────

export default function ProgramDetailEdit({
  program,
  onSave,
  onCancel,
  onDeleteRequest,
  isDeleting = false,
}: ProgramDetailEditProps) {
  const { tagNames: fetchedTags } = useTags();
  const displayTags =
    fetchedTags && fetchedTags.length > 0 ? fetchedTags : PLACEHOLDER_TAGS;

  const [durationMin0, durationMax0] = parseDuration(program.duration);
  const [prepMin0, prepMax0] = parseDuration(program.prep_time);

  const [form, setForm] = useState<FormState>({
    name: program.name ?? "",
    description: program.description ?? "",
    public: program.public ?? false,
    image: program.image ?? "",
    instructions: program.instructions ?? "",
    equipment: program.equipment ?? [],
    durationMin: durationMin0,
    durationMax: durationMax0,
    prepTimeMin: prepMin0,
    prepTimeMax: prepMax0,
    selectedAgeGroups: parseAge(program.age),
    location: program.location ?? "",
    countMin: program.count != null ? String(program.count) : "",
    price: program.price != null ? String(program.price) : "",
    selectedTags: (program.tags ?? []).map((t) => t.name),
  });

  const [equipmentInput, setEquipmentInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDisabled = isSaving || isDeleting;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const patch = (fields: Partial<FormState>) =>
    setForm((prev) => ({ ...prev, ...fields }));

  const addEquipment = () => {
    const trimmed = equipmentInput.trim();
    if (!trimmed || form.equipment.includes(trimmed)) return;
    patch({ equipment: [...form.equipment, trimmed] });
    setEquipmentInput("");
  };

  const removeEquipment = (item: string) =>
    patch({ equipment: form.equipment.filter((e) => e !== item) });

  const handleEquipmentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addEquipment();
    }
  };

  const toggleAgeGroup = (group: string) => {
    const next = form.selectedAgeGroups.includes(group)
      ? form.selectedAgeGroups.filter((g) => g !== group)
      : [...form.selectedAgeGroups, group];
    patch({ selectedAgeGroups: next });
  };

  const toggleTag = (tag: string) => {
    const next = form.selectedTags.includes(tag)
      ? form.selectedTags.filter((t) => t !== tag)
      : [...form.selectedTags, tag];
    patch({ selectedTags: next });
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Nafn má ekki vera tómt");
      return;
    }

    const payload: ProgramUpdateInput = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      public: form.public,
      image: form.image.trim() || null,
      instructions: form.instructions.trim() || null,
      equipment: form.equipment.length > 0 ? form.equipment : null,
      duration:
        form.durationMin || form.durationMax
          ? `${[form.durationMin, form.durationMax].filter(Boolean).join("–")} mín`
          : null,
      prep_time:
        form.prepTimeMin || form.prepTimeMax
          ? `${[form.prepTimeMin, form.prepTimeMax].filter(Boolean).join("–")} mín`
          : null,
      age:
        form.selectedAgeGroups.length > 0
          ? (form.selectedAgeGroups as AgeGroup[])
          : null,
      location: form.location.trim() || null,
      count: form.countMin !== "" ? Number(form.countMin) : null,
      price: form.price !== "" ? Number(form.price) : null,
    };

    try {
      setIsSaving(true);
      setError(null);
      await onSave(payload);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Villa kom upp við að vista"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.editContainer}>
      <form onSubmit={handleSubmit} className={styles.form}>

        {/* ── Section: Basic ── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Grunnupplýsingar</h3>

          <div className={styles.formGroup}>
            <label htmlFor="edit-name" className={styles.label}>
              Nafn dagskrár <span className={styles.required}>*</span>
            </label>
            <input
              id="edit-name"
              type="text"
              className={styles.input}
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              maxLength={200}
              required
              disabled={isDisabled}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="edit-description" className={styles.label}>
              Lýsing
            </label>
            <textarea
              id="edit-description"
              className={styles.textarea}
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={4}
              maxLength={1000}
              disabled={isDisabled}
              placeholder="Stutt lýsing..."
            />
            <p className={styles.helpText}>{form.description.length}/1000</p>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={form.public}
                onChange={(e) => patch({ public: e.target.checked })}
                disabled={isDisabled}
              />
              <span>Opinber dagskrá</span>
            </label>
            <p className={styles.helpText}>
              Openberar dagskrár eru sýnilegar öllum í dagskrárbankanum
            </p>
          </div>
        </section>

        {/* ── Section: Info ── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Upplýsingar</h3>

          <div className={styles.fieldGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Tímalengd (mín)</label>
              <div className={styles.rangeRow}>
                <input
                  type="number"
                  className={styles.input}
                  value={form.durationMin}
                  onChange={(e) => patch({ durationMin: e.target.value })}
                  placeholder="Frá"
                  min={0}
                  aria-label="Lágmarkstímalengd í mínútum"
                  disabled={isDisabled}
                />
                <span className={styles.rangeSep} aria-hidden="true">–</span>
                <input
                  type="number"
                  className={styles.input}
                  value={form.durationMax}
                  onChange={(e) => patch({ durationMax: e.target.value })}
                  placeholder="Til"
                  min={0}
                  aria-label="Hámarkstímalengd í mínútum"
                  disabled={isDisabled}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Undirbúningstími (mín)</label>
              <div className={styles.rangeRow}>
                <input
                  type="number"
                  className={styles.input}
                  value={form.prepTimeMin}
                  onChange={(e) => patch({ prepTimeMin: e.target.value })}
                  placeholder="Frá"
                  min={0}
                  aria-label="Lágmarks undirbúningstími"
                  disabled={isDisabled}
                />
                <span className={styles.rangeSep} aria-hidden="true">–</span>
                <input
                  type="number"
                  className={styles.input}
                  value={form.prepTimeMax}
                  onChange={(e) => patch({ prepTimeMax: e.target.value })}
                  placeholder="Til"
                  min={0}
                  aria-label="Hámarks undirbúningstími"
                  disabled={isDisabled}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="edit-location" className={styles.label}>
                Staðsetning
              </label>
              <input
                id="edit-location"
                type="text"
                className={styles.input}
                value={form.location}
                onChange={(e) => patch({ location: e.target.value })}
                placeholder="t.d. Úti, Inni"
                maxLength={255}
                disabled={isDisabled}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="edit-price" className={styles.label}>
                Kostnaður
              </label>
              <select
                id="edit-price"
                className={styles.select}
                value={form.price}
                onChange={(e) => patch({ price: e.target.value })}
                disabled={isDisabled}
              >
                <option value="">Veldu kostnaðarstig</option>
                <option value="0">Kostnaðarlaust</option>
                <option value="1">kr — Lítill kostnaður</option>
                <option value="2">kr kr — Meðal kostnaður</option>
                <option value="3">kr kr kr — Hár kostnaður</option>
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="edit-count" className={styles.label}>
              Fjöldi þátttakenda
            </label>
            <input
              id="edit-count"
              type="number"
              className={`${styles.input} ${styles.inputNarrow}`}
              value={form.countMin}
              onChange={(e) => patch({ countMin: e.target.value })}
              placeholder="t.d. 20"
              min={1}
              disabled={isDisabled}
            />
          </div>

          <div className={styles.formGroup}>
            <p className={styles.label} id="edit-age-label">
              Aldurshópar
            </p>
            <div
              className={styles.checkboxGrid}
              role="group"
              aria-labelledby="edit-age-label"
            >
              {AGE_GROUPS.map((group) => (
                <label key={group} className={styles.checkboxOption}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={form.selectedAgeGroups.includes(group)}
                    onChange={() => toggleAgeGroup(group)}
                    disabled={isDisabled}
                  />
                  <span className={styles.checkboxOptionLabel}>{group}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section: Equipment ── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Búnaður</h3>

          <div className={styles.formGroup}>
            <label htmlFor="edit-equipment" className={styles.label}>
              Búnaðarlisti
            </label>
            <div className={styles.chipInputRow}>
              <input
                id="edit-equipment"
                type="text"
                className={styles.input}
                value={equipmentInput}
                onChange={(e) => setEquipmentInput(e.target.value)}
                onKeyDown={handleEquipmentKeyDown}
                placeholder="t.d. Límbandi — Enter til að bæta við"
                maxLength={100}
                disabled={isDisabled}
              />
              <button
                type="button"
                className={styles.addButton}
                onClick={addEquipment}
                disabled={isDisabled || !equipmentInput.trim()}
              >
                Bæta við
              </button>
            </div>
            {form.equipment.length > 0 && (
              <div className={styles.chipList}>
                {form.equipment.map((item) => (
                  <span key={item} className={styles.chip}>
                    {item}
                    <button
                      type="button"
                      className={styles.chipRemove}
                      onClick={() => removeEquipment(item)}
                      aria-label={`Fjarlægja ${item}`}
                      disabled={isDisabled}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Section: Instructions ── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Leiðbeiningar</h3>

          <div className={styles.formGroup}>
            <label htmlFor="edit-instructions" className={styles.label}>
              Framkvæmd
            </label>
            <textarea
              id="edit-instructions"
              className={styles.textarea}
              value={form.instructions}
              onChange={(e) => patch({ instructions: e.target.value })}
              rows={8}
              maxLength={5000}
              disabled={isDisabled}
              placeholder="Skrifaðu skref-fyrir-skref leiðbeiningar..."
            />
            <p className={styles.helpText}>{form.instructions.length}/5000</p>
          </div>
        </section>

        {/* ── Section: Media & Tags ── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Merkimiðar og mynd</h3>

          <div className={styles.formGroup}>
            <p className={styles.label} id="edit-tags-label">
              Merkimiðar
            </p>
            <div className={styles.tagGrid} role="group" aria-labelledby="edit-tags-label">
              {displayTags.map((tag) => {
                const isSelected = form.selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`${styles.tagButton} ${isSelected ? styles.tagButtonActive : ""}`}
                    onClick={() => toggleTag(tag)}
                    aria-pressed={isSelected}
                    disabled={isDisabled}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            {form.selectedTags.length > 0 && (
              <p className={styles.helpText}>
                {form.selectedTags.length} merkimiðar valdir
              </p>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="edit-image" className={styles.label}>
              Mynd (URL)
            </label>

            {form.image && (
              <div className={styles.imagePreviewContainer}>
                {!imageError ? (
                  <img
                    src={form.image}
                    alt="Forskoðun myndar"
                    className={styles.imagePreview}
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className={styles.imagePreviewError}>
                    <span className={styles.imagePreviewErrorIcon}>⚠️</span>
                    <span className={styles.imagePreviewErrorText}>
                      Ekki tókst að hlaða mynd — athugaðu slóðina
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  className={styles.imageClearButton}
                  onClick={() => { patch({ image: "" }); setImageError(false); }}
                  disabled={isDisabled}
                  aria-label="Fjarlægja mynd"
                >
                  ✕
                </button>
              </div>
            )}

            <input
              id="edit-image"
              type="url"
              className={styles.input}
              value={form.image}
              onChange={(e) => { setImageError(false); patch({ image: e.target.value }); }}
              disabled={isDisabled}
              placeholder="https://example.com/mynd.jpg"
            />
            <p className={styles.helpText}>
              Settu inn slóð á mynd til að sýna á dagskránni
            </p>
          </div>
        </section>

        {/* ── Error ── */}
        {error && <div className={styles.error} role="alert">{error}</div>}

        {/* ── Actions ── */}
        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.saveButton}
            disabled={isDisabled}
          >
            {isSaving ? "Vista…" : "Vista breytingar"}
          </button>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
            disabled={isDisabled}
          >
            Hætta við
          </button>
        </div>

        {/* ── Danger Zone ── */}
        <div className={styles.dangerZone}>
          <h3 className={styles.dangerTitle}>Hættusvæði</h3>
          <p className={styles.dangerDescription}>
            Þegar dagskrá er eytt er ekki hægt að afturkalla það.
          </p>
          <button
            type="button"
            className={styles.deleteButton}
            onClick={onDeleteRequest}
            disabled={isDisabled}
          >
            {isDeleting ? "Eyði…" : "Eyða dagskrá"}
          </button>
        </div>

      </form>
    </div>
  );
}

