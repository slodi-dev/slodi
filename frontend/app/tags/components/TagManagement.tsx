"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTags } from "@/hooks/useTags";
import { updateTag, deleteTag } from "@/services/tags.service";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { useDefaultWorkspaceId } from "@/hooks/useDefaultWorkspaceId";
import { hasWorkspaceRole } from "@/services/workspaces.service";
import usePrograms from "@/hooks/usePrograms";
import TagCreateInput from "./TagCreateInput";
import TagRow from "./TagRow";
import styles from "./TagManagement.module.css";

const PAGE_SIZE = 20;

export default function TagManagement() {
  const defaultWorkspaceId = useDefaultWorkspaceId();
  const { role, isLoading: roleLoading } = useWorkspaceRole(defaultWorkspaceId);
  const { tags, loading, error, refetch } = useTags();
  const { programs } = usePrograms(defaultWorkspaceId);

  // Count how many programs use each tag
  const tagUsageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (programs) {
      for (const program of programs) {
        for (const tag of program.tags || []) {
          counts[tag.id] = (counts[tag.id] || 0) + 1;
        }
      }
    }
    return counts;
  }, [programs]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 300);
  };

  // Client-side filtering
  const filteredTags = useMemo(() => {
    if (!tags) return [];
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((tag) => tag.name.toLowerCase().includes(q));
  }, [tags, debouncedSearch]);

  // Pagination
  const totalPages = Math.ceil(filteredTags.length / PAGE_SIZE);
  const paginatedTags = useMemo(
    () => filteredTags.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredTags, page]
  );

  const handleCreated = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleSave = useCallback(
    async (tagId: string, newName: string) => {
      await updateTag(tagId, newName);
      setEditingId(null);
      await refetch();
    },
    [refetch]
  );

  const handleDelete = useCallback(
    async (tagId: string) => {
      await deleteTag(tagId);
      setDeletingId(null);
      await refetch();
    },
    [refetch]
  );

  // Access control
  if (roleLoading) {
    return (
      <section className={styles.section}>
        <p className={styles.loading}>Hleð...</p>
      </section>
    );
  }

  if (!hasWorkspaceRole(role, "editor")) {
    return (
      <section className={styles.section}>
        <div className={styles.accessDenied}>
          <p>Þú hefur ekki aðgang að þessari síðu.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <h1 className={styles.heading}>Flokkar</h1>

      <TagCreateInput onCreated={handleCreated} />

      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Leita að flokkum..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          aria-label="Leita að flokkum"
        />
        <span className={styles.totalCount} aria-live="polite">
          {filteredTags.length} {filteredTags.length === 1 ? "flokkur" : "flokkar"}
        </span>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error.message}
        </p>
      )}

      {loading ? (
        <p className={styles.loading}>Hleð flokkum...</p>
      ) : filteredTags.length === 0 ? (
        <div className={styles.emptyState}>
          <p>
            {debouncedSearch.trim()
              ? "Engir flokkar fundust."
              : "Engir flokkar fundust. Búðu til fyrsta flokkinn!"}
          </p>
        </div>
      ) : (
        <>
          <ul className={styles.tagList} role="list">
            {paginatedTags.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                isEditing={editingId === tag.id}
                isDeleting={deletingId === tag.id}
                contentCount={tagUsageCounts[tag.id] ?? 0}
                onEdit={() => {
                  setDeletingId(null);
                  setEditingId(tag.id);
                }}
                onRequestDelete={() => {
                  setEditingId(null);
                  setDeletingId(tag.id);
                }}
                onSave={(newName) => handleSave(tag.id, newName)}
                onDelete={() => handleDelete(tag.id)}
                onCancel={() => {
                  setEditingId(null);
                  setDeletingId(null);
                }}
              />
            ))}
          </ul>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                &#8592; Fyrri
              </button>
              <span className={styles.pageInfo}>
                Síða {page + 1} af {totalPages}
              </span>
              <button
                className={styles.pageBtn}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Næsta &#8594;
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
