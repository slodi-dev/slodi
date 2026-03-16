"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import type { ProgramUpdateInput } from "@/services/programs.service";
import type { ContentItem } from "@/services/content.service";
import { fetchEvents, updateEvent } from "@/services/events.service";
import { fetchTasks, updateTask } from "@/services/tasks.service";
import { ContentPicker, type PickerItem } from "@/app/content/components/ContentPicker";
import { useTags } from "@/hooks/useTags";
import { useAuth } from "@/hooks/useAuth";
import styles from "./ProgramDetailEdit.module.css";

import { AGE_GROUPS } from "@/app/content/components/FormSections";

// ── Constants ────────────────────────────────────────────────────────────────

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
  countMax: string;
  price: string;
  selectedTags: string[];
}

export interface ProgramDetailEditProps {
  program: ContentItem;
  /** Called with the full update payload when the user saves. */
  onSave: (data: ProgramUpdateInput) => Promise<void>;
  onCancel: () => void;
  /** Called when the user presses "Eyða" — parent handles confirmation. */
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
  const { getToken } = useAuth();
  const { tagNames: fetchedTags } = useTags();
  const displayTags = fetchedTags ?? [];

  const isProgram = program.content_type === "program";
  const isEvent = program.content_type === "event";

  const [form, setForm] = useState<FormState>({
    name: program.name ?? "",
    description: program.description ?? "",
    public: (program as { public?: boolean }).public ?? false,
    image: program.image ?? "",
    instructions: program.instructions ?? "",
    equipment: program.equipment ?? [],
    durationMin: program.duration_min != null ? String(program.duration_min) : "",
    durationMax: program.duration_max != null ? String(program.duration_max) : "",
    prepTimeMin: program.prep_time_min != null ? String(program.prep_time_min) : "",
    prepTimeMax: program.prep_time_max != null ? String(program.prep_time_max) : "",
    selectedAgeGroups: ((program.age ?? []) as string[]).filter((g) => AGE_GROUPS.includes(g)),
    location: program.location ?? "",
    countMin: program.count_min != null ? String(program.count_min) : "",
    countMax: program.count_max != null ? String(program.count_max) : "",
    price: program.price != null ? String(program.price) : "",
    selectedTags: (program.tags ?? []).map((t) => t.name),
  });

