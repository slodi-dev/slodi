import ProgramSearch from "@/app/programs/components/ProgramSearch";
import ProgramFilters from "@/app/programs/components/ProgramFilters";
import ProgramSort, { type SortOption } from "@/app/programs/components/ProgramSort";
import styles from "./ProgramsToolbar.module.css";

interface ProgramsToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: string[];
  isLoadingTags: boolean;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  resultCount: number;
  onClearFilters: () => void;
}

export function ProgramsToolbar({
  query,
  onQueryChange,
  selectedTags,
  onTagsChange,
  availableTags,
  isLoadingTags,
  sortBy,
  onSortChange,
  resultCount,
  onClearFilters,
}: ProgramsToolbarProps) {
  return (
    <>
      <div className={styles.mainHeader}>
        <div className={styles.resultInfo}>
          <span>{resultCount === 1 ? "1 dagskrá" : `${resultCount} dagskrár`}</span>
        </div>
        <ProgramSort value={sortBy} onChange={onSortChange} />
      </div>

      <div className={styles.container}>
        <div className={styles.filtersWrapper}>
          <div className={styles.filterSection}>
            <ProgramSearch
              value={query}
              onChange={onQueryChange}
              onSearch={() => {}} // Search handled by filters
              resultCount={query.trim() || selectedTags.length > 0 ? resultCount : undefined}
              placeholder="Leita að dagskrá"
            />
          </div>

          <ProgramFilters
            availableTags={availableTags}
            selectedTags={selectedTags}
            onTagsChange={onTagsChange}
            onClearAll={onClearFilters}
            isLoadingTags={isLoadingTags}
          />
        </div>
      </div>
    </>
  );
}
