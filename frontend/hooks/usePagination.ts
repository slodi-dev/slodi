import { useState, useMemo, useEffect } from "react";

/**
 * usePagination
 * React hook for paginating an array of items.
 * @param items - Array of items to paginate
 * @param itemsPerPage - Number of items per page (default: 12)
 * @returns Object containing pagination state, paginated items, and helpers
 */
export function usePagination<T>(items: T[], itemsPerPage: number = 12) {
  // State for the current page number
  const [currentPage, setCurrentPage] = useState(1);

  // Calculate total number of pages
  const totalPages = Math.ceil(items.length / itemsPerPage);

  /**
   * Memoized computation of paginated items for the current page
   * Slices the items array to only include items for the current page
   */
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, itemsPerPage]);

  /**
   * Reset to page 1 whenever the items array changes length
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  /**
   * Scroll to top of the page (header) when the current page changes
   */
  useEffect(() => {
    const headerElement = document.querySelector("header");
    if (headerElement) {
      headerElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [currentPage]);

  // Return pagination state, paginated items, and helpers
  return {
    currentPage, // Current page number
    totalPages, // Total number of pages
    paginatedItems, // Items for the current page
    setCurrentPage, // Setter for current page
    totalItems: items.length, // Total number of items
    itemsPerPage, // Number of items per page
  };
}