  const [equipmentInput, setEquipmentInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Children pickers ──────────────────────────────────────────────────────

  const programItem = program as ContentItem & {
    events?: import("@/services/events.service").Event[];
    tasks?: import("@/services/tasks.service").Task[];
  };
  const eventItem = program as ContentItem & { tasks?: import("@/services/tasks.service").Task[] };

  // For programs: merge events and tasks into a single ordered list
  const initialProgramChildren: PickerItem[] = isProgram
    ? [
        ...(programItem.events ?? []).map((ev) => ({
          id: ev.id,
          name: ev.name,
          description: ev.description,
          type: "event" as const,
          _sort: ev.position,
        })),
        ...(programItem.tasks ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          type: "task" as const,
          _sort: t.position,
        })),
      ]
        .sort((a, b) => a._sort - b._sort)
        .map(({ _sort: _, ...item }) => item)
    : [];

  const initialEventTasks: PickerItem[] = isEvent
    ? (eventItem.tasks ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((t) => ({ id: t.id, name: t.name, description: t.description }))
    : [];

  const [availableProgramChildren, setAvailableProgramChildren] = useState<PickerItem[]>([]);
  const [stagedProgramChildren, setStagedProgramChildren] =
    useState<PickerItem[]>(initialProgramChildren);
  const [availableEventTasks, setAvailableEventTasks] = useState<PickerItem[]>([]);
  const [stagedEventTasks, setStagedEventTasks] = useState<PickerItem[]>(initialEventTasks);

  useEffect(() => {
    if (!program.workspace_id) return;
    if (isProgram) {
      Promise.all([
        fetchEvents(program.workspace_id, getToken),
        fetchTasks(program.workspace_id, getToken),
      ])
        .then(([evs, ts]) => {
          setAvailableProgramChildren([
            ...evs.map((ev) => ({
              id: ev.id,
              name: ev.name,
              description: ev.description,
              type: "event" as const,
            })),
            ...ts.map((t) => ({
              id: t.id,
              name: t.name,
              description: t.description,
              type: "task" as const,
            })),
          ]);
        })
        .catch(() => {});
    }
    if (isEvent) {
      fetchTasks(program.workspace_id, getToken)
        .then((ts) =>
          setAvailableEventTasks(
            ts.map((t) => ({ id: t.id, name: t.name, description: t.description }))
          )
        )
        .catch(() => {});
    }
  }, [program.workspace_id, isProgram, isEvent, getToken]);

  const isDisabled = isSaving || isDeleting;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const patch = (fields: Partial<FormState>) => setForm((prev) => ({ ...prev, ...fields }));

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
      duration_min: form.durationMin !== "" ? Number(form.durationMin) : null,
      duration_max: form.durationMax !== "" ? Number(form.durationMax) : null,
      prep_time_min: form.prepTimeMin !== "" ? Number(form.prepTimeMin) : null,
      prep_time_max: form.prepTimeMax !== "" ? Number(form.prepTimeMax) : null,
      age:
        form.selectedAgeGroups.filter((g) => AGE_GROUPS.includes(g)).length > 0
          ? form.selectedAgeGroups.filter((g) => AGE_GROUPS.includes(g))
          : null,
      location: form.location.trim() || null,
      count_min: form.countMin !== "" ? Number(form.countMin) : null,
      count_max: form.countMax !== "" ? Number(form.countMax) : null,
      price: form.price !== "" ? Number(form.price) : null,
      tagNames: form.selectedTags,
    };

    try {
      setIsSaving(true);
      setError(null);

      // Reconcile children before saving metadata so the PATCH response includes updated children
      if (isProgram) {
        const origEventIds = new Set(
          initialProgramChildren.filter((c) => c.type === "event").map((c) => c.id)
        );
        const origTaskIds = new Set(
          initialProgramChildren.filter((c) => c.type === "task").map((c) => c.id)
        );
        const stagedEventIds = new Set(
          stagedProgramChildren.filter((c) => c.type === "event").map((c) => c.id)
        );
        const stagedTaskIds = new Set(
          stagedProgramChildren.filter((c) => c.type === "task").map((c) => c.id)
        );
        const removedEventIds = [...origEventIds].filter((id) => !stagedEventIds.has(id));
        const removedTaskIds = [...origTaskIds].filter((id) => !stagedTaskIds.has(id));
        await Promise.all([
          ...removedEventIds.map((id) => updateEvent(id, { program_id: null }, getToken)),
          ...removedTaskIds.map((id) => updateTask(id, { program_id: null }, getToken)),
          ...stagedProgramChildren.map((child, i) =>
            child.type === "event"
              ? updateEvent(child.id, { program_id: program.id, position: i }, getToken)
              : updateTask(child.id, { program_id: program.id, position: i }, getToken)
          ),
        ]);
      } else if (isEvent) {
        const origTaskIds = new Set(initialEventTasks.map((t) => t.id));
        const stagedTaskIds = new Set(stagedEventTasks.map((t) => t.id));
        const removedTasks = initialEventTasks.filter((t) => !stagedTaskIds.has(t.id));
        await Promise.all([
          ...removedTasks.map((t) => updateTask(t.id, { event_id: null }, getToken)),
          ...stagedEventTasks.map((t, i) =>
            updateTask(t.id, { event_id: program.id, position: i }, getToken)
          ),
        ]);
        void origTaskIds;
      }

      await onSave(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Villa kom upp við að vista");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Content type label ────────────────────────────────────────────────────

  const typeLabel = isProgram ? "dagskrá" : isEvent ? "viðburð" : "verkefni";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.editContainer}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* ── Section: Basic ── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Grunnupplýsingar</h3>

          <div className={styles.formGroup}>
            <label htmlFor="edit-name" className={styles.label}>
              Nafn <span className={styles.required}>*</span>
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

          {isProgram && (
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
          )}
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
                <span className={styles.rangeSep} aria-hidden="true">
                  –
                </span>
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
                <span className={styles.rangeSep} aria-hidden="true">
                  –
                </span>
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
            <label className={styles.label}>Fjöldi þátttakenda</label>
            <div className={styles.rangeRow}>
              <input
                type="number"
                className={styles.input}
                value={form.countMin}
                onChange={(e) => patch({ countMin: e.target.value })}
                placeholder="Frá"
                min={1}
                aria-label="Lágmarksfjöldi þátttakenda"
                disabled={isDisabled}
              />
              <span className={styles.rangeSep} aria-hidden="true">
                –
              </span>
              <input
                type="number"
                className={styles.input}
                value={form.countMax}
                onChange={(e) => patch({ countMax: e.target.value })}
                placeholder="Til"
                min={1}
                aria-label="Hámarksfjöldi þátttakenda"
                disabled={isDisabled}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <p className={styles.label} id="edit-age-label">
              Aldurshópar
            </p>
            <div className={styles.checkboxGrid} role="group" aria-labelledby="edit-age-label">
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
            {displayTags.length === 0 ? (
              <p className={styles.helpText}>Engir merkimiðar tiltækir</p>
            ) : (
              <>
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
                  <p className={styles.helpText}>{form.selectedTags.length} merkimiðar valdir</p>
                )}
              </>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="edit-image" className={styles.label}>
              Mynd (URL)
            </label>

            {form.image && (
              <div className={styles.imagePreviewContainer}>
                {!imageError ? (
                  <Image
                    src={form.image}
                    alt="Forskoðun myndar"
                    className={styles.imagePreview}
                    width={600}
                    height={300}
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
                  onClick={() => {
                    patch({ image: "" });
                    setImageError(false);
                  }}
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
              onChange={(e) => {
                setImageError(false);
                patch({ image: e.target.value });
              }}
              disabled={isDisabled}
              placeholder="https://example.com/mynd.jpg"
            />
            <p className={styles.helpText}>Settu inn slóð á mynd til að sýna á {typeLabel}num</p>
          </div>
        </section>

        {/* ── Section: Children ── */}
        {isProgram && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Dagskrárliðir</h3>
            <p className={styles.helpText} style={{ marginBottom: 8 }}>
              Viðburðir og verkefni í þessari dagskrá. Dragðu til að raða í þeirri röð sem þau eiga
              að koma.
            </p>
            <ContentPicker
              available={availableProgramChildren}
              staged={stagedProgramChildren}
              onChange={setStagedProgramChildren}
              placeholder="Leita að viðburði eða verkefni..."
              emptyText="Engar niðurstöður"
            />
          </section>
        )}

        {isEvent && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Dagskrárliðir</h3>
            <p className={styles.helpText} style={{ marginBottom: 8 }}>
              Verkefni sem tilheyra þessum viðburði. Dragðu til að raða.
            </p>
            <ContentPicker
              available={availableEventTasks}
              staged={stagedEventTasks}
              onChange={setStagedEventTasks}
              placeholder="Leita að verkefni..."
              emptyText="Engar niðurstöður"
            />
          </section>
        )}

        {/* ── Error ── */}
        {error && <div className={styles.error}>{error}</div>}

        {/* ── Actions ── */}
        <div className={styles.actions}>
          <button type="submit" className={styles.saveButton} disabled={isDisabled}>
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
            Þegar þessum {typeLabel} er eytt er ekki hægt að afturkalla það.
          </p>
          <button
            type="button"
            className={styles.deleteButton}
            onClick={onDeleteRequest}
            disabled={isDisabled}
          >
            {isDeleting ? "Eyði…" : `Eyða ${typeLabel}`}
          </button>
        </div>
      </form>
    </div>
  );
}
