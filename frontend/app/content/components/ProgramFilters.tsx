"use client";

import { useState, useMemo } from "react";
import styles from "./ProgramFilters.module.css";

export interface FilterState {
  tags: string[];
  workspaceId: string | null;
  visibility: "all" | "public" | "private";
}

interface ProgramFiltersProps {
  availableTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  onClearAll?: () => void;
  workspaceOptions?: { id: string; name: string }[];
  selectedWorkspace?: string | null;
  onWorkspaceChange?: (workspaceId: string | null) => void;
  visibility?: "all" | "public" | "private";
  onVisibilityChange?: (visibility: "all" | "public" | "private") => void;
  isLoadingTags?: boolean;
}

export default function ProgramFilters({
  availableTags,
  selectedTags,
  onTagsChange,
  onClearAll,
  workspaceOptions = [],
  selectedWorkspace = null,
  onWorkspaceChange,
  visibility = "all",
  onVisibilityChange,
  isLoadingTags = false,
}: ProgramFiltersProps) {
  const [isTagsExpanded, setIsTagsExpanded] = useState(true);
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);
  const [isVisibilityExpanded, setIsVisibilityExpanded] = useState(false);

  // Sort tags: active tags first (in selection order), then inactive alphabetically
  const sortedTags = useMemo(() => {
    const activeTags = selectedTags.filter((tag) => availableTags.includes(tag));
    const inactiveTags = availableTags
      .filter((tag) => !selectedTags.includes(tag))
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    return [...activeTags, ...inactiveTags];
  }, [availableTags, selectedTags]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedTags.length > 0) count += selectedTags.length;
    if (selectedWorkspace) count += 1;
    if (visibility !== "all") count += 1;
    return count;
  }, [selectedTags, selectedWorkspace, visibility]);

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const handleSelectAllTags = () => {
    onTagsChange(availableTags);
  };

  const handleClearTags = () => {
    onTagsChange([]);
  };

  const handleClearAll = () => {
    onTagsChange([]);
    onWorkspaceChange?.(null);
    onVisibilityChange?.("all");
    onClearAll?.();
  };

  return (
    <aside className={styles.filters} aria-label="Síur">
      {/* Header with clear all */}
      <div className={styles.filterHeader}>
        <h2 className={styles.filterTitle}>Síur</h2>
        {activeFilterCount > 0 && (
          <button
            className={styles.clearAllButton}
            onClick={handleClearAll}
            aria-label={`Hreinsa allar síur (${activeFilterCount} virkar)`}
          >
            <span className={styles.filterBadge}>{activeFilterCount}</span>
            Hreinsa allt
          </button>
        )}
      </div>

      {/* Tags Filter */}
      <div className={styles.filterSection}>
        <button
          className={styles.filterSectionHeader}
          onClick={() => setIsTagsExpanded(!isTagsExpanded)}
          aria-expanded={isTagsExpanded}
          aria-controls="tags-filter-content"
        >
          <span className={styles.filterSectionTitle}>
            Flokkur
            {selectedTags.length > 0 && (
              <span className={styles.selectedCount}>({selectedTags.length})</span>
            )}
          </span>
          <svg
            className={`${styles.expandIcon} ${isTagsExpanded ? styles.expanded : ""}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isTagsExpanded && (
          <div id="tags-filter-content" className={styles.filterContent}>
            {/* Tag actions */}
            {availableTags.length > 0 && (
              <div className={styles.filterActions}>
                <button
                  className={styles.filterActionButton}
                  onClick={handleSelectAllTags}
                  disabled={selectedTags.length === availableTags.length}
                >
                  Velja allt
                </button>
                <button
                  className={styles.filterActionButton}
                  onClick={handleClearTags}
                  disabled={selectedTags.length === 0}
                >
                  Hreinsa
                </button>
              </div>
            )}

            {/* Interactive tag buttons */}
            <div className={styles.tagList} role="group" aria-label="Tag síur">
              {isLoadingTags ? (
                <p className={styles.loadingMessage}>Hleð flokkum...</p>
              ) : availableTags.length === 0 ? (
                <p className={styles.emptyMessage}>Enginn flokkur í boði</p>
              ) : (
                sortedTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      className={`${styles.tagButton} ${isSelected ? styles.tagButtonActive : ""}`}
                      onClick={() => handleTagToggle(tag)}
                      aria-label={`${isSelected ? "Afvirkja" : "Virkja"} síu: ${tag}`}
                      aria-pressed={isSelected}
                    >
                      {tag}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Workspace Filter (if available) */}
      {onWorkspaceChange && workspaceOptions.length > 0 && (
        <div className={styles.filterSection}>
          <button
            className={styles.filterSectionHeader}
            onClick={() => setIsWorkspaceExpanded(!isWorkspaceExpanded)}
            aria-expanded={isWorkspaceExpanded}
            aria-controls="workspace-filter-content"
          >
            <span className={styles.filterSectionTitle}>
              Vinnusvæði
              {selectedWorkspace && <span className={styles.selectedCount}>(1)</span>}
            </span>
            <svg
              className={`${styles.expandIcon} ${isWorkspaceExpanded ? styles.expanded : ""}`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isWorkspaceExpanded && (
            <div id="workspace-filter-content" className={styles.filterContent}>
              <select
                className={styles.filterSelect}
                value={selectedWorkspace || ""}
                onChange={(e) => onWorkspaceChange(e.target.value || null)}
                aria-label="Velja vinnusvæði"
              >
                <option value="">Öll vinnusvæði</option>
                {workspaceOptions.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Visibility Filter (if available) */}
      {onVisibilityChange && (
        <div className={styles.filterSection}>
          <button
            className={styles.filterSectionHeader}
            onClick={() => setIsVisibilityExpanded(!isVisibilityExpanded)}
            aria-expanded={isVisibilityExpanded}
            aria-controls="visibility-filter-content"
          >
            <span className={styles.filterSectionTitle}>
              Sýnileiki
              {visibility !== "all" && <span className={styles.selectedCount}>(1)</span>}
            </span>
            <svg
              className={`${styles.expandIcon} ${isVisibilityExpanded ? styles.expanded : ""}`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isVisibilityExpanded && (
            <div id="visibility-filter-content" className={styles.filterContent}>
              <div className={styles.radioList} role="radiogroup" aria-label="Sýnileiki síur">
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    className={styles.radio}
                    name="visibility"
                    value="all"
                    checked={visibility === "all"}
                    onChange={() => onVisibilityChange("all")}
                  />
                  <span className={styles.radioText}>Allt</span>
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    className={styles.radio}
                    name="visibility"
                    value="public"
                    checked={visibility === "public"}
                    onChange={() => onVisibilityChange("public")}
                  />
                  <span className={styles.radioText}>Opinbert</span>
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    className={styles.radio}
                    name="visibility"
                    value="private"
                    checked={visibility === "private"}
                    onChange={() => onVisibilityChange("private")}
                  />
                  <span className={styles.radioText}>Einka</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
