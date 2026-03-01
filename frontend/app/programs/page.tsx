"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Modal from "@/components/Modal/Modal";
import NewProgramForm from "@/app/programs/components/NewProgramForm";
import ProgramCard from "@/app/programs/components/ProgramCard";
import ProgramGrid from "./components/ProgramGrid";
import ProgramFilterSidebar, {
  type SidebarFilters,
} from "./components/ProgramFilterSidebar";
import { ProgramsHeader } from "./components/ProgramsHeader";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal/DeleteConfirmModal";
import ProgramDetailEdit from "@/app/programs/[id]/components/ProgramDetailEdit";
import { useAuth } from "@/hooks/useAuth";
import { useDefaultWorkspaceId } from "@/hooks/useDefaultWorkspaceId";
import { useUserWorkspace } from "@/hooks/useUserWorkspace";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { useTags } from "@/hooks/useTags";
import { buildApiUrl, handleApiError } from "@/lib/api-utils";
import {
  updateProgram,
  deleteProgram,
  type Program,
  type ProgramUpdateInput,
} from "@/services/programs.service";
import { canEditProgram, canDeleteProgram } from "@/lib/permissions";
import pageStyles from "./ProgramsPage.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Shape of the workspace-scoped programs endpoint response.
 * The backend returns a plain array with X-Total-Count / Link headers.
 */
type CatalogProgram = Program;

type ProgramsApiResponse = {
  programs: CatalogProgram[];
  totalCount: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─── Service ──────────────────────────────────────────────────────────────────

async function fetchCatalogPrograms(
  filters: SidebarFilters,
  workspaceId: string,
  offset: number,
  getToken: () => Promise<string | null>
): Promise<ProgramsApiResponse> {
  const params = new URLSearchParams();

  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.age.length > 0) params.set("age", filters.age.join(","));
  if (filters.tags.length > 0) params.set("tags", filters.tags.join(","));
  if (filters.duration.length > 0) params.set("duration", filters.duration.join(","));
  if (filters.prep_time.length > 0) params.set("prep_time", filters.prep_time.join(","));
  if (filters.location.trim()) params.set("location", filters.location.trim());
  if (filters.count_min) params.set("count_min", filters.count_min);
  if (filters.count_max) params.set("count_max", filters.count_max);
  if (filters.price.length > 0) params.set("price", filters.price.join(","));

  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));

  const baseUrl = buildApiUrl(`/workspaces/${workspaceId}/programs`);
  const url = `${baseUrl}?${params.toString()}`;

  // Use raw fetch so we can read X-Total-Count from response headers.
  const token = await getToken();
  if (!token) throw new Error("No authentication token available");

  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.detail || errorData.message || `API error: ${response.statusText}`;
      throw new Error(msg);
    }
    throw new Error(`API error: ${response.statusText}`);
  }

  const programs: CatalogProgram[] = await response.json();
  const totalCount = parseInt(response.headers.get("X-Total-Count") ?? "0", 10);

  return { programs, totalCount };
}

// ─── Spinner for Load More button ─────────────────────────────────────────────

