"use client";

import React, { useState, useRef, Suspense } from "react";
import Modal from "@/components/Modal/Modal";
import NewProgramForm from "@/app/programs/components/NewProgramForm";
import ProgramGrid from "./components/ProgramGrid";
import ProgramSort from "./components/ProgramSort";
import type { SortOption } from "./components/ProgramSort";
import Pagination from "./components/Pagination";
import { ProgramsHeader } from "./components/ProgramsHeader";
import SearchInput from "@/components/filters/SearchInput";
import FilterSidebar, { FilterDrawer } from "@/components/filters/FilterSidebar";
import ActiveFilterBar from "@/components/filters/ActiveFilterBar";
import styles from "./programs.module.css";
import usePrograms from "@/hooks/usePrograms";
import { useUserWorkspace } from "@/hooks/useUserWorkspace";
import { useProgramFilters } from "@/hooks/useProgramFilters";
import type { FilterState } from "@/hooks/useProgramFilters";
import { usePagination } from "@/hooks/usePagination";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { PROGRAMS_PER_PAGE } from "@/constants/config";
import { useDefaultWorkspaceId } from "@/hooks/useDefaultWorkspaceId";
import { canEditProgram, canDeleteProgram } from "@/lib/permissions";
import {
  updateProgram,
  deleteProgram,
  type Program,
  type ProgramUpdateInput,
} from "@/services/programs.service";
import ProgramDetailEdit from "@/app/programs/[id]/components/ProgramDetailEdit";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal/DeleteConfirmModal";

/**
 * Map between the new FilterState sortBy values ("liked", "alpha")
 * and the legacy ProgramSort component values ("most-liked", "alphabetical").
 */
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

/**
 * Inner page component wrapped in Suspense for useSearchParams support.
 */
function ProgramsPageInner() {
  const [showNewProgram, setShowNewProgram] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const filterToggleRef = useRef<HTMLButtonElement>(null);

  // Resolve the shared workspace ID
  const defaultWorkspaceId = useDefaultWorkspaceId();

  // Fetch data
  const {
    programs,
    loading: programsLoading,
    error: programsError,
    refetch,
  } = usePrograms(defaultWorkspaceId);

  // User's private workspace (retained for future toggle)
  const { workspaceId: userWorkspaceId } = useUserWorkspace();

  // ── Auth & workspace role ──────────────────────────────────────────────
  const { user, getToken } = useAuth();
  const { role } = useWorkspaceRole(defaultWorkspaceId);

  // ── Edit / delete modal state ──────────────────────────────────────────
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [pendingDeleteProgram, setPendingDeleteProgram] = useState<Program | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── WHERE TO POST new programs ──────────────────────────────────────────
  const postWorkspaceId = defaultWorkspaceId ?? "";
  void userWorkspaceId; // retained for future toggle

  // ── Edit / delete handlers ─────────────────────────────────────────────
  const handleEditSave = async (data: ProgramUpdateInput) => {
    if (!editingProgram) return;
    await updateProgram(editingProgram.id, data, getToken);
    setEditingProgram(null);
    await refetch();
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteProgram) return;
    try {
      setIsDeleting(true);
      await deleteProgram(pendingDeleteProgram.id, getToken);
      setPendingDeleteProgram(null);
      await refetch();
    } catch (err) {
      console.error("Failed to delete program:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Filters (new comprehensive hook from 4A) ──────────────────────────
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
  } = useProgramFilters(programs || []);

  // ── Pagination ─────────────────────────────────────────────────────────
  const { currentPage, totalPages, paginatedItems, setCurrentPage, totalItems, itemsPerPage } =
    usePagination(filtered, PROGRAMS_PER_PAGE);

  const handleProgramCreated = async () => {
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

  return (
    <div className={styles.page}>
      {/* Header with FAB button */}
      <ProgramsHeader onNewProgram={() => setShowNewProgram(true)} />

      {/* New Program Modal */}
      <Modal
        open={showNewProgram}
        onClose={() => setShowNewProgram(false)}
        title="Bæta hugmynd í bankann"
      >
        <NewProgramForm workspaceId={postWorkspaceId} onCreated={handleProgramCreated} />
      </Modal>

      {/* Top bar: Search + mobile filter toggle + Sort */}
      <div className={styles.topBar}>
        <div className={styles.searchWrapper}>
          <SearchInput
            value={filters.search}
            onChange={(search) => setFilters({ search })}
            placeholder="Leita í dagskrárbanka"
          />
        </div>

        {/* Mobile filter toggle — hidden on desktop via CSS */}
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

      {/* Main content area: sidebar + programs */}
      <div className={styles.content}>
        {/* Desktop sidebar — hidden on mobile via CSS */}
        <FilterSidebar {...filterSidebarProps} />

        <main className={styles.main}>
          {/* Active filter chips */}
          <ActiveFilterBar chips={activeChips} onClearAll={clearAll} />

          {/* Result count */}
          <p className={styles.resultCount} aria-live="polite">
            {filtered.length === 1 ? "1 dagskrá" : `${filtered.length} dagskrár`}
          </p>

          {/* Program Grid */}
          <ProgramGrid
            programs={paginatedItems}
            isLoading={programsLoading}
            error={programsError ? "Villa kom upp við að sækja dagskrár" : undefined}
            onRetry={refetch}
            onEdit={(p) => setEditingProgram(p)}
            onDelete={(p) => setPendingDeleteProgram(p)}
            canEdit={(p) => canEditProgram(user, p, role)}
            canDelete={(p) => canDeleteProgram(user, p, role)}
          />

          {/* Pagination */}
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
      <Modal open={!!editingProgram} onClose={() => setEditingProgram(null)} title="Breyta dagskrá">
        {editingProgram && (
          <ProgramDetailEdit
            program={editingProgram}
            onSave={handleEditSave}
            onCancel={() => setEditingProgram(null)}
            onDeleteRequest={() => {
              setPendingDeleteProgram(editingProgram);
              setEditingProgram(null);
            }}
            isDeleting={false}
          />
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        open={!!pendingDeleteProgram}
        programName={pendingDeleteProgram?.name}
        isDeleting={isDeleting}
        onClose={() => setPendingDeleteProgram(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

/**
 * Programs page — displays the program bank (dagskrárbankinn) with search,
 * filtering, sorting, and pagination capabilities.
 *
 * Wrapped in Suspense because useProgramFilters uses useSearchParams().
 */
export default function ProgramsPage() {
  return (
    <Suspense>
      <ProgramsPageInner />
    </Suspense>
  );
}
