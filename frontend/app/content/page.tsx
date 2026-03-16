"use client";

import React, { useState, useRef, Suspense } from "react";
import Modal from "@/components/Modal/Modal";
import NewProgramForm from "@/app/content/components/NewProgramForm";
import NewEventForm from "@/app/content/components/NewEventForm";
import NewTaskForm from "@/app/content/components/NewTaskForm";
import ProgramGrid from "./components/ProgramGrid";
import ProgramSort from "./components/ProgramSort";
import type { SortOption } from "./components/ProgramSort";
import Pagination from "./components/Pagination";
import { ContentFab } from "./components/ContentFab";
import SearchInput from "@/components/filters/SearchInput";
import FilterSidebar, { FilterDrawer } from "@/components/filters/FilterSidebar";
import ActiveFilterBar from "@/components/filters/ActiveFilterBar";
import styles from "./programs.module.css";
import fabStyles from "./content.module.css";
import useContentItems from "@/hooks/useContentItems";
import { useUserWorkspace } from "@/hooks/useUserWorkspace";
import { useProgramFilters } from "@/hooks/useProgramFilters";
import type { FilterState } from "@/hooks/useProgramFilters";
import { usePagination } from "@/hooks/usePagination";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { PROGRAMS_PER_PAGE } from "@/constants/config";
import { useDefaultWorkspaceId } from "@/hooks/useDefaultWorkspaceId";
import { canEditProgram, canDeleteProgram } from "@/lib/permissions";
import type { ContentItem, ContentType } from "@/services/content.service";
import { CONTENT_TYPE_LABELS } from "@/services/content.service";
import { updateProgram, type ProgramUpdateInput } from "@/services/programs.service";
import { updateEvent } from "@/services/events.service";
import { updateTask } from "@/services/tasks.service";
import { deleteProgram } from "@/services/programs.service";
import { deleteEvent } from "@/services/events.service";
import { deleteTask } from "@/services/tasks.service";
import ProgramDetailEdit from "@/app/content/[id]/components/ProgramDetailEdit";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal/DeleteConfirmModal";

const SORT_TO_LEGACY: Record<FilterState["sortBy"], SortOption> = {
  newest: "newest",
  oldest: "oldest",
  liked: "most-liked",
  alpha: "alphabetical",
};

const LEGACY_TO_SORT: Record<SortOption, FilterState["sortBy"]> = {
  newest: "newest",
  oldest: "oldest",
  "most-liked": "liked",
  alphabetical: "alpha",
};

const CONTENT_TYPE_FILTERS: Array<{ value: ContentType | "all"; label: string }> = [
  { value: "all", label: "Allt" },
  { value: "task", label: CONTENT_TYPE_LABELS.task },
  { value: "event", label: CONTENT_TYPE_LABELS.event },
  { value: "program", label: CONTENT_TYPE_LABELS.program },
];

