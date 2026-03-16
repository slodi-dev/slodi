"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./NewProgramForm.module.css";
import type { Event } from "@/services/events.service";
import { createEvent } from "@/services/events.service";
import { updateTask } from "@/services/tasks.service";
import { fetchTasks } from "@/services/tasks.service";
import { ContentPicker, type PickerItem } from "./ContentPicker";
import { useTags } from "@/hooks/useTags";
import { useDraft } from "@/hooks/useDraft";
import { handleApiErrorIs } from "@/lib/api-utils";
import { useAuth } from "@/hooks/useAuth";

type EventDraft = {
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

type SectionId = "basic" | "info" | "equipment" | "instructions" | "extras" | "tasks";

const INITIAL_DRAFT: EventDraft = {
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
  { id: "tasks", title: "Verkefni" },
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

type Props = {
  workspaceId: string;
  onCreated?: (event: Event) => void;
  onCancel?: () => void;
};

export default function NewEventForm({ workspaceId, onCreated, onCancel }: Props) {
  const { getToken } = useAuth();
  const { tagNames: availableTags } = useTags();
  const displayTags = availableTags ?? [];

  const draftKey = `event-draft-${workspaceId}`;
  const { draft, updateDraft, clearDraft } = useDraft<EventDraft>(draftKey, INITIAL_DRAFT);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [equipmentInput, setEquipmentInput] = useState("");
  const [openSections, setOpenSections] = useState<SectionId[]>(["basic"]);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  // Task picker state
  const [availableTasks, setAvailableTasks] = useState<PickerItem[]>([]);
  const [stagedTasks, setStagedTasks] = useState<PickerItem[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(draftKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<EventDraft>;
      const hasContent = !!parsed.name || !!parsed.description || !!parsed.instructions;
      setShowDraftBanner(hasContent);
    } catch {
      // ignore
    }
  }, [draftKey]);

  // Load workspace tasks for picker
  useEffect(() => {
    if (!workspaceId) return;
    fetchTasks(workspaceId, getToken)
      .then((tasks) =>
        setAvailableTasks(
          tasks.map((t) => ({ id: t.id, name: t.name, description: t.description }))
        )
      )
      .catch(() => {
        // non-critical
      });
  }, [workspaceId, getToken]);

  const toggleSection = (id: SectionId) => {
    setOpenSections((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const sectionHasData = (id: SectionId): boolean => {
    switch (id) {
      case "basic":
        return !!draft.name || !!draft.description;
      case "info":
        return (
          !!draft.durationMin ||
          !!draft.durationMax ||
          !!draft.prepTimeMin ||
          !!draft.prepTimeMax ||
          !!draft.location ||
          !!draft.price ||
          !!draft.countMin ||
          !!draft.countMax ||
          draft.selectedAgeGroups.length > 0
        );
      case "equipment":
        return draft.equipment.length > 0;
      case "instructions":
        return !!draft.instructions;
      case "extras":
        return draft.selectedTags.length > 0 || !!draft.image;
      case "tasks":
        return stagedTasks.length > 0;
    }
  };

  const sectionSummary = (id: SectionId): string | null => {
    switch (id) {
      case "basic":
        return draft.name || null;
      case "info": {
        const parts: string[] = [];
        if (draft.durationMin || draft.durationMax)
          parts.push(`${draft.durationMin || "?"}–${draft.durationMax || "?"}mín`);
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
        return draft.selectedTags.length > 0 ? `${draft.selectedTags.length} merkar` : null;
      case "tasks":
        return stagedTasks.length > 0 ? `${stagedTasks.length} verkefni` : null;
    }
  };

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

  const handleDiscard = () => {
    clearDraft();
    setEquipmentInput("");
    setStagedTasks([]);
    setShowDraftBanner(false);
    setError(null);
    setOpenSections(["basic"]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!draft.name.trim()) {
      setError("Heiti viðburðar er nauðsynlegt");
      if (!openSections.includes("basic")) setOpenSections((prev) => [...prev, "basic"]);
      return;
    }

    setLoading(true);
    try {
      const event = await createEvent(
        {
          name: draft.name.trim(),
          description: draft.description.trim() || undefined,
          image: draft.image.trim() || undefined,
          instructions: draft.instructions.trim() || undefined,
          equipment: draft.equipment.length > 0 ? draft.equipment : undefined,
          duration_min: draft.durationMin !== "" ? Number(draft.durationMin) : undefined,
          duration_max: draft.durationMax !== "" ? Number(draft.durationMax) : undefined,
          prep_time_min: draft.prepTimeMin !== "" ? Number(draft.prepTimeMin) : undefined,
          prep_time_max: draft.prepTimeMax !== "" ? Number(draft.prepTimeMax) : undefined,
          age:
            draft.selectedAgeGroups.filter((g) => AGE_GROUPS.includes(g)).length > 0
              ? draft.selectedAgeGroups.filter((g) => AGE_GROUPS.includes(g))
              : undefined,
          location: draft.location.trim() || undefined,
          count_min: draft.countMin !== "" ? Number(draft.countMin) : undefined,
          count_max: draft.countMax !== "" ? Number(draft.countMax) : undefined,
          price: draft.price !== "" ? Number(draft.price) : undefined,
          tagNames: draft.selectedTags.length > 0 ? draft.selectedTags : undefined,
          workspaceId,
        },
        getToken
      );

      // Assign staged tasks to the new event with positions
      await Promise.all(
        stagedTasks.map((task, index) =>
          updateTask(task.id, { event_id: event.id, position: index }, getToken)
        )
      );

      clearDraft();
      setEquipmentInput("");
      setStagedTasks([]);
      setShowDraftBanner(false);
      setOpenSections(["basic"]);
      onCreated?.(event);
    } catch (err) {
      setError(handleApiErrorIs(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} aria-label="Nýr viðburður">
      {showDraftBanner && (
        <div className={styles.draftBanner} role="status">
          <span className={styles.draftBannerText}>📝 Óvistuð drög fundust og voru endurheimt</span>
          <button type="button" className={styles.draftBannerDiscard} onClick={handleDiscard}>
            Henda drögum
          </button>
        </div>
      )}

      {SECTIONS.map(({ id, title, required }) => {
        const isOpen = openSections.includes(id);
        const hasFilled = sectionHasData(id);
        const summary = sectionSummary(id);

        return (
          <div key={id} className={styles.accordionItem}>
            <button
              type="button"
              id={`accordion-event-btn-${id}`}
              className={styles.accordionHeader}
              onClick={() => toggleSection(id)}
              aria-expanded={isOpen}
              aria-controls={`accordion-event-${id}`}
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

            <div
              id={`accordion-event-${id}`}
              className={`${styles.accordionContent} ${isOpen ? styles.accordionContentOpen : ""}`}
              role="region"
              aria-labelledby={`accordion-event-btn-${id}`}
            >
              <div className={styles.accordionContentInner}>
                <div className={styles.accordionBody}>
                  {id === "basic" && <SectionBasic draft={draft} updateDraft={updateDraft} />}
                  {id === "info" && <SectionInfo draft={draft} updateDraft={updateDraft} />}
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
                  {id === "tasks" && (
                    <div className={styles.field}>
                      <p className={styles.hint} style={{ marginBottom: 8 }}>
                        Veldu verkefni úr bankanum til að bæta þeim í þennan viðburð.
                      </p>
                      <ContentPicker
                        available={availableTasks}
                        staged={stagedTasks}
                        onChange={setStagedTasks}
                        placeholder="Leita að verkefni..."
                        emptyText="Engin verkefni í bankanum enn"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

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
          {loading ? "Býr til…" : "Bæta í bankann"}
        </button>
      </div>
    </form>
  );
}

// ── Section sub-components (same as NewTaskForm) ─────────────────────────────

type DraftProps = {
  draft: EventDraft;
  updateDraft: (patch: Partial<EventDraft> | ((prev: EventDraft) => EventDraft)) => void;
};

function SectionBasic({ draft, updateDraft }: DraftProps) {
  return (
    <>
      <div className={styles.field}>
        <label htmlFor="event-name" className={styles.label}>
          Heiti viðburðar <span className={styles.required}>*</span>
        </label>
        <input
          id="event-name"
          type="text"
          className={styles.input}
          value={draft.name}
          onChange={(e) => updateDraft({ name: e.target.value })}
          placeholder="t.d. Leikdagur í skógi"
          required
          maxLength={100}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="event-description" className={styles.label}>
          Lýsing
        </label>
        <textarea
          id="event-description"
          className={styles.textarea}
          value={draft.description}
          onChange={(e) => updateDraft({ description: e.target.value })}
          placeholder="Stutt lýsing á viðburðinum..."
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
              type="number"
              className={styles.input}
              value={draft.durationMin}
              onChange={(e) => updateDraft({ durationMin: e.target.value })}
              placeholder="Frá"
              min={0}
              aria-label="Lágmarkstímalengd"
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
              aria-label="Hámarkstímalengd"
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
          <label htmlFor="event-location" className={styles.label}>
            Staðsetning
          </label>
          <input
            id="event-location"
            type="text"
            className={styles.input}
            value={draft.location}
            onChange={(e) => updateDraft({ location: e.target.value })}
            placeholder="t.d. Úti, Inni"
            maxLength={255}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="event-price" className={styles.label}>
            Kostnaður
          </label>
          <select
            id="event-price"
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
        <p className={styles.label} id="event-age-groups-label">
          Aldurshópar
        </p>
        <div className={styles.checkboxGrid} role="group" aria-labelledby="event-age-groups-label">
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
      <label htmlFor="event-equipment" className={styles.label}>
        Búnaðarlisti
      </label>
      <div className={styles.equipmentInputRow}>
        <input
          id="event-equipment"
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
      <label htmlFor="event-instructions" className={styles.label}>
        Framkvæmd
      </label>
      <textarea
        id="event-instructions"
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
        <label htmlFor="event-image" className={styles.label}>
          Vefslóð myndar
        </label>
        <input
          id="event-image"
          type="url"
          className={styles.input}
          value={draft.image}
          onChange={(e) => updateDraft({ image: e.target.value })}
          placeholder="https://example.com/mynd.jpg"
        />
      </div>
    </>
  );
}
