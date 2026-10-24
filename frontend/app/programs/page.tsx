"use client";

import React, { useState, useRef, useEffect, useMemo, Suspense } from "react";
import ProgramGrid from "./components/ProgramGrid";
import ProgramSort from "./components/ProgramSort";
import type { SortOption } from "./components/ProgramSort";
import Pagination from "./components/Pagination";
import { ProgramsHeader } from "./components/ProgramsHeader";
import type { BankContentType } from "@/components/ContentTypeChooser/ContentTypeChooser";
import ContentCreateModal from "@/components/ContentCreateModal/ContentCreateModal";
import SearchInput from "@/components/filters/SearchInput";
import FilterSidebar, { FilterDrawer } from "@/components/filters/FilterSidebar";
import ActiveFilterBar from "@/components/filters/ActiveFilterBar";
import styles from "./programs.module.css";
import usePrograms from "@/hooks/usePrograms";
import { useProgramFilters } from "@/hooks/useProgramFilters";
import type { FilterState } from "@/hooks/useProgramFilters";
import { useAuth } from "@/hooks/useAuth";
import { fetchMySuspension } from "@/services/suspensions.service";
import { countIs, formatIcelandicDate } from "@/lib/format";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { PROGRAMS_PER_PAGE } from "@/constants/config";
import { useDefaultWorkspaceId } from "@/hooks/useDefaultWorkspaceId";
import { canCreateProgram, canEditProgram, canDeleteProgram } from "@/lib/permissions";
import {
  deleteBankContent,
  fetchProgramById,
  type ContentQuery,
  type Program,
} from "@/services/programs.service";
import {
  DeleteConfirmModal,
  DELETE_FAILED_MESSAGE,
} from "@/components/DeleteConfirmModal/DeleteConfirmModal";

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
  const [newType, setNewType] = useState<BankContentType>("task");
  // Read on arrival: a leader should learn they cannot submit before writing
  // something, not after the API refuses it.
  const [suspendedUntil, setSuspendedUntil] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const filterToggleRef = useRef<HTMLButtonElement>(null);

  // Resolve the shared workspace ID
  const defaultWorkspaceId = useDefaultWorkspaceId();

  // ── Filters ────────────────────────────────────────────────────────────
  // The array argument is now only there for the hook's own unique-value
  // helpers, which this page no longer uses: the option lists come from the
  // server's facets, and filtering happens there too.
  // The page is kept with the filters, in the URL; changing a filter goes
  // back to the first page in the same render, so in the same fetch.
  const {
    filters,
    setFilters,
    page: currentPage,
    setPage: setCurrentPage,
    activeChips,
    clearAll,
  } = useProgramFilters([]);

  const query: ContentQuery = useMemo(
    () => ({
      search: filters.search,
      ages: filters.ages,
      tags: filters.tags,
      equipment: filters.equipment,
      author: filters.author,
      location: filters.location,
      durationMin: filters.durationMin,
      durationMax: filters.durationMax,
      prepMin: filters.prepMin,
      prepMax: filters.prepMax,
      countMin: filters.countMin,
      countMax: filters.countMax,
      freeOnly: filters.freeOnly,
      priceMax: filters.priceMax,
      sortBy: filters.sortBy,
    }),
    [filters]
  );

  // Fetch one page, filtered and sorted by the server.
  const {
    programs,
    total,
    facets,
    loading: programsLoading,
    error: programsError,
    refetch,
  } = usePrograms(defaultWorkspaceId, {
    query,
    page: currentPage,
    pageSize: PROGRAMS_PER_PAGE,
  });

  // ── Auth & workspace role ──────────────────────────────────────────────
  const { user, getToken } = useAuth();

  useEffect(() => {
    // Best effort: if this fails the button stays enabled and the API refuses
    // the write instead. A banner is a courtesy, not the enforcement.
    fetchMySuspension(getToken)
      .then((active) =>
        // Open-ended has no date to show; the banner says so in words instead.
        setSuspendedUntil(active ? (active.expires_at?.slice(0, 10) ?? "open-ended") : null)
      )
      .catch(() => setSuspendedUntil(null));
  }, [getToken]);
  const { role } = useWorkspaceRole(defaultWorkspaceId);

  // ── Edit / delete modal state ──────────────────────────────────────────
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  // The card being opened for editing, while its full item is fetched.
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const [pendingDeleteProgram, setPendingDeleteProgram] = useState<Program | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── WHERE TO POST new programs ──────────────────────────────────────────
  const postWorkspaceId = defaultWorkspaceId ?? "";

  // ── Edit / delete handlers ─────────────────────────────────────────────

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteProgram) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await deleteBankContent(pendingDeleteProgram.content_type, pendingDeleteProgram.id, getToken);
      setPendingDeleteProgram(null);
      await refetch();
    } catch (err) {
      console.error("Failed to delete program:", err);
      setDeleteError(DELETE_FAILED_MESSAGE);
    } finally {
      setIsDeleting(false);
    }
  };

  /*
   * Open the editor with the whole item, never with the card's row.
   *
   * The bank is listed from `ContentListOut`, a summary without
   * `instructions` or `media`. Handing that to the form as `initial` made it
   * start with those fields empty, and saving a new title wiped the
   * leiðbeiningar and the attached documents (sc-530). If the item cannot be
   * fetched the editor does not open at all: a form missing half the item is
   * worse than no form.
   */
  const openEditor = async (row: Program) => {
    if (loadingEditId) return;
    setLoadingEditId(row.id);
    setEditLoadError(null);
    try {
      setEditingProgram(await fetchProgramById(row.id, getToken, { fresh: true }));
    } catch (err) {
      console.error("Failed to load item for editing:", err);
      setEditLoadError(`Ekki tókst að opna ${row.name} til breytinga. Reyndu aftur.`);
    } finally {
      setLoadingEditId(null);
    }
  };

  // ── Pagination ─────────────────────────────────────────────────────────
  // Driven by the server's count, not by the length of what was fetched.
  const totalItems = total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PROGRAMS_PER_PAGE));
  const itemsPerPage = PROGRAMS_PER_PAGE;

  // A shared or old link can name a page past the end of what the bank now
  // holds for those filters. Land on the last page rather than an empty grid.
  // Not on an error or an empty result: their count of 0 says nothing about
  // which page exists.
  useEffect(() => {
    if (!programsLoading && !programsError && totalItems > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [programsLoading, programsError, totalItems, currentPage, totalPages, setCurrentPage]);

  const handleProgramCreated = async () => {
    setShowNewProgram(false);
    await refetch();
  };

  // ── Shared filter sidebar props ────────────────────────────────────────
  const filterSidebarProps = {
    selectedAges: filters.ages,
    onAgesChange: (ages: string[]) => setFilters({ ages }),

    availableTags: facets.tags,
    selectedTags: filters.tags,
    onTagsChange: (tags: string[]) => setFilters({ tags }),

    uniqueEquipment: facets.equipment,
    selectedEquipment: filters.equipment,
    onEquipmentChange: (equipment: string[]) => setFilters({ equipment }),

    authorValue: filters.author,
    onAuthorChange: (author: string) => setFilters({ author }),
    uniqueAuthors: facets.authors,

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
    uniqueLocations: facets.locations,
  };

  // The server counts with the filters applied, so this is the honest total
  // whether or not anything is narrowed — no more "200 of 10.004" hedging.
  const countLabel = countIs(totalItems, "hugmynd", "hugmyndir");

  return (
    <div className={styles.page}>
      {/* Header with FAB button */}
      {suspendedUntil && (
        <p className={styles.suspendedBanner} role="status">
          {suspendedUntil === "open-ended"
            ? "Þú getur ekki sent inn efni í bankann. Hafðu samband við Dagskrárstjórnarteymið."
            : `Þú getur ekki sent inn efni í bankann fram til ${formatIcelandicDate(suspendedUntil)}.`}{" "}
          Þú getur áfram lesið bankann og notað dagskrár.
        </p>
      )}
      <ProgramsHeader
        onNewContent={(type) => {
          setNewType(type);
          setShowNewProgram(true);
        }}
        suspendedUntil={suspendedUntil}
        canCreate={canCreateProgram(role, postWorkspaceId, defaultWorkspaceId)}
      />

      {/* The create form owns its whole dialog — fixed header, scrolling body
          and a pinned footer — so it is not wrapped in `components/Modal`. */}
      {showNewProgram && (
        <ContentCreateModal
          contentType={newType}
          workspaceId={postWorkspaceId}
          onCreated={() => void handleProgramCreated()}
          onClose={() => setShowNewProgram(false)}
        />
      )}

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
            {/* „hugmyndir", not „dagskrár": the bank holds verkefni, viðburðir
                and dagskrár, and naming it after one of the three was only
                accurate while everything was filed as that one. And the count
                has to be the bank's, not the page's — fetching 200 of 10.004
                and calling it "200" is a plain untruth on the reader's screen. */}
            {countLabel}
          </p>

          {editLoadError && (
            <p className={styles.editLoadError} role="alert">
              {editLoadError}
            </p>
          )}

          {/* Program Grid */}
          <ProgramGrid
            programs={programs ?? []}
            isLoading={programsLoading}
            error={programsError ? "Villa kom upp við að sækja dagskrár" : undefined}
            onRetry={refetch}
            onEdit={(p) => void openEditor(p)}
            loadingEditId={loadingEditId}
            onDelete={(p) => setPendingDeleteProgram(p)}
            canEdit={(p) => canEditProgram(user, p, role)}
            canDelete={(p) => canDeleteProgram(user, p, role)}
          />

          {/* Pagination */}
          {totalItems > 0 && (
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

      {/* Editing uses the same form as creating — and the same one the detail
          page shows inline. The title came from a second, hand-maintained form
          and always said „dagskrá", whatever kind the item actually was. */}
      {editingProgram && (
        <ContentCreateModal
          contentType={(editingProgram.content_type ?? "task") as BankContentType}
          workspaceId={editingProgram.workspace_id}
          initial={editingProgram}
          onCreated={() => {
            setEditingProgram(null);
            void refetch();
          }}
          onClose={() => setEditingProgram(null)}
        />
      )}

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        open={!!pendingDeleteProgram}
        programName={pendingDeleteProgram?.name}
        isDeleting={isDeleting}
        error={deleteError}
        onClose={() => {
          setPendingDeleteProgram(null);
          setDeleteError(null);
        }}
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
