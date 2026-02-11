"use client";

import React, { useState } from "react";
import Modal from "@/components/Modal/Modal";
import NewProgramForm from "@/app/programs/components/NewProgramForm";
import ProgramCard from "@/app/programs/components/ProgramCard";
import ProgramGrid from "./components/ProgramGrid";
import ProgramSearch from "./components/ProgramSearch";
import ProgramFilters from "./components/ProgramFilters";
import ProgramSort from "./components/ProgramSort";
import Pagination from "./components/Pagination";
import { ProgramsHeader } from "./components/ProgramsHeader";
import styles from "./program.module.css";
import { useTags } from "@/hooks/useTags";
import usePrograms from "@/hooks/usePrograms";
import { useUserWorkspace } from "@/hooks/useUserWorkspace";
import { useProgramFilters } from "@/hooks/useProgramFilters";
import { usePagination } from "@/hooks/usePagination";
import { DEFAULT_WORKSPACE_ID, PROGRAMS_PER_PAGE } from "@/constants/config";

/**
 * Programs page - displays the program bank (dagskrárbankinn) with search,
 * filtering, sorting, and pagination capabilities.
 */
export default function ProgramsPage() {
    const [showNewProgram, setShowNewProgram] = useState(false);

    // Fetch data
    const { tagNames: availableTags, loading: tagsLoading } = useTags();
    const { programs, loading: programsLoading, error: programsError, refetch } = usePrograms(DEFAULT_WORKSPACE_ID);
    const { workspaceId: userWorkspaceId, error: workspaceError } = useUserWorkspace();

    // Apply filters and sorting
    const {
        query,
        setQuery,
        selectedTags,
        setSelectedTags,
        sortBy,
        setSortBy,
        filteredAndSorted,
        clearFilters,
    } = useProgramFilters(programs || []);

    // Apply pagination
    const {
        currentPage,
        totalPages,
        paginatedItems,
        setCurrentPage,
        totalItems,
        itemsPerPage,
    } = usePagination(filteredAndSorted, PROGRAMS_PER_PAGE);

    const handleProgramCreated = async () => {
        setShowNewProgram(false);
        await refetch();
    };

    // Show workspace error if it failed (non-blocking)
    if (workspaceError) {
        console.warn("Workspace error:", workspaceError);
    }

    return (
        <section className="builder-page">
            {/* Header with FAB button */}
            <ProgramsHeader onNewProgram={() => setShowNewProgram(true)} />

            {/* New Program Modal */}
            <Modal
                open={showNewProgram}
                onClose={() => setShowNewProgram(false)}
                title="Bæta hugmynd í bankann"
            >
                <NewProgramForm
                    workspaceId={userWorkspaceId || DEFAULT_WORKSPACE_ID}
                    onCreated={handleProgramCreated}
                />
            </Modal>

            {/* Main two-column layout */}
            <div className={styles.pageContainer}>
                {/* Left Sidebar - Filters */}
                <aside className={styles.sidebar}>
                    <div className={styles.searchSection}>
                        <ProgramSearch
                            value={query}
                            onChange={setQuery}
                            onSearch={() => { }}
                            resultCount={query.trim() || selectedTags.length > 0 ? filteredAndSorted.length : undefined}
                            placeholder="Leita að dagskrá"
                        />
                    </div>

                    <ProgramFilters
                        availableTags={availableTags || []}
                        selectedTags={selectedTags}
                        onTagsChange={setSelectedTags}
                        onClearAll={clearFilters}
                        isLoadingTags={tagsLoading}
                    />
                </aside>

                {/* Right Side - Main Content */}
                <main className={styles.mainContent}>
                    {/* Content Header - Result count and sort */}
                    <div className={styles.contentHeader}>
                        <div className={styles.resultCount}>
                            <span>
                                {filteredAndSorted.length === 1
                                    ? '1 dagskrá'
                                    : `${filteredAndSorted.length} dagskrár`}
                            </span>
                        </div>
                        <ProgramSort value={sortBy} onChange={setSortBy} />
                    </div>

                    {/* Program Grid */}
                    <ProgramGrid
                        isEmpty={filteredAndSorted.length === 0}
                        isLoading={programsLoading}
                        emptyMessage={
                            programsError
                                ? "Villa kom upp við að sækja dagskrár"
                                : query.trim() || selectedTags.length > 0
                                    ? "Engin dagskrá fannst við þessi leitarskilyrði"
                                    : "Engin dagskrá fannst"
                        }
                    >
                        {paginatedItems.map((p) => (
                            <ProgramCard
                                key={p.id}
                                id={p.id}
                                name={p.name}
                                image={p.image}
                                description={p.description}
                                tags={p.tags}
                            />
                        ))}
                    </ProgramGrid>

                    {/* Pagination */}
                    {filteredAndSorted.length > 0 && (
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
        </section>
    );
}