"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  adminDeleteUser,
  adminUpdateUser,
  listUsers,
  type User,
  type UserPermissions,
} from "@/services/users.service";
import styles from "./UserManagement.module.css";

const PERMISSIONS: UserPermissions[] = ["viewer", "member", "admin"];
const PERMISSION_LABELS: Record<UserPermissions, string> = {
  viewer: "Skoðandi",
  member: "Meðlimur",
  admin: "Stjórnandi",
};

const PAGE_SIZE = 20;

export default function UserManagement() {
  const { user: currentUser, getToken, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, boolean>>({});
  const [pendingDeletes, setPendingDeletes] = useState<Record<string, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 400);
  };

  const fetchUsers = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listUsers(token, {
        q: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setUsers(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gat ekki sótt notendur");
    } finally {
      setLoading(false);
    }
  }, [getToken, debouncedSearch, page]);

  useEffect(() => {
    if (!authLoading) fetchUsers();
  }, [fetchUsers, authLoading]);

  const handlePermissionChange = async (
    userId: string,
    permissions: UserPermissions
  ) => {
    const token = await getToken();
    if (!token) return;
    setPendingUpdates((prev) => ({ ...prev, [userId]: true }));
    try {
      const updated = await adminUpdateUser(token, userId, { permissions });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, permissions: updated.permissions } : u))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gat ekki uppfært réttindi");
    } finally {
      setPendingUpdates((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleDeleteConfirm = async (userId: string) => {
    const token = await getToken();
    if (!token) return;
    setPendingDeletes((prev) => ({ ...prev, [userId]: true }));
    setDeleteConfirm(null);
    try {
      await adminDeleteUser(token, userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setTotal((prev) => prev - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gat ekki eytt notanda");
    } finally {
      setPendingDeletes((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (!authLoading && currentUser?.permissions !== "admin") {
    return (
      <div className={styles.accessDenied}>
        <p>Þú hefur ekki aðgang að þessari síðu.</p>
      </div>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Leita að notanda…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          aria-label="Leita að notanda"
        />
        <span className={styles.totalCount}>
          {total} {total === 1 ? "notandi" : "notendur"}
        </span>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Nafn</th>
              <th className={styles.th}>Netfang</th>
              <th className={styles.th}>Réttindi</th>
              <th className={styles.th}>Aðgerðir</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className={styles.centeredCell}>
                  Hleð…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.centeredCell}>
                  Engir notendur fundust.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  className={`${styles.row} ${u.id === currentUser?.id ? styles.selfRow : ""}`}
                >
                  <td className={styles.td}>
                    <span className={styles.name}>{u.name}</span>
                    {u.id === currentUser?.id && (
                      <span className={styles.selfBadge}>þú</span>
                    )}
                  </td>
                  <td className={styles.td}>{u.email}</td>
                  <td className={styles.td}>
                    <select
                      className={styles.permSelect}
                      value={u.permissions}
                      disabled={pendingUpdates[u.id] || u.id === currentUser?.id}
                      onChange={(e) =>
                        handlePermissionChange(u.id, e.target.value as UserPermissions)
                      }
                      aria-label={`Réttindi ${u.name}`}
                    >
                      {PERMISSIONS.map((p) => (
                        <option key={p} value={p}>
                          {PERMISSION_LABELS[p]}
                        </option>
                      ))}
                    </select>
                    {pendingUpdates[u.id] && (
                      <span className={styles.saving}>…</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    {u.id !== currentUser?.id &&
                      (deleteConfirm === u.id ? (
                        <span className={styles.deleteConfirmRow}>
                          <span className={styles.deleteConfirmText}>Ertu viss?</span>
                          <button
                            className={styles.confirmBtn}
                            onClick={() => handleDeleteConfirm(u.id)}
                            disabled={pendingDeletes[u.id]}
                          >
                            Já, eyða
                          </button>
                          <button
                            className={styles.cancelBtn}
                            onClick={() => setDeleteConfirm(null)}
                          >
                            Hætta við
                          </button>
                        </span>
                      ) : (
                        <button
                          className={styles.deleteBtn}
                          onClick={() => setDeleteConfirm(u.id)}
                          disabled={pendingDeletes[u.id]}
                          aria-label={`Eyða ${u.name}`}
                        >
                          Eyða
                        </button>
                      ))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
          >
            ← Fyrri
          </button>
          <span className={styles.pageInfo}>
            Síða {page + 1} af {totalPages}
          </span>
          <button
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || loading}
          >
            Næsta →
          </button>
        </div>
      )}
    </section>
  );
}
