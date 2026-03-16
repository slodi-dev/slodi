"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./NewProgramForm.module.css";
import type { Task } from "@/services/tasks.service";
import { createTask } from "@/services/tasks.service";
import { useTags } from "@/hooks/useTags";
import { useDraft } from "@/hooks/useDraft";
import { handleApiErrorIs } from "@/lib/api-utils";
import { useAuth } from "@/hooks/useAuth";
import {
  AGE_GROUPS,
  INITIAL_CONTENT_DRAFT,
  SectionBasic,
  SectionInfo,
  SectionEquipment,
  SectionInstructions,
  SectionExtras,
  type ContentDraft,
} from "./FormSections";

type SectionId = "basic" | "info" | "equipment" | "instructions" | "extras";

const SECTIONS: Array<{ id: SectionId; title: string; required?: boolean }> = [
  { id: "basic", title: "Grunnupplýsingar", required: true },
  { id: "info", title: "Upplýsingar" },
  { id: "equipment", title: "Gögn og búnaður" },
  { id: "instructions", title: "Leiðbeiningar" },
  { id: "extras", title: "Merkimiðar og mynd" },
];

type Props = {
  workspaceId: string;
  onCreated?: (task: Task) => void;
  onCancel?: () => void;
};

export default function NewTaskForm({ workspaceId, onCreated, onCancel }: Props) {
  const { getToken } = useAuth();
  const { tagNames: availableTags } = useTags();
  const displayTags = availableTags ?? [];

  const draftKey = `task-draft-${workspaceId}`;
  const { draft, updateDraft, clearDraft } = useDraft<ContentDraft>(draftKey, INITIAL_CONTENT_DRAFT);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [equipmentInput, setEquipmentInput] = useState("");
  const [openSections, setOpenSections] = useState<SectionId[]>(["basic"]);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(draftKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<ContentDraft>;
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
  }, [draftKey]);

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
    setShowDraftBanner(false);
    setError(null);
    setOpenSections(["basic"]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!draft.name.trim()) {
      setError("Heiti verkefnis er nauðsynlegt");
      if (!openSections.includes("basic")) setOpenSections((prev) => [...prev, "basic"]);
      return;
    }

    setLoading(true);
    try {
      const age = draft.selectedAgeGroups.filter((g) => AGE_GROUPS.includes(g));
      const task = await createTask(
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
          age: age.length > 0 ? age : undefined,
          location: draft.location.trim() || undefined,
          count_min: draft.countMin !== "" ? Number(draft.countMin) : undefined,
          count_max: draft.countMax !== "" ? Number(draft.countMax) : undefined,
          price: draft.price !== "" ? Number(draft.price) : undefined,
          tagNames: draft.selectedTags.length > 0 ? draft.selectedTags : undefined,
          workspaceId,
        },
        getToken
      );
      clearDraft();
      setEquipmentInput("");
      setShowDraftBanner(false);
      setOpenSections(["basic"]);
      onCreated?.(task);
    } catch (err) {
      setError(handleApiErrorIs(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} aria-label="Nýtt verkefni">
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
              id={`accordion-task-btn-${id}`}
              className={styles.accordionHeader}
              onClick={() => toggleSection(id)}
              aria-expanded={isOpen}
              aria-controls={`accordion-task-${id}`}
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
              id={`accordion-task-${id}`}
              className={`${styles.accordionContent} ${isOpen ? styles.accordionContentOpen : ""}`}
              role="region"
              aria-labelledby={`accordion-task-btn-${id}`}
            >
              <div className={styles.accordionContentInner}>
                <div className={styles.accordionBody}>
                  {id === "basic" && (
                    <SectionBasic
                      draft={draft}
                      updateDraft={updateDraft}
                      idPrefix="task"
                      nameLabel="Heiti verkefnis"
                      namePlaceholder="t.d. Náttúruganga í skóginum"
                    />
                  )}
                  {id === "info" && (
                    <SectionInfo draft={draft} updateDraft={updateDraft} idPrefix="task" />
                  )}
                  {id === "equipment" && (
                    <SectionEquipment
                      draft={draft}
                      updateDraft={updateDraft}
                      idPrefix="task"
                      equipmentInput={equipmentInput}
                      setEquipmentInput={setEquipmentInput}
                      addEquipmentItem={addEquipmentItem}
                      removeEquipmentItem={removeEquipmentItem}
                      handleEquipmentKeyDown={handleEquipmentKeyDown}
                    />
                  )}
                  {id === "instructions" && (
                    <SectionInstructions
                      draft={draft}
                      updateDraft={updateDraft}
                      idPrefix="task"
                    />
                  )}
                  {id === "extras" && (
                    <SectionExtras
                      draft={draft}
                      updateDraft={updateDraft}
                      idPrefix="task"
                      displayTags={displayTags}
                    />
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
