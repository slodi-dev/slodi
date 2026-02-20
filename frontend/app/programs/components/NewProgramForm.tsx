"use client";

import React, { useState } from "react";
import styles from "./NewProgramForm.module.css";
import type { Program } from "@/services/programs.service";
import { createProgram } from "@/services/programs.service";
import { useTags } from "@/hooks/useTags";
import { handleApiErrorIs } from "@/lib/api-utils";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  workspaceId: string;
  onCreated?: (program: Program) => void;
  onCancel?: () => void;
};

export default function NewProgramForm({ workspaceId, onCreated, onCancel }: Props) {
  const { getToken } = useAuth();

  // Basic fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");

  // Content fields
  const [instructions, setInstructions] = useState("");
  const [equipmentInput, setEquipmentInput] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);

  // Metadata fields
  const [durationMin, setDurationMin] = useState("");
  const [durationMax, setDurationMax] = useState("");
  const [prepTimeMin, setPrepTimeMin] = useState("");
  const [prepTimeMax, setPrepTimeMax] = useState("");
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [countMin, setCountMin] = useState("");
  const [countMax, setCountMax] = useState("");
  const [price, setPrice] = useState("");

  // Tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { tagNames: availableTags } = useTags();
  const PLACEHOLDER_TAGS = ["útivist", "innileikur", "list", "sköpun", "matreiðsla", "leikur", "fræðsla", "náttúrufræði"];
  const displayTags = availableTags && availableTags.length > 0 ? availableTags : PLACEHOLDER_TAGS;

  const AGE_GROUPS = [
    "Hrefnuskátar",
    "Drekaskátar",
    "Fálkaskátar",
    "Dróttskátar",
    "Rekkaskátar",
    "Róverskátar",
    "Vættaskátar",
  ];

  // ── Equipment helpers ──────────────────────────────────────────
  const addEquipmentItem = () => {
    const trimmed = equipmentInput.trim();
    if (!trimmed || equipment.includes(trimmed)) return;
    setEquipment((prev) => [...prev, trimmed]);
    setEquipmentInput("");
  };

  const removeEquipmentItem = (item: string) => {
    setEquipment((prev) => prev.filter((e) => e !== item));
  };

  const handleEquipmentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addEquipmentItem();
    }
  };

  // ── Age group helpers ──────────────────────────────────────────
  const handleAgeGroupToggle = (group: string) => {
    setSelectedAgeGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  // ── Tag helpers ────────────────────────────────────────────────
  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // ── Submit / Reset ─────────────────────────────────────────────
  const handleReset = () => {
    setName("");
    setDescription("");
    setImage("");
    setInstructions("");
    setEquipmentInput("");
    setEquipment([]);
    setDurationMin("");
    setDurationMax("");
    setPrepTimeMin("");
    setPrepTimeMax("");
    setSelectedAgeGroups([]);
    setLocation("");
    setCountMin("");
    setCountMax("");
    setPrice("");
    setSelectedTags([]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!name.trim()) {
      setError("Heiti hugmyndar er nauðsynlegt");
      return;
    }

    setLoading(true);
    try {
      const program = await createProgram(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          image: image.trim() || undefined,
          instructions: instructions.trim() || undefined,
          equipment: equipment.length > 0 ? equipment : undefined,
          duration: (durationMin || durationMax)
            ? [durationMin, durationMax].filter(Boolean).join("\u2013") + " mín"
            : undefined,
          prep_time: (prepTimeMin || prepTimeMax)
            ? [prepTimeMin, prepTimeMax].filter(Boolean).join("\u2013") + " mín"
            : undefined,
          age: selectedAgeGroups.length > 0 ? selectedAgeGroups.join(", ") : undefined,
          location: location.trim() || undefined,
          count: countMin !== "" ? Number(countMin) : undefined,
          price: price !== "" ? Number(price) : undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          workspaceId,
        },
        getToken
      );
      handleReset();
      onCreated?.(program);
    } catch (err) {
      setError(handleApiErrorIs(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} aria-label="Ný dagskrá">

      {/* ── Basic info ── */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Grunnupplýsingar</h3>

        <div className={styles.field}>
          <label htmlFor="program-name" className={styles.label}>
            Heiti hugmyndar <span className={styles.required}>*</span>
          </label>
          <input
            id="program-name"
            type="text"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Stutt lýsing sem hjálpar öðrum að skilja hugmyndina..."
            rows={3}
            maxLength={1000}
          />
          <p className={styles.hint}>{description.length}/1000</p>
        </div>
      </div>

      {/* ── Metadata ── */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Upplýsingar</h3>

        {/* Duration + Prep time — 2-col grid */}
        <div className={styles.fieldGrid}>

          <div className={styles.field}>
            <label className={styles.label}>Tímalengd (mín)</label>
            <div className={styles.rangeRow}>
              <input
                id="program-duration-min"
                type="number"
                className={styles.input}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                placeholder="Frá"
                min={0}
                aria-label="Lágmarkstímalengd í mínútum"
              />
              <span className={styles.rangeSeparator} aria-hidden="true">–</span>
              <input
                id="program-duration-max"
                type="number"
                className={styles.input}
                value={durationMax}
                onChange={(e) => setDurationMax(e.target.value)}
                placeholder="Til"
                min={0}
                aria-label="Tilarkstímalengd í mínútum"
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
                value={prepTimeMin}
                onChange={(e) => setPrepTimeMin(e.target.value)}
                placeholder="Frá"
                min={0}
                aria-label="Lágmarks undirbúningstími í mínútum"
              />
              <span className={styles.rangeSeparator} aria-hidden="true">–</span>
              <input
                id="program-prep-max"
                type="number"
                className={styles.input}
                value={prepTimeMax}
                onChange={(e) => setPrepTimeMax(e.target.value)}
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
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="t.d. Úti, Inni"
              maxLength={255}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="program-price" className={styles.label}>Kostnaður</label>
            <select
              id="program-price"
              className={styles.select}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            >
              <option value="">Veldu kostnaðarstig</option>
              <option value="0">Kostnaðarla</option>
              <option value="1">kr — Lítill kostnaður</option>
              <option value="2">kr kr — Meðal kostnaður</option>
              <option value="3">kr kr kr — Hár kostnaður</option>
            </select>
          </div>

        </div>

        {/* Participant count range — full width */}
        <div className={styles.field}>
          <label className={styles.label}>Fjöldi þátttakenda</label>
          <div className={styles.rangeRow}>
            <input
              id="program-count-min"
              type="number"
              className={styles.input}
              value={countMin}
              onChange={(e) => setCountMin(e.target.value)}
              placeholder="Frá"
              min={1}
              aria-label="Lágmarksfjöldi þátttakenda"
            />
            <span className={styles.rangeSeparator} aria-hidden="true">–</span>
            <input
              id="program-count-max"
              type="number"
              className={styles.input}
              value={countMax}
              onChange={(e) => setCountMax(e.target.value)}
              placeholder="Til"
              min={1}
              aria-label="Hámarksfjöldi þátttakenda"
            />
          </div>
        </div>

        {/* Age groups — checkboxes */}
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
                  checked={selectedAgeGroups.includes(group)}
                  onChange={() => handleAgeGroupToggle(group)}
                />
                <span className={styles.checkboxLabel}>{group}</span>
              </label>
            ))}
          </div>
          {selectedAgeGroups.length > 0 && (
            <p className={styles.hint}>
              {selectedAgeGroups.length === AGE_GROUPS.length
                ? "Allir aldurshópar valdir"
                : `${selectedAgeGroups.length} aldurshópar valdir`}
            </p>
          )}
        </div>

      </div>

      {/* ── Equipment ── */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Gögn og búnaður</h3>
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
          {equipment.length > 0 && (
            <div className={styles.equipmentList}>
              {equipment.map((item) => (
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
      </div>

      {/* ── Instructions ── */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Leiðbeiningar</h3>
        <div className={styles.field}>
          <label htmlFor="program-instructions" className={styles.label}>Framkvæmd</label>
          <textarea
            id="program-instructions"
            className={styles.textarea}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Skrifaðu skref-fyrir-skref leiðbeiningar..."
            rows={6}
            maxLength={5000}
          />
          <p className={styles.hint}>{instructions.length}/5000</p>
        </div>
      </div>

      {/* ── Tags ── */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Merkimiðar</h3>
        <div className={styles.field}>
          <div className={styles.tagGrid}>
            {displayTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={`${styles.tagButton} ${isSelected ? styles.tagButtonActive : ""}`}
                  onClick={() => handleTagToggle(tag)}
                  aria-pressed={isSelected}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          {selectedTags.length > 0 && (
            <p className={styles.hint}>{selectedTags.length} merkimiðar valdir</p>
          )}
        </div>
      </div>

      {/* ── Image ── */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Mynd</h3>
        <div className={styles.field}>
          <label htmlFor="program-image" className={styles.label}>Vefslóð myndar</label>
          <input
            id="program-image"
            type="url"
            className={styles.input}
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://example.com/mynd.jpg"
          />
          <p className={styles.hint}>Slóð á mynd sem lýsir hugmyndinni</p>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {/* ── Actions ── */}
      <div className={styles.actions}>
        {onCancel && (
          <button type="button" className={styles.buttonSecondary} onClick={onCancel} disabled={loading}>
            Hætta við
          </button>
        )}
        <button type="button" className={styles.buttonSecondary} onClick={handleReset} disabled={loading}>
          Hreinsa
        </button>
        <button type="submit" className={styles.buttonPrimary} disabled={loading || !name.trim()}>
          {loading ? "Býr til..." : "Búa til hugmynd"}
        </button>
      </div>
    </form>
  );
}

