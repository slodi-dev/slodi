"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDefaultWorkspaceId } from "@/hooks/useDefaultWorkspaceId";
import { countIs } from "@/lib/format";
import { cn } from "@/lib/util";
import type { User, UserPermissions } from "@/services/users.service";
import type { WorkspaceRole } from "@/services/workspaces.service";
import ConfirmDialog, { type ConfirmRequest } from "./ConfirmDialog";
import UndoToast, { type Toast } from "./UndoToast";
import UserDetail from "./UserDetail";
import UserSplit from "./UserSplit";
import { NoMatch, NoUsers, UserListError, UserListSkeleton } from "./UserStates";
import { useUserDirectory } from "./useUserDirectory";
import { useUserListUrl, useWriteUserListUrl } from "./useUserListUrl";
import {
  BANK_ROLE_LABEL_LOWER,
  bankRoleNeedsConfirm,
  countByPermission,
  filterUsers,
  isLocked,
  PERMISSION_FILTERS,
  PERMISSION_LABEL_LOWER,
  PERMISSION_PLURAL,
  permissionNeedsConfirm,
  searchUsers,
  userErrorMessage,
} from "./userRules";
import styles from "./UserManagement.module.css";

const PAGE_SIZE = 20;

type ConfirmInput = Omit<ConfirmRequest, "settle">;

/**
 * Platform admins' list of users: search, a permission filter, and one person's
 * permission, bank role and delete in a panel beside the list (a page of its
 * own on a phone). Everything shown is in the API today; see sc-640 for what
 * is still to come.
 */
