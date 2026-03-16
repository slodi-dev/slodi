/**
 * Shared section sub-components for NewProgramForm, NewEventForm, and NewTaskForm.
 * All three forms have identical draft shapes and section layouts; only labels/ids differ.
 */

import React from "react";
import styles from "./NewProgramForm.module.css";

// ── Shared draft type ─────────────────────────────────────────────────────────

export type ContentDraft = {
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

export const INITIAL_CONTENT_DRAFT: ContentDraft = {
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

export const AGE_GROUPS = [
  "Hrefnuskátar",
  "Drekaskátar",
  "Fálkaskátar",
  "Dróttskátar",
  "Rekkaskátar",
  "Róverskátar",
  "Vættaskátar",
];

export type DraftProps = {
  draft: ContentDraft;
  updateDraft: (patch: Partial<ContentDraft> | ((prev: ContentDraft) => ContentDraft)) => void;
};

// ── SectionBasic ─────────────────────────────────────────────────────────────

type SectionBasicProps = DraftProps & {
  idPrefix: string;
  nameLabel: string;
  namePlaceholder?: string;
  descPlaceholder?: string;
};

export function SectionBasic({
  draft,
  updateDraft,
  idPrefix,
  nameLabel,
  namePlaceholder = "t.d. Nafn",
  descPlaceholder = "Stutt lýsing sem hjálpar öðrum að skilja hugmyndina...",
}: SectionBasicProps) {
  return (
    <>
      <div className={styles.field}>
        <label htmlFor={`${idPrefix}-name`} className={styles.label}>
          {nameLabel} <span className={styles.required}>*</span>
        </label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          className={styles.input}
          value={draft.name}
          onChange={(e) => updateDraft({ name: e.target.value })}
          placeholder={namePlaceholder}
          required
          maxLength={100}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor={`${idPrefix}-description`} className={styles.label}>
          Lýsing
        </label>
        <textarea
          id={`${idPrefix}-description`}
          className={styles.textarea}
          value={draft.description}
          onChange={(e) => updateDraft({ description: e.target.value })}
          placeholder={descPlaceholder}
          rows={3}
          maxLength={1000}
        />
        <p className={styles.hint}>{draft.description.length}/1000</p>
      </div>
    </>
  );
}

// ── SectionInfo ───────────────────────────────────────────────────────────────

type SectionInfoProps = DraftProps & {
  idPrefix: string;
  /** Show "X aldurshópar valdir" hint below the age group checkboxes (programs). */
  showAgeGroupHint?: boolean;
};

export function SectionInfo({ draft, updateDraft, idPrefix, showAgeGroupHint }: SectionInfoProps) {
  return (
    <>
      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label className={styles.label}>Tímalengd (mín)</label>
          <div className={styles.rangeRow}>
            <input
              type="number"
              className={styles.input}
              value={draft.durationMin}
              onChange={(e) => updateDraft({ durationMin: e.target.value })}
              placeholder="Frá"
              min={0}
              aria-label="Lágmarkstímalengd í mínútum"
            />
            <span className={styles.rangeSeparator} aria-hidden="true">
              –
            </span>
            <input
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
              type="number"
              className={styles.input}
              value={draft.prepTimeMin}
              onChange={(e) => updateDraft({ prepTimeMin: e.target.value })}
              placeholder="Frá"
              min={0}
              aria-label="Lágmarks undirbúningstími"
            />
            <span className={styles.rangeSeparator} aria-hidden="true">
              –
            </span>
            <input
              type="number"
              className={styles.input}
              value={draft.prepTimeMax}
              onChange={(e) => updateDraft({ prepTimeMax: e.target.value })}
              placeholder="Til"
              min={0}
              aria-label="Hámarks undirbúningstími"
            />
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-location`} className={styles.label}>
            Staðsetning
          </label>
          <input
            id={`${idPrefix}-location`}
            type="text"
            className={styles.input}
            value={draft.location}
            onChange={(e) => updateDraft({ location: e.target.value })}
            placeholder="t.d. Úti, Inni"
            maxLength={255}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-price`} className={styles.label}>
            Kostnaður
          </label>
          <select
            id={`${idPrefix}-price`}
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
            type="number"
            className={styles.input}
            value={draft.countMin}
            onChange={(e) => updateDraft({ countMin: e.target.value })}
            placeholder="Frá"
            min={1}
            aria-label="Lágmarksfjöldi þátttakenda"
          />
          <span className={styles.rangeSeparator} aria-hidden="true">
            –
          </span>
          <input
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
        <p className={styles.label} id={`${idPrefix}-age-groups-label`}>
          Aldurshópar
        </p>
        <div
          className={styles.checkboxGrid}
          role="group"
          aria-labelledby={`${idPrefix}-age-groups-label`}
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
        {showAgeGroupHint && draft.selectedAgeGroups.length > 0 && (
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

// ── SectionEquipment ──────────────────────────────────────────────────────────

export type SectionEquipmentProps = DraftProps & {
  idPrefix: string;
  equipmentInput: string;
  setEquipmentInput: (v: string) => void;
  addEquipmentItem: () => void;
  removeEquipmentItem: (item: string) => void;
  handleEquipmentKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

export function SectionEquipment({
  draft,
  idPrefix,
  equipmentInput,
  setEquipmentInput,
  addEquipmentItem,
  removeEquipmentItem,
  handleEquipmentKeyDown,
}: SectionEquipmentProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={`${idPrefix}-equipment`} className={styles.label}>
        Búnaðarlisti
      </label>
      <div className={styles.equipmentInputRow}>
        <input
          id={`${idPrefix}-equipment`}
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

// ── SectionInstructions ───────────────────────────────────────────────────────

export function SectionInstructions({
  draft,
  updateDraft,
  idPrefix,
}: DraftProps & { idPrefix: string }) {
  return (
    <div className={styles.field}>
      <label htmlFor={`${idPrefix}-instructions`} className={styles.label}>
        Framkvæmd
      </label>
      <textarea
        id={`${idPrefix}-instructions`}
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

// ── SectionExtras ─────────────────────────────────────────────────────────────

type SectionExtrasProps = DraftProps & {
  idPrefix: string;
  displayTags: string[];
  imageHint?: string;
};

export function SectionExtras({
  draft,
  updateDraft,
  idPrefix,
  displayTags,
  imageHint,
}: SectionExtrasProps) {
  return (
    <>
      <div className={styles.field}>
        {displayTags.length === 0 ? (
          <p className={styles.hint}>Engir merkimiðar tiltækir</p>
        ) : (
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
        )}
      </div>
      <div className={styles.field}>
        <label htmlFor={`${idPrefix}-image`} className={styles.label}>
          Vefslóð myndar
        </label>
        <input
          id={`${idPrefix}-image`}
          type="url"
          className={styles.input}
          value={draft.image}
          onChange={(e) => updateDraft({ image: e.target.value })}
          placeholder="https://example.com/mynd.jpg"
        />
        {imageHint && <p className={styles.hint}>{imageHint}</p>}
      </div>
    </>
  );
}
