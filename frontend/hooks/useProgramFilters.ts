// React hook for filtering and sorting a list of programs
import { useState, useMemo } from "react";
import type { Program } from "@/services/programs.service";
import {
  filterProgramsByQuery,
  filterProgramsByTags,
  sortPrograms,
} from "@/services/programs.service";
import type { SortOption } from "@/app/programs/components/ProgramSort";

/**
 * useProgramFilters
 * Provides state and logic for filtering and sorting a list of programs.
 * @param programs - Array of Program objects to filter and sort
 * @returns Object containing filter/sort state, setters, filtered/sorted data, and a clear helper
 */
export function useProgramFilters(programs: Program[]) {
  // State for the search query string
  const [query, setQuery] = useState("");

  // State for the selected tags (used for tag-based filtering)
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // State for the selected sort option (e.g., 'newest', 'oldest', etc.)
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  /**
   * Memoized computation of filtered and sorted programs.
   * Runs whenever programs, query, selectedTags, or sortBy changes.
   * 1. Filters programs by selected tags
   * 2. Filters the result by search query
   * 3. Sorts the final filtered list by the selected sort option
   */
  const filteredAndSorted = useMemo(() => {
    // Step 1: Filter by tags
    let filtered = filterProgramsByTags(programs, selectedTags);
    // Step 2: Filter by search query
    filtered = filterProgramsByQuery(filtered, query);
    // Step 3: Sort the filtered list
    return sortPrograms(filtered, sortBy);
  }, [programs, query, selectedTags, sortBy]);

  /**
   * Helper function to clear all filters (tags and query)
   * Resets selectedTags and query to their initial states
   */
  const clearFilters = () => {
    setSelectedTags([]); // Remove all selected tags
    setQuery(""); // Clear the search query
  };

  // Return all state, setters, computed data, and helpers for use in components
  return {
    query, // Current search query string
    setQuery, // Setter for search query
    selectedTags, // Array of currently selected tags
    setSelectedTags, // Setter for selected tags
    sortBy, // Current sort option
    setSortBy, // Setter for sort option
    filteredAndSorted, // The filtered and sorted array of programs
    clearFilters, // Helper to clear all filters
  };
}