export default function UserManagement() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const isAdmin = currentUser?.permissions === "admin";
  const bankWorkspaceId = useDefaultWorkspaceId();
  const directory = useUserDirectory(!authLoading && isAdmin, bankWorkspaceId);
  const url = useUserListUrl();
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matching = useMemo(
    () => searchUsers(directory.users, url.query),
    [directory.users, url.query]
  );
  const counts = useMemo(() => countByPermission(matching), [matching]);
  const filtered = useMemo(() => filterUsers(matching, url.permission), [matching, url.permission]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(url.page, pageCount);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = directory.users.find((u) => u.id === url.selectedId) ?? null;
  const ready = directory.status === "ready";

  // A link to a user opens the page of the list they are on, once the list has loaded.
  const openedOnSelection = useRef(false);
  useEffect(() => {
    if (!ready || openedOnSelection.current) return;
    openedOnSelection.current = true;
    const index = filtered.findIndex((u) => u.id === url.selectedId);
    if (index >= 0) url.setPage(Math.floor(index / PAGE_SIZE) + 1);
  }, [ready, filtered, url]);

  useWriteUserListUrl(
    url.writeUrl,
    { query: url.query, permission: url.permission, page, selectedId: selected?.id ?? null },
    ready
  );

  const announce = useCallback((message: string, undo?: () => void) => {
    setToast({ key: Date.now(), message, undo });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  /** Opens the confirm dialog, which runs the change; resolves true once it's done. */
  const askConfirm = (request: ConfirmInput) =>
    new Promise<boolean>((resolve) => setConfirm({ ...request, settle: resolve }));

  const savePermission = async (
    user: User,
    to: UserPermissions,
    saving: () => void
  ): Promise<boolean> => {
    const from = user.permissions;
    const run = async () => {
      await directory.setPermission(user.id, to);
      announce(`${user.name} er nú ${PERMISSION_LABEL_LOWER[to]}.`, async () => {
        try {
          await directory.setPermission(user.id, from);
          announce("Afturkallað.");
        } catch (err) {
          announce(userErrorMessage(err, "permission"));
        }
      });
    };
    if (!permissionNeedsConfirm(from, to)) {
      saving();
      await run();
      return true;
    }
    return askConfirm({
      title: "Gera að umsjónarmanni dagskrár?",
      body: (
        <>
          <p>{`${user.name} verður ${PERMISSION_LABEL_LOWER[to]}.`}</p>
          <p>Umsjónarmenn dagskrár geta falið og hafnað hvaða efni sem er í dagskrárbankanum.</p>
        </>
      ),
      confirmLabel: "Gera að umsjónarmanni",
      busyLabel: "Vista…",
      tone: "primary",
      action: "permission",
      run,
    });
  };

  const saveBankRole = async (
    user: User,
    to: WorkspaceRole,
    saving: () => void
  ): Promise<boolean> => {
    const from = directory.bankRoles?.[user.id] ?? null;
    const run = async () => {
      await directory.setBankRole(user.id, to);
      const message = `${user.name} er nú ${BANK_ROLE_LABEL_LOWER[to]} í dagskrárbankanum.`;
      // Someone who had no role can't be put back to none: the API has no way to remove it.
      const undo =
        from === null
          ? undefined
          : async () => {
              try {
                await directory.setBankRole(user.id, from);
                announce("Afturkallað.");
              } catch (err) {
                announce(userErrorMessage(err, "bankRole"));
              }
            };
      announce(message, undo);
    };
    if (!bankRoleNeedsConfirm(from, to)) {
      saving();
      await run();
      return true;
    }
    return askConfirm({
      title: "Gera að stjórnanda dagskrárbankans?",
      body: (
        <>
          <p>{`${user.name} verður stjórnandi í dagskrárbankanum.`}</p>
          <p>Stjórnendur bankans geta breytt öllu efni í honum og réttindum annarra þar.</p>
        </>
      ),
      confirmLabel: "Gera að stjórnanda",
      busyLabel: "Vista…",
      tone: "primary",
      action: "bankRole",
      run,
    });
  };

  const requestDelete = (user: User) => {
    void askConfirm({
      title: "Eyða notanda?",
      body: (
        <>
          <p>
            <strong>{user.name}</strong> ({user.email}) verður eytt úr Slóða.
          </p>
          <p>Ekki er hægt að afturkalla þetta.</p>
        </>
      ),
      confirmLabel: "Eyða notanda",
      busyLabel: "Eyði…",
      tone: "danger",
      action: "delete",
      run: async () => {
        await directory.deleteUser(user.id);
        url.setSelectedId(null);
        announce(`Notanda eytt: ${user.name}.`);
        // The panel that opened the dialog is gone; focus goes back to the list.
        requestAnimationFrame(() =>
          listRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
        );
      },
    });
  };

  if (!authLoading && !isAdmin) {
    return (
      <div className={styles.stateBox}>
        <p className={styles.stateText}>Þú hefur ekki aðgang að þessari síðu.</p>
      </div>
    );
  }

  let body;
  if (authLoading || directory.status === "loading") body = <UserListSkeleton />;
  else if (directory.status === "error")
    body = (
      <UserListError
        message={userErrorMessage(directory.error, "load")}
        onRetry={directory.retry}
      />
    );
  else if (directory.users.length === 0) body = <NoUsers />;
  else if (filtered.length === 0) body = <NoMatch query={url.query} onReset={url.resetFilters} />;
  else
    body = (
      <UserSplit
        ref={listRef}
        visible={visible}
        selected={selected}
        selectedId={selected?.id ?? null}
        currentUserId={currentUser?.id}
        onSelect={url.setSelectedId}
        renderDetail={(user, panel) => (
          <UserDetail
            key={user.id}
            user={user}
            isSelf={user.id === currentUser?.id}
            locked={isLocked(user, currentUser?.id)}
            bankRole={directory.bankRoles ? (directory.bankRoles[user.id] ?? null) : undefined}
            onBack={panel.onBack}
            focusOnMount={panel.focusOnMount}
            onSavePermission={savePermission}
            onSaveBankRole={saveBankRole}
            onDelete={requestDelete}
          />
        )}
      />
    );

  return (
    <div className={styles.root} aria-busy={directory.status === "loading"}>
      <Toolbar
        query={url.query}
        onQuery={url.setQuery}
        permission={url.permission}
        onPermission={url.setPermission}
        counts={ready ? counts : null}
      />
      <p className={styles.summary} role="status">
        {ready && directory.users.length > 0
          ? filtered.length === directory.users.length
            ? countIs(directory.users.length, "notandi", "notendur")
            : `${countIs(filtered.length, "notandi", "notendur")} af ${directory.users.length}`
          : ""}
      </p>
      {body}
      {ready && filtered.length > 0 && pageCount > 1 && (
        <Pager page={page} pageCount={pageCount} onPage={url.setPage} />
      )}
      <UndoToast toast={toast} onDismiss={dismissToast} />
      <ConfirmDialog request={confirm} onClosed={() => setConfirm(null)} />
    </div>
  );
}

function Toolbar({
  query,
  onQuery,
  permission,
  onPermission,
  counts,
}: {
  query: string;
  onQuery: (q: string) => void;
  permission: (typeof PERMISSION_FILTERS)[number];
  onPermission: (p: (typeof PERMISSION_FILTERS)[number]) => void;
  /** Null until the list has loaded. */
  counts: ReturnType<typeof countByPermission> | null;
}) {
  const id = useId();
  return (
    <div className={styles.toolbar}>
      <div className={styles.search}>
        <label htmlFor={`${id}-q`} className={styles.srOnly}>
          Leita að notanda
        </label>
        <Search className={styles.searchIcon} aria-hidden="true" />
        <input
          id={`${id}-q`}
          type="search"
          className={styles.searchInput}
          placeholder="Leita eftir nafni eða netfangi"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className={styles.chips} role="group" aria-label="Sía eftir réttindum">
        {PERMISSION_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={styles.chip}
            aria-pressed={permission === f}
            onClick={() => onPermission(f)}
          >
            {f === "all" ? "Öll" : PERMISSION_PLURAL[f]}
            {counts && <span className={styles.chipCount}>{counts[f]}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Pager({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className={styles.pager} role="group" aria-label="Síður">
      <button
        type="button"
        className={cn(styles.button, styles.buttonSecondary)}
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Fyrri
      </button>
      <span className={styles.pageInfo}>
        Síða {page} af {pageCount}
      </span>
      <button
        type="button"
        className={cn(styles.button, styles.buttonSecondary)}
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        Næsta
      </button>
    </div>
  );
}
