"use client";

import React, { useState, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Search } from "lucide-react";
import styles from "./ContentPicker.module.css";

export type PickerItem = {
  id: string;
  name: string;
  description?: string | null;
  type?: "event" | "task";
};

interface ContentPickerProps {
  /** All available items to choose from */
  available: PickerItem[];
  /** Currently staged (selected) items */
  staged: PickerItem[];
  onChange: (staged: PickerItem[]) => void;
  placeholder?: string;
  emptyText?: string;
}

export function ContentPicker({
  available,
  staged,
  onChange,
  placeholder = "Leita...",
  emptyText = "Engin atriði til",
}: ContentPickerProps) {
  const [query, setQuery] = useState("");

  const stagedIds = useMemo(() => new Set(staged.map((s) => s.id)), [staged]);

  const filteredAvailable = useMemo(() => {
    const q = query.trim().toLowerCase();
    return available.filter(
      (item) => !stagedIds.has(item.id) && (!q || item.name.toLowerCase().includes(q))
    );
  }, [available, stagedIds, query]);

  const add = (item: PickerItem) => {
    onChange([...staged, item]);
  };

  const remove = (id: string) => {
    onChange(staged.filter((s) => s.id !== id));
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = staged.findIndex((s) => s.id === active.id);
      const newIndex = staged.findIndex((s) => s.id === over.id);
      onChange(arrayMove(staged, oldIndex, newIndex));
    }
  };

  return (
    <div className={styles.container}>
      {/* Search input */}
      <div className={styles.searchRow}>
        <Search size={14} className={styles.searchIcon} aria-hidden="true" />
        <input
          type="text"
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
      </div>

      {/* Available items list */}
      <div className={styles.availableList} role="listbox" aria-label="Tiltæk atriði">
        {filteredAvailable.length === 0 ? (
          <p className={styles.empty}>{query ? "Ekkert fannst" : emptyText}</p>
        ) : (
          filteredAvailable.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.availableItem}
              onClick={() => add(item)}
              role="option"
              aria-selected={false}
            >
              <span className={styles.availableItemMain}>
                {item.type && (
                  <span
                    className={`${styles.typeBadge} ${item.type === "event" ? styles.typeBadgeEvent : styles.typeBadgeTask}`}
                  >
                    {item.type === "event" ? "Viðburður" : "Verkefni"}
                  </span>
                )}
                <span className={styles.availableName}>{item.name}</span>
              </span>
              {item.description && <span className={styles.availableDesc}>{item.description}</span>}
              <span className={styles.addChip}>+</span>
            </button>
          ))
        )}
      </div>

      {/* Staged items with drag-and-drop */}
      {staged.length > 0 && (
        <div className={styles.stagedSection}>
          <p className={styles.stagedLabel}>Valin atriði ({staged.length})</p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={staged.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <ul className={styles.stagedList}>
                {staged.map((item, index) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    index={index}
                    onRemove={() => remove(item.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

interface SortableItemProps {
  item: PickerItem;
  index: number;
  onRemove: () => void;
}

function SortableItem({ item, index, onRemove }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className={styles.stagedItem}>
      <span className={styles.dragHandle} {...attributes} {...listeners} aria-label="Færa">
        <GripVertical size={16} aria-hidden="true" />
      </span>
      <span className={styles.stagedIndex}>{index + 1}.</span>
      {item.type && (
        <span
          className={`${styles.typeBadge} ${item.type === "event" ? styles.typeBadgeEvent : styles.typeBadgeTask}`}
        >
          {item.type === "event" ? "Vð" : "Vk"}
        </span>
      )}
      <span className={styles.stagedName}>{item.name}</span>
      <button
        type="button"
        className={styles.removeBtn}
        onClick={onRemove}
        aria-label={`Fjarlægja ${item.name}`}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </li>
  );
}