function ContentPageInner() {
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [showNewProgram, setShowNewProgram] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentType | "all">("all");
  const filterToggleRef = useRef<HTMLButtonElement>(null);

  const defaultWorkspaceId = useDefaultWorkspaceId();
  const { workspaceId: userWorkspaceId } = useUserWorkspace();
  void userWorkspaceId;

  const { items, loading, error, refetch } = useContentItems(defaultWorkspaceId);
  const { user, getToken } = useAuth();
  const { role } = useWorkspaceRole(defaultWorkspaceId);

  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<ContentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const postWorkspaceId = defaultWorkspaceId ?? "";

  // ── Filter by content type ──────────────────────────────────────────────
  const typeFilteredItems = (items ?? []).filter(
    (item) => contentTypeFilter === "all" || item.content_type === contentTypeFilter
  );

  // ── Edit / delete handlers ─────────────────────────────────────────────
  const handleEditSave = async (data: ProgramUpdateInput) => {
    if (!editingItem) return;
    if (editingItem.content_type === "program") {
      await updateProgram(editingItem.id, data, getToken);
    } else if (editingItem.content_type === "event") {
      await updateEvent(editingItem.id, data, getToken);
    } else {
      await updateTask(editingItem.id, data, getToken);
    }
    setEditingItem(null);
    await refetch();
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteItem) return;
    try {
      setIsDeleting(true);
      if (pendingDeleteItem.content_type === "program") {
        await deleteProgram(pendingDeleteItem.id, getToken);
      } else if (pendingDeleteItem.content_type === "event") {
        await deleteEvent(pendingDeleteItem.id, getToken);
      } else {
        await deleteTask(pendingDeleteItem.id, getToken);
      }
      setPendingDeleteItem(null);
      await refetch();
    } catch (err) {
      console.error("Failed to delete item:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Filters ────────────────────────────────────────────────────────────
  const {
    filters,
    setFilters,
    filtered,
    activeChips,
    clearAll,
    uniqueLocations,
    uniqueAuthors,
    uniqueTags,
    uniqueEquipment,
  } = useProgramFilters(typeFilteredItems);

  // ── Pagination ─────────────────────────────────────────────────────────
  const { currentPage, totalPages, paginatedItems, setCurrentPage, totalItems, itemsPerPage } =
    usePagination(filtered, PROGRAMS_PER_PAGE);

  const handleCreated = async () => {
    setShowNewTask(false);
    setShowNewEvent(false);
    setShowNewProgram(false);
    await refetch();
  };

  // ── Shared filter sidebar props ────────────────────────────────────────
  const filterSidebarProps = {
    selectedAges: filters.ages,
    onAgesChange: (ages: string[]) => setFilters({ ages }),
    availableTags: uniqueTags,
    selectedTags: filters.tags,
    onTagsChange: (tags: string[]) => setFilters({ tags }),
    uniqueEquipment,
    selectedEquipment: filters.equipment,
    onEquipmentChange: (equipment: string[]) => setFilters({ equipment }),
    authorValue: filters.author,
    onAuthorChange: (author: string) => setFilters({ author }),
    uniqueAuthors,
    durationMin: filters.durationMin,
    durationMax: filters.durationMax,
    onDurationChange: (min: number | undefined, max: number | undefined) =>
      setFilters({ durationMin: min, durationMax: max }),
    prepMin: filters.prepMin,
    prepMax: filters.prepMax,
    onPrepTimeChange: (min: number | undefined, max: number | undefined) =>
      setFilters({ prepMin: min, prepMax: max }),
    countMin: filters.countMin,
    countMax: filters.countMax,
    onParticipantChange: (min: number | undefined, max: number | undefined) =>
      setFilters({ countMin: min, countMax: max }),
    freeOnly: filters.freeOnly,
    priceMax: filters.priceMax,
    onPriceChange: (freeOnly: boolean, maxPrice: number | undefined) =>
      setFilters({ freeOnly, priceMax: maxPrice }),
    locationValue: filters.location,
    onLocationChange: (location: string) => setFilters({ location }),
    uniqueLocations,
  };

  const editModalTitle =
    editingItem?.content_type === "event"
      ? "Breyta viðburði"
      : editingItem?.content_type === "task"
        ? "Breyta verkefni"
        : "Breyta dagskrá";

  return (
    <div className={styles.page}>
      {/* Radial FAB */}
      <ContentFab
        onNewTask={() => setShowNewTask(true)}
        onNewEvent={() => setShowNewEvent(true)}
        onNewProgram={() => setShowNewProgram(true)}
      />

      {/* Create modals */}
      <Modal
        open={showNewTask}
        onClose={() => setShowNewTask(false)}
        title="Bæta verkefni í bankann"
      >
        <NewTaskForm workspaceId={postWorkspaceId} onCreated={handleCreated} />
      </Modal>
      <Modal
        open={showNewEvent}
        onClose={() => setShowNewEvent(false)}
        title="Bæta viðburði í bankann"
      >
        <NewEventForm workspaceId={postWorkspaceId} onCreated={handleCreated} />
      </Modal>
      <Modal
        open={showNewProgram}
        onClose={() => setShowNewProgram(false)}
        title="Bæta dagskrá í bankann"
      >
        <NewProgramForm workspaceId={postWorkspaceId} onCreated={handleCreated} />
      </Modal>

      {/* Top bar: Content type filter + Search + Sort */}
      <div className={styles.topBar}>
        {/* Content type toggle */}
        <div className={fabStyles.typeFilter} role="group" aria-label="Sía eftir tegund">
          {CONTENT_TYPE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`${fabStyles.typeFilterBtn} ${contentTypeFilter === value ? fabStyles.typeFilterBtnActive : ""}`}
              onClick={() => setContentTypeFilter(value)}
              aria-pressed={contentTypeFilter === value}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={styles.searchWrapper}>
          <SearchInput
            value={filters.search}
            onChange={(search) => setFilters({ search })}
            placeholder="Leita í dagskrárbanka"
          />
        </div>

        <button
          ref={filterToggleRef}
          type="button"
          className={styles.filterToggle}
          onClick={() => setDrawerOpen(true)}
          aria-expanded={drawerOpen}
          aria-controls="filter-drawer"
        >
          <svg
            className={styles.filterToggleIcon}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          Sía
          {activeChips.length > 0 && (
            <span className={styles.filterToggleBadge}>{activeChips.length}</span>
          )}
        </button>

        <ProgramSort
          value={SORT_TO_LEGACY[filters.sortBy]}
          onChange={(legacySort) => setFilters({ sortBy: LEGACY_TO_SORT[legacySort] })}
        />
      </div>

      {/* Main content area: sidebar + grid */}
      <div className={styles.content}>
        <FilterSidebar {...filterSidebarProps} />

        <main className={styles.main}>
          <ActiveFilterBar chips={activeChips} onClearAll={clearAll} />

          <p className={styles.resultCount} aria-live="polite">
            {filtered.length} atriði
          </p>

          <ProgramGrid
            programs={paginatedItems}
            isLoading={loading}
            error={error ? "Villa kom upp við að sækja efni" : undefined}
            onRetry={refetch}
            onEdit={(item) => setEditingItem(item)}
            onDelete={(item) => setPendingDeleteItem(item)}
            canEdit={(item) => canEditProgram(user, item, role)}
            canDelete={(item) => canDeleteProgram(user, item, role)}
          />

          {filtered.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
            />
          )}
        </main>
      </div>

      {/* Mobile filter drawer */}
      <FilterDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeFilterCount={activeChips.length}
        triggerRef={filterToggleRef}
        {...filterSidebarProps}
      />

      {/* Edit modal */}
      <Modal open={!!editingItem} onClose={() => setEditingItem(null)} title={editModalTitle}>
        {editingItem && (
          <ProgramDetailEdit
            program={editingItem as Parameters<typeof ProgramDetailEdit>[0]["program"]}
            onSave={handleEditSave}
            onCancel={() => setEditingItem(null)}
            onDeleteRequest={() => {
              setPendingDeleteItem(editingItem);
              setEditingItem(null);
            }}
            isDeleting={false}
          />
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        open={!!pendingDeleteItem}
        programName={pendingDeleteItem?.name}
        isDeleting={isDeleting}
        onClose={() => setPendingDeleteItem(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

export default function ContentPage() {
  return (
    <Suspense>
      <ContentPageInner />
    </Suspense>
  );
}