function LoadMoreSpinner() {
  return (
    <svg
      className={pageStyles.spinner}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className={pageStyles.spinnerTrack}
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className={pageStyles.spinnerHead}
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ─── Filter bar wrapped in Suspense (required by useSearchParams in Next.js 15) ──

interface FilterSidebarWrapperProps {
  tags: Array<{ id: string; name: string; color?: string }>;
  totalCount: number;
  isLoading: boolean;
  onChange: (filters: SidebarFilters) => void;
}

function FilterSidebarWrapper({
  tags,
  totalCount,
  isLoading,
  onChange,
}: FilterSidebarWrapperProps) {
  return (
    <Suspense
      fallback={
        <div className={pageStyles.filterBarSkeleton} aria-hidden="true" />
      }
    >
      <ProgramFilterSidebar
        tags={tags}
        totalCount={totalCount}
        isLoading={isLoading}
        onChange={onChange}
      />
    </Suspense>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProgramsPage() {
  // ── Auth & workspace ────────────────────────────────────────────────────────
  const { user, getToken } = useAuth();
  const defaultWorkspaceId = useDefaultWorkspaceId();
  const { workspaceId: userWorkspaceId } = useUserWorkspace();
  void userWorkspaceId; // retained for future workspace toggle
  const { role } = useWorkspaceRole(defaultWorkspaceId);

  // ── Tags (for the filter sidebar) ────────────────────────────────────────────
  const { tags: availableTags, loading: tagsLoading } = useTags();

  // ── Filter state (set by ProgramFilterSidebar via onChange) ─────────────────
  const [activeFilters, setActiveFilters] = useState<SidebarFilters>({
    q: "",
    age: [],
    tags: [],
    duration: [],
    prep_time: [],
    location: "",
    count_min: "",
    count_max: "",
    price: [],
  });

  // ── Program catalog state ─────────────────────────────────────────────────────
  const [programs, setPrograms] = useState<CatalogProgram[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Announcement for screen readers on "load more" ────────────────────────────
  const [announcement, setAnnouncement] = useState("");

  // ── Modal state ───────────────────────────────────────────────────────────────
  const [showNewProgram, setShowNewProgram] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [pendingDeleteProgram, setPendingDeleteProgram] =
    useState<Program | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Workspace for new programs ────────────────────────────────────────────────
  const postWorkspaceId = defaultWorkspaceId ?? "";

  // ── Abort controller ref (cancel in-flight requests on filter change) ─────────
  const abortRef = useRef<AbortController | null>(null);

  // ── Initial + filter-change fetch ─────────────────────────────────────────────

  const loadPrograms = useCallback(
    async (filters: SidebarFilters) => {
      if (!defaultWorkspaceId) return;

      // Cancel any pending request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setIsLoading(true);
      setError(null);
      setPrograms([]);
      setCurrentOffset(0);
      setTotalCount(0);

      try {
        const data = await fetchCatalogPrograms(filters, defaultWorkspaceId, 0, getToken);
        setPrograms(data.programs);
        setCurrentOffset(0);
        setTotalCount(data.totalCount);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(
          handleApiError(err, "Villa við að sækja dagskrár. Reyndu aftur.")
        );
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, defaultWorkspaceId]
  );

  // Re-trigger initial load once the default workspace ID resolves.
  const hasInitiallyLoaded = useRef(false);
  useEffect(() => {
    if (defaultWorkspaceId && !hasInitiallyLoaded.current) {
      hasInitiallyLoaded.current = true;
      loadPrograms(activeFilters);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultWorkspaceId]);

  // ── Load more (offset-based pagination) ─────────────────────────────────────

  const handleLoadMore = useCallback(async () => {
    const nextOffset = currentOffset + programs.length;
    if (nextOffset >= totalCount || isLoadingMore || !defaultWorkspaceId) return;
    setIsLoadingMore(true);
    try {
      const data = await fetchCatalogPrograms(
        activeFilters,
        defaultWorkspaceId,
        nextOffset,
        getToken
      );
      setPrograms((prev) => [...prev, ...data.programs]);
      setCurrentOffset(nextOffset);
      setTotalCount(data.totalCount);
      setAnnouncement(`${data.programs.length} fleiri dagskrár hlaðið`);
    } catch (err) {
      setError(
        handleApiError(err, "Villa við að sækja dagskrár. Reyndu aftur.")
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentOffset, programs.length, totalCount, isLoadingMore, activeFilters, getToken, defaultWorkspaceId]);

  // ── Filter change handler (from ProgramFilterSidebar) ────────────────────────
  // ProgramFilterSidebar owns the URL state. When it fires onChange the page
  // re-fetches from scratch, resetting pagination (cursor cleared in loadPrograms).

  const handleFilterChange = useCallback(
    (filters: SidebarFilters) => {
      setActiveFilters(filters);
      loadPrograms(filters);
    },
    [loadPrograms]
  );

  // ── Retry on error ────────────────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    loadPrograms(activeFilters);
  }, [loadPrograms, activeFilters]);

  // ── Edit / delete handlers ────────────────────────────────────────────────────

  const handleEditSave = async (data: ProgramUpdateInput) => {
    if (!editingProgram) return;
    await updateProgram(editingProgram.id, data, getToken);
    setEditingProgram(null);
    await loadPrograms(activeFilters);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteProgram) return;
    try {
      setIsDeleting(true);
      await deleteProgram(pendingDeleteProgram.id, getToken);
      setPendingDeleteProgram(null);
      await loadPrograms(activeFilters);
    } catch (err) {
      console.error("Failed to delete program:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleProgramCreated = async () => {
    setShowNewProgram(false);
    await loadPrograms(activeFilters);
  };

  // ── Dismiss aria-live announcement after it has been read ─────────────────────

  useEffect(() => {
    if (!announcement) return;
    const id = setTimeout(() => setAnnouncement(""), 3000);
    return () => clearTimeout(id);
  }, [announcement]);

  // ── Derived state ─────────────────────────────────────────────────────────────

  const isAnyFilterActive =
    activeFilters.q.trim() !== "" ||
    activeFilters.age.length > 0 ||
    activeFilters.tags.length > 0 ||
    activeFilters.duration.length > 0 ||
    activeFilters.prep_time.length > 0 ||
    activeFilters.location.trim() !== "" ||
    activeFilters.count_min !== "" ||
    activeFilters.count_max !== "" ||
    activeFilters.price.length > 0;

  const isEmpty = !isLoading && programs.length === 0 && !error;

  const filterBarTags: Array<{ id: string; name: string; color?: string }> =
    availableTags ?? [];

  const showLoadMore = !isLoading && (currentOffset + programs.length) < totalCount && !error;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Screen reader live region — pagination announcements ── */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className={pageStyles.srOnly}
      >
        {announcement}
      </div>

      <section className="builder-page">
        {/* Page title + FAB */}
        {/* <ProgramsHeader onNewProgram={() => setShowNewProgram(true)} /> */}

        {/* New Program Modal */}
        <Modal
          open={showNewProgram}
          onClose={() => setShowNewProgram(false)}
          title="Bæta hugmynd í bankann"
        >
          <NewProgramForm
            workspaceId={postWorkspaceId}
            onCreated={handleProgramCreated}
          />
        </Modal>

        {/*
         * ── Two-column layout ──
         *
         * .pageLayout    — outer wrapper, max-width + page padding
         * .filterColumn  — sticky left sidebar (~268px)
         * .mainColumn    — flex-grow right column (grid + states + load more)
         *
         * On <768px the sidebar stacks above the grid (flex-direction: column).
         * The FilterBar component handles its own mobile drawer collapse.
         */}
        <main className={pageStyles.pageLayout}>
          {/* ── Sidebar: filter controls ── */}
          <aside className={pageStyles.filterColumn}>
            <FilterSidebarWrapper
              tags={tagsLoading ? [] : filterBarTags}
              totalCount={isLoading ? 0 : totalCount}
              isLoading={isLoading || tagsLoading}
              onChange={handleFilterChange}
            />
          </aside>

          {/* ── Main content: grid + states + pagination ── */}
          <div className={pageStyles.mainColumn}>
            {/* Error state */}
            {error && (
              <div role="alert" className={pageStyles.errorState}>
                <p className={pageStyles.errorMessage}>
                  Villa við að sækja dagskrár. Reyndu aftur.
                </p>
                <button
                  type="button"
                  className={pageStyles.retryButton}
                  onClick={handleRetry}
                >
                  Reyna aftur
                </button>
              </div>
            )}

            {/*
             * Initial loading — ProgramGrid renders SKELETON_COUNT shimmer cards
             * when isLoading is true; children are ignored in that branch.
             */}
            {isLoading && !error && (
              <ProgramGrid isLoading={true} isEmpty={false}>
                <></>
              </ProgramGrid>
            )}

            {/* Empty state — no programs exist at all (no active filters) */}
            {isEmpty && !isAnyFilterActive && (
              <ProgramGrid
                isEmpty={true}
                isLoading={false}
                emptyMessage="Engar dagskrár til."
              >
                <></>
              </ProgramGrid>
            )}

            {/* Empty state — filters are active but nothing matches */}
            {isEmpty && isAnyFilterActive && (
              <div className={pageStyles.emptyFiltered}>
                <p className={pageStyles.emptyFilteredMessage}>
                  Engar dagskrár passa við leitarskilyrði.
                </p>
                {/*
                 * Linking to /programs without query params clears all filters.
                 * ProgramFilterSidebar reads URL on mount and will call onChange with
                 * the empty filter state, triggering a fresh fetch.
                 */}
                <a href="/programs" className={pageStyles.clearFiltersLink}>
                  Hreinsa síur
                </a>
              </div>
            )}

            {/* Results grid */}
            {!isLoading && !error && programs.length > 0 && (
              <ProgramGrid isEmpty={false} isLoading={false}>
                {programs.map((p) => (
                  <ProgramCard
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    image={p.image}
                    description={p.description}
                    tags={p.tags}
                    age={p.age}
                    duration={p.duration}
                    prep_time={p.prep_time}
                    count={p.count}
                    price={p.price}
                    location={p.location}
                    author={p.author}
                    like_count={p.like_count}
                    canEdit={canEditProgram(user, p, role)}
                    canDelete={canDeleteProgram(user, p, role)}
                    onEdit={() => setEditingProgram(p)}
                    onDelete={() => setPendingDeleteProgram(p)}
                  />
                ))}
              </ProgramGrid>
            )}

            {/*
             * Skeleton cards appended below existing results while loading more.
             * The negative margin pulls the skeleton grid flush against the
             * last real card row so there is no double gap.
             */}
            {isLoadingMore && programs.length > 0 && (
              <ProgramGrid
                isLoading={true}
                isEmpty={false}
                className={pageStyles.loadMoreSkeletons}
              >
                <></>
              </ProgramGrid>
            )}

            {/* Load More */}
            {showLoadMore && (
              <div className={pageStyles.loadMoreRow}>
                <button
                  type="button"
                  className={pageStyles.loadMoreButton}
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  aria-label={
                    isLoadingMore
                      ? "Hleður dagskrám..."
                      : "Sækja fleiri dagskrár"
                  }
                >
                  {isLoadingMore ? (
                    <>
                      <LoadMoreSpinner />
                      Hleður dagskrám...
                    </>
                  ) : (
                    "Sækja fleiri"
                  )}
                </button>
              </div>
            )}
          </div>
        </main>
      </section>

      {/* ── Edit modal ── */}
      <Modal
        open={!!editingProgram}
        onClose={() => setEditingProgram(null)}
        title="Breyta dagskrá"
      >
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

      {/* ── Delete confirmation modal ── */}
      <DeleteConfirmModal
        open={!!pendingDeleteProgram}
        programName={pendingDeleteProgram?.name}
        isDeleting={isDeleting}
        onClose={() => setPendingDeleteProgram(null)}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
