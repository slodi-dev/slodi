import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent, ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Lock,
  Search,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import { countIs, formatIcelandicDate } from "@/lib/format";
import type { User, UserPermissions } from "@/services/users.service";
import styles from "./UserManagementLab.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type UserManagementLook = "tafla" | "spjold" | "skipt" | "val";
export type LabLoadState = "ready" | "loading" | "error";
export type PermissionFilter = UserPermissions | "all";

export interface LabHistoryEntry {
  /** ISO timestamp. */
  at: string;
  text: string;
  /** Who made the change, when someone did. */
  by?: string;
}

/** The API `User`, plus what a user-management screen needs and the API doesn't have yet. */
export interface LabUser extends Pick<User, "id" | "name" | "email" | "permissions"> {
  status: "active" | "suspended";
  /** Set while suspended. `since` is an ISO timestamp. */
  suspension?: { since: string; reason?: string };
  joinedAt: string;
  lastSeenAt: string | null;
  /** Newest last. */
  history: LabHistoryEntry[];
}

export interface UserManagementLabProps {
  /** Which lab variation to render. */
  look: UserManagementLook;
  users: LabUser[];
  /** The signed-in admin. Their own row can't be changed. */
  currentUserId?: string;
  state?: LabLoadState;
  /** Raw error detail, shown as small print under the message. */
  errorDetail?: string;
  onRetry?: () => void;
  defaultQuery?: string;
  defaultPermission?: PermissionFilter;
  /** `skipt` only: the user open in the detail panel. */
  defaultSelectedId?: string;
  pageSize?: number;
  /** Lab only: ids the fake API refuses on the first try, to show a partial failure. */
  failIds?: string[];
  /** Lab only: how long the fake API takes, in ms, for C and D. */
  latencyMs?: number;
  /** Lab only, `skipt`: render just the detail panel of `defaultSelectedId`. */
  panelOnly?: boolean;
  /**
   * Called with the query string the real page would write with `router.replace`
   * (UX rule 10): `?q=…&rettindi=…&sida=…&notandi=…`.
   */
  onUrlChange?: (search: string) => void;
}

/* ── Copy ──────────────────────────────────────────────────────────────────── */

const RANK: Record<UserPermissions, number> = { viewer: 0, member: 1, moderator: 2, admin: 3 };

/** Admin comes only from ADMIN_EMAILS; the API refuses to grant or remove it (sc-535). */
const GRANTABLE: UserPermissions[] = ["viewer", "member", "moderator"];

const LABEL: Record<UserPermissions, string> = {
  viewer: "Skoðandi",
  member: "Meðlimur",
  moderator: "Umsjónarmaður dagskrár",
  admin: "Stjórnandi",
};
const LABEL_LOWER: Record<UserPermissions, string> = {
  viewer: "skoðandi",
  member: "meðlimur",
  moderator: "umsjónarmaður dagskrár",
  admin: "stjórnandi",
};
const PLURAL: Record<UserPermissions, string> = {
  viewer: "Skoðendur",
  member: "Meðlimir",
  moderator: "Umsjónarmenn dagskrár",
  admin: "Stjórnendur",
};
const DESCRIPTION: Record<UserPermissions, string> = {
  viewer: "Getur skoðað dagskrárbankann.",
  member: "Getur sett inn og breytt eigin efni.",
  moderator: "Getur falið og hafnað hvaða efni sem er í bankanum.",
  admin: "Hefur fullan aðgang að notendum og stillingum.",
};
const PROMOTE_WARNING =
  "Umsjónarmenn dagskrár geta falið og hafnað hvaða efni sem er í dagskrárbankanum.";
const FILTERS: PermissionFilter[] = ["all", "viewer", "member", "moderator", "admin"];

/** UX rule 5: reversible actions offer "Afturkalla" for at least 8 seconds. */
const TOAST_MS = 10_000;

/* ── Helpers ───────────────────────────────────────────────────────────────── */

const IS_ALPHABET = "aábcdðeéfghiíjklmnoópqrstuúvwxyýzþæö";

/**
 * Icelandic alphabetical order (á after a, ð after d, þ æ ö last). Written out because
 * `localeCompare("is")` depends on locale data Chrome doesn't ship.
 */
function compareIs(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] === y[i]) continue;
    const ix = IS_ALPHABET.indexOf(x[i]);
    const iy = IS_ALPHABET.indexOf(y[i]);
    if (ix === -1 || iy === -1) return x.charCodeAt(i) - y.charCodeAt(i);
    return ix - iy;
  }
  return x.length - y.length;
}

/** "jon" finds "Jón". ð, þ and æ are letters of their own and stay as they are. */
function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")
  ).toUpperCase();
}

function lastSeen(u: LabUser): string {
  return u.lastSeenAt ? formatIcelandicDate(u.lastSeenAt) : "Aldrei";
}

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/* ── State shared by every look ────────────────────────────────────────────── */

type SortKey = "name" | "email" | "permissions" | "lastSeen";
type SortDir = "asc" | "desc";

interface ConfirmRequest {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  tone: "primary" | "danger";
  onConfirm: () => void;
  onCancel?: () => void;
}

/** What a batch call to the (fake) API did: who changed, and who it refused. */
export interface BatchResult {
  done: LabUser[];
  failed: LabUser[];
}

interface Toast {
  key: number;
  message: string;
  undo?: () => void;
}

function useUserManagement(props: UserManagementLabProps) {
  const { currentUserId, pageSize = 10, onUrlChange, latencyMs = 400 } = props;
  const failIds = props.failIds;
  const [users, setUsers] = useState(props.users);
  const [query, setQuery] = useState(props.defaultQuery ?? "");
  const [permission, setPermission] = useState<PermissionFilter>(props.defaultPermission ?? "all");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });
  const [selectedId, setSelectedId] = useState<string | null>(props.defaultSelectedId ?? null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  /** Ids the fake API has already refused once; a retry goes through. */
  const refused = useRef(new Set<string>());

  const matching = useMemo(() => {
    const q = fold(query.trim());
    return q ? users.filter((u) => fold(`${u.name} ${u.email}`).includes(q)) : users;
  }, [users, query]);

  const counts = useMemo(() => {
    const c: Record<PermissionFilter, number> = {
      all: matching.length,
      viewer: 0,
      member: 0,
      moderator: 0,
      admin: 0,
    };
    for (const u of matching) c[u.permissions] += 1;
    return c;
  }, [matching]);

  const filtered = useMemo(() => {
    const list =
      permission === "all" ? matching : matching.filter((u) => u.permissions === permission);
    const sign = sort.dir === "asc" ? 1 : -1;
    const by: Record<SortKey, (a: LabUser, b: LabUser) => number> = {
      name: (a, b) => compareIs(a.name, b.name),
      email: (a, b) => compareIs(a.email, b.email),
      permissions: (a, b) => RANK[a.permissions] - RANK[b.permissions] || compareIs(a.name, b.name),
      lastSeen: (a, b) => (a.lastSeenAt ?? "").localeCompare(b.lastSeenAt ?? ""),
    };
    return [...list].sort((a, b) => sign * by[sort.key](a, b));
  }, [matching, permission, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  useEffect(() => {
    if (!onUrlChange) return;
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    if (permission !== "all") p.set("rettindi", permission);
    if (safePage > 0) p.set("sida", String(safePage + 1));
    if (selectedId) p.set("notandi", selectedId);
    const s = p.toString();
    onUrlChange(s ? `?${s}` : "");
  }, [onUrlChange, query, permission, safePage, selectedId]);

  /** Self and platform admins can't be changed from here, so they're never targets. */
  const isLocked = (u: LabUser) => u.id === currentUserId || u.permissions === "admin";

  const commit = (ids: Set<string>, change: (u: LabUser) => LabUser, message: string) => {
    const before = users;
    setUsers((prev) => prev.map((u) => (ids.has(u.id) ? change(u) : u)));
    setToast({
      key: Date.now(),
      message,
      undo: () => {
        setUsers(before);
        setToast({ key: Date.now(), message: "Afturkallað." });
      },
    });
  };

  const nothingChanged = () => setToast({ key: Date.now(), message: "Engin breyting." });

  const changeRole = (ids: string[], to: UserPermissions) => {
    const targets = users.filter((u) => ids.includes(u.id) && !isLocked(u) && u.permissions !== to);
    if (targets.length === 0) return nothingChanged();
    const at = new Date().toISOString();
    const apply = () =>
      commit(
        new Set(targets.map((u) => u.id)),
        (u) => ({
          ...u,
          permissions: to,
          history: [...u.history, { at, text: `Réttindi: ${LABEL[u.permissions]} → ${LABEL[to]}` }],
        }),
        targets.length === 1
          ? `${targets[0].name} er nú ${LABEL_LOWER[to]}.`
          : `Réttindum breytt hjá ${countIs(targets.length, "notanda", "notendum")}.`
      );

    const promotes =
      RANK[to] >= RANK.moderator && targets.some((u) => RANK[u.permissions] < RANK[to]);
    if (targets.length === 1 && !promotes) return apply();

    // UX rule 5: promoting to moderator always confirms; a change to many confirms with a count.
    setConfirm({
      title:
        targets.length === 1
          ? "Gera að umsjónarmanni dagskrár?"
          : `Breyta réttindum hjá ${countIs(targets.length, "notanda", "notendum")}?`,
      body: (
        <>
          <p>
            {targets.length === 1
              ? `${targets[0].name} verður ${LABEL_LOWER[to]}.`
              : `Ný réttindi: ${LABEL[to]}.`}
          </p>
          {promotes && <p>{PROMOTE_WARNING}</p>}
          {targets.length > 1 && <NameList users={targets} />}
        </>
      ),
      confirmLabel:
        targets.length === 1
          ? "Gera að umsjónarmanni"
          : `Breyta hjá ${countIs(targets.length, "notanda", "notendum")}`,
      tone: "primary",
      onConfirm: apply,
    });
  };

  const setSuspended = (ids: string[], suspend: boolean) => {
    const wanted = suspend ? "active" : "suspended";
    const targets = users.filter((u) => ids.includes(u.id) && !isLocked(u) && u.status === wanted);
    if (targets.length === 0) return nothingChanged();
    const at = new Date().toISOString();
    const verb = suspend ? "frystur" : "virkjaður aftur";
    const apply = () =>
      commit(
        new Set(targets.map((u) => u.id)),
        (u) => ({
          ...u,
          status: suspend ? "suspended" : "active",
          history: [...u.history, { at, text: `Aðgangur ${verb}` }],
        }),
        targets.length === 1
          ? `Aðgangur ${verb}: ${targets[0].name}.`
          : `Aðgangur ${verb} hjá ${countIs(targets.length, "notanda", "notendum")}.`
      );
    // One user: reversible, so it happens at once with "Afturkalla". Many: confirm with a count.
    if (targets.length === 1) return apply();
    const n = countIs(targets.length, "notanda", "notendum");
    setConfirm({
      title: suspend ? `Frysta aðgang hjá ${n}?` : `Virkja aðgang aftur hjá ${n}?`,
      body: (
        <>
          <p>
            {suspend
              ? "Þau komast ekki inn í Slóða fyrr en aðgangurinn er virkjaður aftur. Efnið þeirra helst óbreytt."
              : "Þau komast strax inn aftur með sömu réttindi og áður."}
          </p>
          <NameList users={targets} />
        </>
      ),
      confirmLabel: suspend ? "Frysta aðgang" : "Virkja aftur",
      tone: suspend ? "danger" : "primary",
      onConfirm: apply,
    });
  };

  /* ── Async versions for C and D: a fake API call, partial failure, undo per batch ── */

  /** Opens the confirm dialog and resolves with the answer. */
  const askConfirm = (request: Omit<ConfirmRequest, "onConfirm" | "onCancel">) =>
    new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (answer: boolean) => {
        if (settled) return;
        settled = true;
        resolve(answer);
      };
      setConfirm({ ...request, onConfirm: () => settle(true), onCancel: () => settle(false) });
    });

  /**
   * Sends one batch. Whoever the API accepts changes at once, and the toast's "Afturkalla"
   * puts every one of them back as they were. Whoever it refuses comes back in `failed`.
   */
  const runBatch = async (
    targets: LabUser[],
    change: (u: LabUser) => LabUser,
    describe: (done: LabUser[]) => string
  ): Promise<BatchResult> => {
    await new Promise((r) => setTimeout(r, latencyMs));
    const failed = targets.filter((u) => failIds?.includes(u.id) && !refused.current.has(u.id));
    for (const u of failed) refused.current.add(u.id);
    const done = targets.filter((u) => !failed.includes(u));
    if (done.length === 0) return { done, failed };

    const before = new Map(done.map((u) => [u.id, u]));
    setUsers((prev) => prev.map((u) => (before.has(u.id) ? change(u) : u)));
    const failNote = failed.length
      ? ` Ekki tókst hjá ${countIs(failed.length, "notanda", "notendum")}.`
      : "";
    setToast({
      key: Date.now(),
      message: describe(done) + failNote,
      undo: () => {
        setUsers((prev) => prev.map((u) => before.get(u.id) ?? u));
        setToast({
          key: Date.now(),
          message:
            done.length === 1
              ? "Afturkallað."
              : `Afturkallað hjá ${countIs(done.length, "notanda", "notendum")}.`,
        });
      },
    });
    return { done, failed };
  };

  const changeRoleBatch = async (
    ids: string[],
    to: UserPermissions,
    options: { confirmed?: boolean; onStart?: () => void } = {}
  ): Promise<BatchResult | null> => {
    const targets = users.filter((u) => ids.includes(u.id) && !isLocked(u) && u.permissions !== to);
    if (targets.length === 0) {
      nothingChanged();
      return null;
    }
    const promotes =
      RANK[to] >= RANK.moderator && targets.some((u) => RANK[u.permissions] < RANK[to]);
    // UX rule 5: promoting to moderator always confirms; a change to many confirms with a count.
    if (!options.confirmed && (targets.length > 1 || promotes)) {
      const n = countIs(targets.length, "notanda", "notendum");
      const ok = await askConfirm({
        title:
          targets.length === 1 ? "Gera að umsjónarmanni dagskrár?" : `Breyta réttindum hjá ${n}?`,
        body: (
          <>
            <p>
              {targets.length === 1
                ? `${targets[0].name} verður ${LABEL_LOWER[to]}.`
                : `Ný réttindi: ${LABEL[to]}.`}
            </p>
            {promotes && <p>{PROMOTE_WARNING}</p>}
            {targets.length > 1 && <NameList users={targets} />}
          </>
        ),
        confirmLabel: targets.length === 1 ? "Gera að umsjónarmanni" : `Breyta hjá ${n}`,
        tone: "primary",
      });
      if (!ok) return null;
    }
    options.onStart?.();
    const at = new Date().toISOString();
    return runBatch(
      targets,
      (u) => ({
        ...u,
        permissions: to,
        history: [
          ...u.history,
          { at, text: `Réttindi: ${LABEL[u.permissions]} → ${LABEL[to]}`, by: "Þú" },
        ],
      }),
      (done) =>
        done.length === 1
          ? `${done[0].name} er nú ${LABEL_LOWER[to]}.`
          : `Réttindum breytt hjá ${countIs(done.length, "notanda", "notendum")}.`
    );
  };

  const suspendBatch = async (
    ids: string[],
    suspend: boolean,
    options: { reason?: string; onStart?: () => void } = {}
  ): Promise<BatchResult | null> => {
    const wanted = suspend ? "active" : "suspended";
    const targets = users.filter((u) => ids.includes(u.id) && !isLocked(u) && u.status === wanted);
    if (targets.length === 0) {
      nothingChanged();
      return null;
    }
    // One user: reversible, so it happens at once with "Afturkalla". Many: confirm with a count.
    if (targets.length > 1) {
      const n = countIs(targets.length, "notanda", "notendum");
      const ok = await askConfirm({
        title: suspend ? `Frysta aðgang hjá ${n}?` : `Virkja aðgang aftur hjá ${n}?`,
        body: (
          <>
            <p>
              {suspend
                ? "Þau komast ekki inn í Slóða fyrr en aðgangurinn er virkjaður aftur. Efnið þeirra helst óbreytt."
                : "Þau komast strax inn aftur með sömu réttindi og áður."}
            </p>
            <NameList users={targets} />
          </>
        ),
        confirmLabel: suspend ? `Frysta hjá ${n}` : `Virkja hjá ${n}`,
        tone: suspend ? "danger" : "primary",
      });
      if (!ok) return null;
    }
    options.onStart?.();
    const at = new Date().toISOString();
    const reason = options.reason?.trim() || undefined;
    const verb = suspend ? "frystur" : "virkjaður aftur";
    return runBatch(
      targets,
      (u) => ({
        ...u,
        status: suspend ? "suspended" : "active",
        suspension: suspend ? { since: at, reason } : undefined,
        history: [
          ...u.history,
          { at, text: reason ? `Aðgangur ${verb}: ${reason}` : `Aðgangur ${verb}`, by: "Þú" },
        ],
      }),
      (done) =>
        done.length === 1
          ? `Aðgangur ${verb}: ${done[0].name}.`
          : `Aðgangur ${verb} hjá ${countIs(done.length, "notanda", "notendum")}.`
    );
  };

  const resetFilters = () => {
    setQuery("");
    setPermission("all");
    setPage(0);
  };

  return {
    users,
    query,
    setQuery: (q: string) => {
      setQuery(q);
      setPage(0);
    },
    permission,
    setPermission: (p: PermissionFilter) => {
      setPermission(p);
      setPage(0);
    },
    counts,
    filtered,
    visible,
    page: safePage,
    pageCount,
    pageSize,
    setPage,
    sort,
    toggleSort: (key: SortKey) =>
      setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" })),
    selectedId,
    setSelectedId,
    confirm,
    setConfirm,
    toast,
    setToast,
    isLocked,
    isSelf: (u: LabUser) => u.id === currentUserId,
    changeRole,
    setSuspended,
    changeRoleBatch,
    suspendBatch,
    resetFilters,
  };
}

type Model = ReturnType<typeof useUserManagement>;

/* ── Component ─────────────────────────────────────────────────────────────── */

/**
 * Lab copy of `components/UserManagement`: same job, plus suspension, history and a
 * permission filter the API doesn't offer yet. Fixtures come in as props; nothing is fetched.
 */
export default function UserManagementLab(props: UserManagementLabProps) {
  const { look, state = "ready" } = props;
  const m = useUserManagement(props);
  const ready = state === "ready";
  const closeConfirm = () => {
    m.confirm?.onCancel?.();
    m.setConfirm(null);
  };

  if (props.panelOnly && look === "skipt") {
    const user = m.users.find((u) => u.id === m.selectedId);
    return (
      <div className={cx(styles.root, styles[look])}>
        {user && <UserDetail m={m} user={user} focusOnMount={false} />}
        <ToastRegion m={m} />
        <ConfirmDialog request={m.confirm} onDone={closeConfirm} />
      </div>
    );
  }

  let body: ReactNode;
  if (state === "loading") body = <Skeleton look={look} />;
  else if (state === "error")
    body = <LoadError detail={props.errorDetail} onRetry={props.onRetry} />;
  else if (props.users.length === 0) body = <NoUsers />;
  else if (m.filtered.length === 0) body = <NoMatch onReset={m.resetFilters} query={m.query} />;
  else if (look === "tafla") body = <TableLook m={m} />;
  else if (look === "spjold") body = <CardsLook m={m} />;
  else if (look === "skipt") body = <SplitLook m={m} />;
  else body = <BulkLook m={m} />;

  const showSummary = ready && props.users.length > 0;

  return (
    <div className={cx(styles.root, styles[look])} aria-busy={state === "loading"}>
      <Toolbar m={m} showCounts={ready} />
      <p className={styles.summary} role="status">
        {showSummary
          ? m.filtered.length === m.users.length
            ? countIs(m.users.length, "notandi", "notendur")
            : `${countIs(m.filtered.length, "notandi", "notendur")} af ${m.users.length}`
          : ""}
      </p>
      {body}
      {ready && m.filtered.length > 0 && m.pageCount > 1 && <Pager m={m} />}
      <ToastRegion m={m} />
      <ConfirmDialog request={m.confirm} onDone={closeConfirm} />
    </div>
  );
}

/* ── Toolbar: search + permission chips ────────────────────────────────────── */

function Toolbar({ m, showCounts }: { m: Model; showCounts: boolean }) {
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
          value={m.query}
          onChange={(e) => m.setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className={styles.chips} role="group" aria-label="Sía eftir réttindum">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={styles.chip}
            aria-pressed={m.permission === f}
            onClick={() => m.setPermission(f)}
          >
            {f === "all" ? "Öll" : PLURAL[f]}
            {showCounts && <span className={styles.chipCount}>{m.counts[f]}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Small shared pieces ───────────────────────────────────────────────────── */

function SelfBadge() {
  return <span className={styles.selfBadge}>þú</span>;
}

function StatusBadge({ user }: { user: LabUser }) {
  return user.status === "suspended" ? (
    <span className={cx(styles.status, styles.statusSuspended)}>Frystur</span>
  ) : (
    <span className={cx(styles.status, styles.statusActive)}>Virkur</span>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className={styles.avatar} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function NameList({ users }: { users: LabUser[] }) {
  const shown = users.slice(0, 5);
  return (
    <ul className={styles.nameList}>
      {shown.map((u) => (
        <li key={u.id}>{u.name}</li>
      ))}
      {users.length > shown.length && (
        <li className={styles.nameListMore}>og {users.length - shown.length} í viðbót</li>
      )}
    </ul>
  );
}

/** Why a row has no controls: visible text, not a tooltip (UX rule 9). */
function lockReason(m: Model, u: LabUser): string {
  return m.isSelf(u) ? "Eigin aðgangur" : "Stillt í kerfinu";
}

function RoleSelect({ m, user, id }: { m: Model; user: LabUser; id?: string }) {
  if (m.isLocked(user)) {
    return (
      <span className={styles.lockedRole}>
        {LABEL[user.permissions]}
        <span className={styles.reason}>{lockReason(m, user)}</span>
      </span>
    );
  }
  return (
    <select
      id={id}
      className={styles.select}
      value={user.permissions}
      onChange={(e) => m.changeRole([user.id], e.target.value as UserPermissions)}
      aria-label={id ? undefined : `Réttindi: ${user.name}`}
    >
      {GRANTABLE.map((p) => (
        <option key={p} value={p}>
          {LABEL[p]}
        </option>
      ))}
    </select>
  );
}

function SuspendButton({ m, user, full }: { m: Model; user: LabUser; full?: boolean }) {
  if (m.isLocked(user)) return null;
  const suspended = user.status === "suspended";
  return (
    <button
      type="button"
      className={cx(
        styles.button,
        suspended ? styles.buttonSecondary : styles.buttonDangerQuiet,
        full && styles.full
      )}
      onClick={() => m.setSuspended([user.id], !suspended)}
      aria-label={`${suspended ? "Virkja aðgang aftur" : "Frysta aðgang"}: ${user.name}`}
    >
      {suspended ? "Virkja aftur" : "Frysta"}
    </button>
  );
}

/* ── A · Tafla: dense sortable table ───────────────────────────────────────── */

const SORT_LABEL: Record<SortKey, string> = {
  name: "nafni",
  email: "netfangi",
  permissions: "réttindum",
  lastSeen: "síðustu innskráningu",
};

function SortHeader({ m, k, children }: { m: Model; k: SortKey; children: ReactNode }) {
  const active = m.sort.key === k;
  const Icon = !active ? ArrowUpDown : m.sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      className={cx(styles.th, k === "email" && styles.emailCol)}
      aria-sort={active ? (m.sort.dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <button type="button" className={styles.sortButton} onClick={() => m.toggleSort(k)}>
        {children}
        <Icon className={cx(styles.sortIcon, active && styles.sortIconActive)} aria-hidden="true" />
      </button>
    </th>
  );
}

function TableLook({ m }: { m: Model }) {
  return (
    <div className={styles.tableScroll} role="region" aria-label="Notendatafla" tabIndex={0}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>
          Notendur, raðað eftir {SORT_LABEL[m.sort.key]},{" "}
          {m.sort.dir === "asc" ? "hækkandi" : "lækkandi"}
        </caption>
        <thead>
          <tr>
            <SortHeader m={m} k="name">
              Nafn
            </SortHeader>
            <SortHeader m={m} k="email">
              Netfang
            </SortHeader>
            <SortHeader m={m} k="permissions">
              Réttindi
            </SortHeader>
            <SortHeader m={m} k="lastSeen">
              Síðast inni
            </SortHeader>
            <th scope="col" className={styles.th}>
              <span className={styles.thText}>Staða</span>
            </th>
            <th scope="col" className={styles.th}>
              <span className={styles.srOnly}>Aðgerðir</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {m.visible.map((u) => (
            <tr key={u.id} className={cx(styles.tr, m.isSelf(u) && styles.selfRow)}>
              <th scope="row" className={styles.td}>
                <span className={styles.name}>{u.name}</span>
                {m.isSelf(u) && <SelfBadge />}
                <span className={cx(styles.email, styles.emailInline)}>{u.email}</span>
              </th>
              <td className={cx(styles.td, styles.emailCol, styles.email)}>{u.email}</td>
              <td className={styles.td}>
                <RoleSelect m={m} user={u} />
              </td>
              <td className={cx(styles.td, styles.nowrap)}>{lastSeen(u)}</td>
              <td className={styles.td}>
                <StatusBadge user={u} />
              </td>
              <td className={styles.td}>
                <SuspendButton m={m} user={u} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── B · Spjöld: card list for phones ──────────────────────────────────────── */

function CardsLook({ m }: { m: Model }) {
  const id = useId();
  return (
    <ul className={styles.cards}>
      {m.visible.map((u) => (
        <li
          key={u.id}
          className={cx(styles.card, u.status === "suspended" && styles.cardSuspended)}
        >
          <div className={styles.cardHead}>
            <Avatar name={u.name} />
            <div className={styles.cardWho}>
              <p className={styles.name}>
                {u.name}
                {m.isSelf(u) && <SelfBadge />}
              </p>
              <p className={styles.email}>{u.email}</p>
            </div>
            <StatusBadge user={u} />
          </div>
          <p className={styles.cardMeta}>Síðast inni: {lastSeen(u)}</p>
          <div className={styles.cardActions}>
            {m.isLocked(u) ? (
              <RoleSelect m={m} user={u} />
            ) : (
              <div className={styles.field}>
                <label htmlFor={`${id}-${u.id}`} className={styles.fieldLabel}>
                  Réttindi
                </label>
                <RoleSelect m={m} user={u} id={`${id}-${u.id}`} />
              </div>
            )}
            <SuspendButton m={m} user={u} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ── C · Skipt: list + detail panel ────────────────────────────────────────── */

/** True once the split has collapsed to one column (phone width): the panel replaces the list. */
function isStacked(el: HTMLElement | null): boolean {
  if (!el) return false;
  return getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length < 2;
}

const ROW_KEYS: Record<string, (index: number, last: number) => number> = {
  ArrowDown: (i, last) => Math.min(i + 1, last),
  ArrowUp: (i) => Math.max(i - 1, 0),
  Home: () => 0,
  End: (_, last) => last,
};

function PermissionBadge({ permission }: { permission: UserPermissions }) {
  return (
    <span className={cx(styles.permBadge, permission === "admin" && styles.permBadgeAdmin)}>
      {LABEL[permission]}
    </span>
  );
}

function SplitLook({ m }: { m: Model }) {
  const selected = m.users.find((u) => u.id === m.selectedId) ?? null;
  const splitRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [focusDetail, setFocusDetail] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // A link to a user opens the page of the list they are on, so the selected row is in view.
  useEffect(() => {
    const index = m.filtered.findIndex((u) => u.id === m.selectedId);
    if (index >= 0) m.setPage(Math.floor(index / m.pageSize));
    // Only on mount: after that the reader pages on their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ids = m.visible.map((u) => u.id);
  // Roving tab stop: the list is one Tab stop, and the arrow keys move inside it.
  const tabStop = [focusedId, m.selectedId].find((x) => x && ids.includes(x)) ?? ids[0];

  const rowFor = (id: string) =>
    splitRef.current?.querySelector<HTMLElement>(`[data-user-id="${CSS.escape(id)}"]`);

  const open = (id: string) => {
    m.setSelectedId(id);
    setFocusedId(id);
    // Side by side, focus stays in the list. Stacked, it follows the panel.
    setFocusDetail(isStacked(splitRef.current));
  };

  const onRowKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = ROW_KEYS[e.key];
    if (!step) return;
    e.preventDefault();
    const id = ids[step(index, ids.length - 1)];
    setFocusedId(id);
    rowFor(id)?.focus();
    // Side by side, the selection follows focus. Stacked, opening would hide the list: wait for Enter.
    if (!isStacked(splitRef.current)) {
      m.setSelectedId(id);
      setFocusDetail(false);
    }
  };

  const back = () => {
    const id = m.selectedId;
    m.setSelectedId(null);
    if (id) requestAnimationFrame(() => rowFor(id)?.focus());
  };

  return (
    <div ref={splitRef} className={styles.split} data-has-selection={selected ? "true" : undefined}>
      <div className={styles.splitListBox}>
        <p id={hintId} className={styles.srOnly}>
          Örvalyklar upp og niður færa á milli notenda.
        </p>
        <ul className={styles.splitList} aria-label="Notendalisti" aria-describedby={hintId}>
          {m.visible.map((u, i) => (
            <li key={u.id}>
              <button
                type="button"
                data-user-id={u.id}
                tabIndex={u.id === tabStop ? 0 : -1}
                className={styles.splitItem}
                aria-current={u.id === m.selectedId ? "true" : undefined}
                onClick={() => open(u.id)}
                onKeyDown={(e) => onRowKey(e, i)}
                onFocus={() => setFocusedId(u.id)}
              >
                <Avatar name={u.name} />
                <span className={styles.splitWho}>
                  <span className={styles.splitNameLine}>
                    <span className={cx(styles.name, styles.truncate)}>{u.name}</span>
                    {m.isSelf(u) && <SelfBadge />}
                  </span>
                  <span className={cx(styles.email, styles.truncate)}>{u.email}</span>
                  <span className={styles.splitRole}>
                    {LABEL[u.permissions]}
                    {u.status === "suspended" && (
                      <span className={styles.splitFrozen}>
                        <span aria-hidden="true"> · </span>
                        <span className={styles.srOnly}>, </span>
                        Frystur
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.detail}>
        {selected ? (
          <UserDetail
            key={selected.id}
            m={m}
            user={selected}
            onBack={back}
            focusOnMount={focusDetail}
          />
        ) : (
          <div className={styles.detailEmpty}>
            <UserRound className={styles.detailEmptyIcon} aria-hidden="true" />
            <p className={styles.detailEmptyTitle}>Veldu notanda</p>
            <p className={styles.sectionText}>
              Veldu notanda úr listanum til að sjá réttindi, aðgang og sögu.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** When the account was frozen: the record if there is one, else the last freeze in the history. */
function suspendedSince(user: LabUser): string | undefined {
  if (user.suspension) return user.suspension.since;
  return [...user.history].reverse().find((h) => h.text.startsWith("Aðgangur frystur"))?.at;
}

/** History entries shown before "Sýna alla söguna". */
const HISTORY_SHOWN = 5;

function UserDetail({
  m,
  user,
  onBack,
  focusOnMount,
}: {
  m: Model;
  user: LabUser;
  onBack?: () => void;
  focusOnMount: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState<UserPermissions | null>(null);
  const [busy, setBusy] = useState<"role" | "access" | null>(null);
  const [roleNote, setRoleNote] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [allHistory, setAllHistory] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  const value = draft ?? user.permissions;
  const changed = value !== user.permissions;
  const locked = m.isLocked(user);
  const self = m.isSelf(user);
  const suspended = user.status === "suspended";
  const since = suspended ? suspendedSince(user) : undefined;

  // On a phone the panel replaces the list, so focus follows it there.
  useEffect(() => {
    if (focusOnMount && backRef.current?.offsetParent) headingRef.current?.focus();
  }, [focusOnMount]);

  const submitRole = async (e: FormEvent) => {
    e.preventDefault();
    setRoleError(null);
    // UX rule 6: the button stays enabled; with nothing changed it says so instead of saving.
    if (!changed) {
      setRoleNote("Engin breyting til að vista.");
      return;
    }
    setRoleNote(null);
    const result = await m.changeRoleBatch([user.id], value, { onStart: () => setBusy("role") });
    setBusy(null);
    if (result?.failed.length) setRoleError("Ekki tókst að vista réttindin. Reyndu aftur.");
    else if (result) setDraft(null);
  };

  const toggleAccess = async (e: FormEvent) => {
    e.preventDefault();
    setAccessError(null);
    const result = await m.suspendBatch([user.id], !suspended, {
      reason,
      onStart: () => setBusy("access"),
    });
    setBusy(null);
    if (result?.failed.length) {
      setAccessError(
        suspended
          ? "Ekki tókst að virkja aðganginn aftur. Reyndu aftur."
          : "Ekki tókst að frysta aðganginn. Reyndu aftur."
      );
    } else if (result) setReason("");
  };

  const history = [...user.history].reverse();
  const shownHistory = allHistory ? history : history.slice(0, HISTORY_SHOWN);

  return (
    <article className={styles.detailCard} aria-labelledby={`${id}-h`}>
      {onBack && (
        <button
          ref={backRef}
          type="button"
          className={cx(styles.button, styles.buttonGhost, styles.backButton)}
          onClick={onBack}
        >
          <ArrowLeft aria-hidden="true" className={styles.buttonIcon} />
          Til baka í lista
        </button>
      )}
      <header className={styles.detailHead}>
        <span className={styles.avatarLg} aria-hidden="true">
          {initials(user.name)}
        </span>
        <div className={styles.detailWho}>
          <h2 id={`${id}-h`} ref={headingRef} tabIndex={-1} className={styles.detailName}>
            {user.name}
            {self && <SelfBadge />}
          </h2>
          <p className={styles.email}>{user.email}</p>
          <p className={styles.detailBadges}>
            <PermissionBadge permission={user.permissions} />
            <StatusBadge user={user} />
          </p>
        </div>
      </header>

      <dl className={styles.facts}>
        <div>
          <dt>Nýskráning</dt>
          <dd>{formatIcelandicDate(user.joinedAt)}</dd>
        </div>
        <div>
          <dt>Síðast inni</dt>
          <dd>{lastSeen(user)}</dd>
        </div>
      </dl>

      <section className={styles.detailSection} aria-labelledby={`${id}-r ${id}-h`}>
        <h3 id={`${id}-r`} className={styles.sectionTitle}>
          Réttindi
        </h3>
        {locked ? (
          <div className={styles.lockedNote}>
            <Lock className={styles.lockedIcon} aria-hidden="true" />
            <p>
              <strong>{LABEL[user.permissions]}.</strong>{" "}
              {self
                ? "Þú getur ekki breytt eigin réttindum. Annar stjórnandi þarf að gera það."
                : "Stjórnendur eru skilgreindir í stillingum kerfisins og þeim er ekki breytt hér."}
            </p>
          </div>
        ) : (
          <form onSubmit={submitRole} className={styles.roleForm}>
            <fieldset className={styles.radios}>
              <legend className={styles.srOnly}>Réttindi {user.name}</legend>
              {GRANTABLE.map((p) => (
                <label key={p} className={cx(styles.radio, value === p && styles.radioChecked)}>
                  <input
                    type="radio"
                    name={`${id}-perm`}
                    value={p}
                    checked={value === p}
                    onChange={() => {
                      setDraft(p);
                      setRoleNote(null);
                    }}
                  />
                  <span>
                    <span className={styles.radioLabel}>
                      {LABEL[p]}
                      {p === user.permissions && <span className={styles.radioNow}> · núna</span>}
                    </span>
                    <span className={styles.radioHint}>{DESCRIPTION[p]}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {roleError && (
              <p className={styles.inlineError} role="alert">
                {roleError}
              </p>
            )}
            <div className={styles.formActions}>
              <button
                type="submit"
                className={cx(styles.button, styles.buttonPrimary)}
                disabled={busy === "role"}
              >
                {busy === "role" ? "Vista…" : "Vista réttindi"}
              </button>
              {changed && busy !== "role" && (
                <button
                  type="button"
                  className={cx(styles.button, styles.buttonGhost)}
                  onClick={() => setDraft(null)}
                >
                  Hætta við
                </button>
              )}
              <p className={styles.formHint} aria-live="polite">
                {changed
                  ? `${LABEL[user.permissions]} → ${LABEL[value]}, óvistað`
                  : (roleNote ?? "")}
              </p>
            </div>
          </form>
        )}
      </section>

      <section className={styles.detailSection} aria-labelledby={`${id}-a ${id}-h`}>
        <h3 id={`${id}-a`} className={styles.sectionTitle}>
          Aðgangur
        </h3>
        {locked ? (
          <div className={styles.lockedNote}>
            <Lock className={styles.lockedIcon} aria-hidden="true" />
            <p>
              {self
                ? "Þú getur ekki fryst eigin aðgang."
                : "Aðgangi stjórnenda er stýrt í stillingum kerfisins."}
            </p>
          </div>
        ) : (
          <form onSubmit={toggleAccess} className={styles.accessForm}>
            {suspended ? (
              <div className={styles.frozenNote}>
                <p className={styles.frozenTitle}>
                  {since ? `Frystur síðan ${formatIcelandicDate(since)}` : "Aðgangurinn er frystur"}
                </p>
                <p>
                  {user.suspension?.reason
                    ? `Ástæða: ${user.suspension.reason}`
                    : "Engin ástæða skráð."}
                </p>
                <p className={styles.frozenHint}>Notandinn kemst ekki inn, en efnið er óbreytt.</p>
              </div>
            ) : (
              <>
                <p className={styles.sectionText}>
                  Ef þú frystir aðganginn kemst notandinn ekki inn fyrr en hann er virkjaður aftur.
                  Efnið helst óbreytt.
                </p>
                <div className={styles.field}>
                  <label htmlFor={`${id}-reason`} className={styles.fieldLabel}>
                    Ástæða (valfrjálst)
                  </label>
                  <input
                    id={`${id}-reason`}
                    className={styles.textInput}
                    value={reason}
                    maxLength={200}
                    onChange={(e) => setReason(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </>
            )}
            {accessError && (
              <p className={styles.inlineError} role="alert">
                {accessError}
              </p>
            )}
            <button
              type="submit"
              className={cx(
                styles.button,
                suspended ? styles.buttonSecondary : styles.buttonDangerQuiet
              )}
              disabled={busy === "access"}
            >
              {busy === "access"
                ? suspended
                  ? "Virki…"
                  : "Frysti…"
                : suspended
                  ? "Virkja aðgang aftur"
                  : "Frysta aðgang"}
            </button>
          </form>
        )}
      </section>

      <section className={styles.detailSection} aria-labelledby={`${id}-s ${id}-h`}>
        <h3 id={`${id}-s`} className={styles.sectionTitle}>
          Saga
        </h3>
        {history.length === 0 ? (
          <p className={styles.sectionText}>Engar breytingar skráðar.</p>
        ) : (
          <>
            <ol className={styles.timeline}>
              {shownHistory.map((h, i) => (
                <li key={`${h.at}-${i}`} className={styles.timelineItem}>
                  <time dateTime={h.at} className={styles.timelineTime}>
                    {formatIcelandicDate(h.at)}
                  </time>
                  <span className={styles.timelineText}>{h.text}</span>
                  {h.by && <span className={styles.timelineBy}>{h.by}</span>}
                </li>
              ))}
            </ol>
            {history.length > HISTORY_SHOWN && (
              <button
                type="button"
                className={cx(styles.button, styles.buttonGhost, styles.timelineMore)}
                aria-expanded={allHistory}
                onClick={() => setAllHistory((v) => !v)}
              >
                {allHistory ? "Sýna færri" : `Sýna alla söguna (${history.length})`}
              </button>
            )}
          </>
        )}
      </section>
    </article>
  );
}

/* ── D · Val: checkbox rows with a sticky action bar ───────────────────────── */

type BulkAction = "role" | "freeze" | "reinstate";

const BULK_BUSY: Record<BulkAction, string> = {
  role: "Breyti…",
  freeze: "Frysti…",
  reinstate: "Virki…",
};

const BULK_FAILED: Record<BulkAction, string> = {
  role: "breyta réttindum",
  freeze: "frysta aðgang",
  reinstate: "virkja aðgang aftur",
};

interface BulkFailure {
  action: BulkAction;
  role?: UserPermissions;
  users: LabUser[];
}

function BulkLook({ m }: { m: Model }) {
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [busy, setBusy] = useState<BulkAction | null>(null);
  const [failure, setFailure] = useState<BulkFailure | null>(null);
  const [roleDialog, setRoleDialog] = useState(false);
  const allRef = useRef<HTMLInputElement>(null);
  const failureRef = useRef<HTMLDivElement>(null);

  const selectable = m.visible.filter((u) => !m.isLocked(u));
  // Act only on what can be seen: a selection hidden by a later filter is ignored.
  const targets = m.filtered.filter((u) => chosen.has(u.id));
  const onPage = selectable.filter((u) => chosen.has(u.id)).length;
  const all = selectable.length > 0 && onPage === selectable.length;
  const some = onPage > 0 && !all;
  const failedIds = new Set(failure?.users.map((u) => u.id));

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = some;
  }, [some]);

  const toggleAll = () =>
    setChosen((prev) => {
      const next = new Set(prev);
      for (const u of selectable) {
        if (all) next.delete(u.id);
        else next.add(u.id);
      }
      return next;
    });

  /** A click toggles one row; a shift-click sets every row from the last click to this one. */
  const onRowChange = (uid: string, e: ChangeEvent<HTMLInputElement>) => {
    const on = e.target.checked;
    const shift = (e.nativeEvent as MouseEvent).shiftKey;
    const from = anchor ? selectable.findIndex((u) => u.id === anchor) : -1;
    const to = selectable.findIndex((u) => u.id === uid);
    const range =
      shift && from !== -1 && to !== -1
        ? selectable.slice(Math.min(from, to), Math.max(from, to) + 1).map((u) => u.id)
        : [uid];
    setChosen((prev) => {
      const next = new Set(prev);
      for (const id of range) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    setAnchor(uid);
  };

  const clear = () => {
    setChosen(new Set());
    setAnchor(null);
  };

  const run = async (
    action: BulkAction,
    ids: string[],
    send: (onStart: () => void) => Promise<BatchResult | null>,
    role?: UserPermissions
  ) => {
    setFailure(null);
    const result = await send(() => setBusy(action));
    setBusy(null);
    if (!result) return;
    setChosen((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    if (result.failed.length) {
      setFailure({ action, role, users: result.failed });
      requestAnimationFrame(() => failureRef.current?.focus());
    } else {
      // The bar goes with the selection, so focus goes back to the top of the list.
      requestAnimationFrame(() => allRef.current?.focus());
    }
  };

  const freeze = (ids: string[]) =>
    run("freeze", ids, (onStart) => m.suspendBatch(ids, true, { onStart }));
  const reinstate = (ids: string[]) =>
    run("reinstate", ids, (onStart) => m.suspendBatch(ids, false, { onStart }));
  const changeRole = (ids: string[], role: UserPermissions) =>
    run("role", ids, (onStart) => m.changeRoleBatch(ids, role, { confirmed: true, onStart }), role);

  const retry = () => {
    if (!failure) return;
    const ids = failure.users.map((u) => u.id);
    if (failure.action === "freeze") freeze(ids);
    else if (failure.action === "reinstate") reinstate(ids);
    else if (failure.role) changeRole(ids, failure.role);
  };

  const ids = targets.map((u) => u.id);
  const anyActive = targets.some((u) => u.status === "active");
  const anySuspended = targets.some((u) => u.status === "suspended");
  const showBar = targets.length > 0 || busy !== null;

  return (
    <div className={styles.bulk}>
      <p className={styles.srOnly} aria-live="polite">
        {targets.length > 0 ? `Valin: ${countIs(targets.length, "notandi", "notendur")}` : ""}
      </p>
      <div className={styles.bulkHead}>
        <label className={styles.checkLabel}>
          <input
            ref={allRef}
            type="checkbox"
            className={styles.checkbox}
            checked={all}
            onChange={toggleAll}
            disabled={selectable.length === 0}
          />
          Velja alla á síðunni
        </label>
        <span className={styles.bulkHeadCols} aria-hidden="true">
          <span>Réttindi</span>
          <span>Staða</span>
        </span>
      </div>

      {failure && (
        <div ref={failureRef} className={styles.failure} role="alert" tabIndex={-1}>
          <TriangleAlert className={styles.failureIcon} aria-hidden="true" />
          <div className={styles.failureBody}>
            <p className={styles.failureTitle}>
              Ekki tókst að {BULK_FAILED[failure.action]} hjá{" "}
              {countIs(failure.users.length, "notanda", "notendum")}.
            </p>
            <NameList users={failure.users} />
            <div className={styles.failureActions}>
              <button
                type="button"
                className={cx(styles.button, styles.buttonSecondary)}
                onClick={retry}
                disabled={busy !== null}
              >
                {busy ? BULK_BUSY[busy] : "Reyna aftur"}
              </button>
            </div>
          </div>
          <button
            type="button"
            className={cx(styles.button, styles.buttonGhost, styles.iconButton)}
            aria-label="Loka"
            onClick={() => setFailure(null)}
          >
            <X className={styles.buttonIcon} aria-hidden="true" />
          </button>
        </div>
      )}

      <ul className={styles.bulkList}>
        {m.visible.map((u) => {
          const locked = m.isLocked(u);
          const isChosen = chosen.has(u.id);
          const cells = (
            <>
              <span className={styles.bulkWho}>
                <span className={styles.splitNameLine}>
                  <span className={styles.name}>{u.name}</span>
                  {m.isSelf(u) && <SelfBadge />}
                </span>
                <span className={styles.email}>{u.email}</span>
              </span>
              <span className={styles.bulkRole}>
                {LABEL[u.permissions]}
                {locked && <span className={styles.reason}>{lockReason(m, u)}</span>}
              </span>
              <span className={styles.bulkStatus}>
                <StatusBadge user={u} />
                {failedIds.has(u.id) && <span className={styles.failedBadge}>Mistókst</span>}
              </span>
            </>
          );
          return (
            <li key={u.id}>
              {locked ? (
                <div className={cx(styles.bulkRow, styles.bulkRowLocked)}>
                  <span className={styles.checkSpacer} aria-hidden="true" />
                  {cells}
                </div>
              ) : (
                <label className={cx(styles.bulkRow, isChosen && styles.bulkRowChosen)}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={isChosen}
                    onChange={(e) => onRowChange(u.id, e)}
                  />
                  {cells}
                </label>
              )}
            </li>
          );
        })}
      </ul>

      {showBar && (
        <div className={styles.actionBar} role="region" aria-label="Aðgerðir fyrir valda notendur">
          <p className={styles.barCount}>Valin: {countIs(targets.length, "notandi", "notendur")}</p>
          <button
            type="button"
            className={cx(styles.button, styles.buttonGhost)}
            onClick={clear}
            disabled={busy !== null}
          >
            Hreinsa val
          </button>
          <span className={styles.barSpacer} />
          <button
            type="button"
            className={cx(styles.button, styles.buttonSecondary)}
            onClick={() => setRoleDialog(true)}
            disabled={busy !== null}
          >
            {busy === "role" ? BULK_BUSY.role : "Breyta réttindum…"}
          </button>
          {anySuspended && (
            <button
              type="button"
              className={cx(styles.button, styles.buttonSecondary)}
              onClick={() => reinstate(ids)}
              disabled={busy !== null}
            >
              {busy === "reinstate" ? BULK_BUSY.reinstate : "Virkja aftur"}
            </button>
          )}
          {(anyActive || busy === "freeze") && (
            <button
              type="button"
              className={cx(styles.button, styles.buttonDanger)}
              onClick={() => freeze(ids)}
              disabled={busy !== null}
            >
              {busy === "freeze" ? BULK_BUSY.freeze : "Frysta aðgang"}
            </button>
          )}
        </div>
      )}

      <BulkRoleDialog
        open={roleDialog}
        users={targets}
        onClose={() => setRoleDialog(false)}
        onConfirm={(role) => {
          setRoleDialog(false);
          changeRole(ids, role);
        }}
      />
    </div>
  );
}

/** "Breyta réttindum…": pick the new role, see the count and the names, then confirm. */
function BulkRoleDialog({
  open,
  users,
  onClose,
  onConfirm,
}: {
  open: boolean;
  users: LabUser[];
  onClose: () => void;
  onConfirm: (role: UserPermissions) => void;
}) {
  const id = useId();
  const [role, setRole] = useState<UserPermissions>("member");
  const changing = users.filter((u) => u.permissions !== role);
  const promotes = role === "moderator" && changing.length > 0;
  const n = countIs(users.length, "notanda", "notendum");

  return (
    <Modal open={open} onClose={onClose} labelledBy={`${id}-t`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(role);
        }}
      >
        <h2 id={`${id}-t`} className={styles.dialogTitle}>
          Breyta réttindum hjá {n}
        </h2>
        <div className={styles.dialogBody}>
          <fieldset className={styles.radios}>
            <legend className={styles.fieldLabel}>Ný réttindi</legend>
            {GRANTABLE.map((p) => (
              <label key={p} className={cx(styles.radio, role === p && styles.radioChecked)}>
                <input
                  type="radio"
                  name={`${id}-role`}
                  value={p}
                  checked={role === p}
                  onChange={() => setRole(p)}
                />
                <span>
                  <span className={styles.radioLabel}>{LABEL[p]}</span>
                  <span className={styles.radioHint}>{DESCRIPTION[p]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {promotes && <p>{PROMOTE_WARNING}</p>}
          <NameList users={users} />
          {changing.length < users.length && (
            <p className={styles.sectionText}>
              {changing.length === 0
                ? `Öll valin eru þegar ${LABEL_LOWER[role]}.`
                : `Þegar með þessi réttindi: ${countIs(users.length - changing.length, "notandi", "notendur")}. Þeim er ekki breytt.`}
            </p>
          )}
        </div>
        <div className={styles.dialogActions}>
          <button type="button" className={cx(styles.button, styles.buttonGhost)} onClick={onClose}>
            Hætta við
          </button>
          <button type="submit" className={cx(styles.button, styles.buttonPrimary)}>
            {changing.length > 0
              ? `Breyta hjá ${countIs(changing.length, "notanda", "notendum")}`
              : "Breyta réttindum"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ── States ────────────────────────────────────────────────────────────────── */

function Skeleton({ look }: { look: UserManagementLook }) {
  const rows = Array.from({ length: 6 }, (_, i) => i);
  return (
    <div>
      <p role="status" className={styles.srOnly}>
        Sæki notendur…
      </p>
      <div className={cx(styles.skeleton, styles[`skeleton_${look}`])} aria-hidden="true">
        {look === "skipt" ? (
          <>
            <div className={styles.skeletonList}>
              {rows.map((i) => (
                <div key={i} className={styles.skeletonRow}>
                  <span className={cx(styles.bone, styles.boneAvatar)} />
                  <span className={styles.boneStack}>
                    <span className={cx(styles.bone, styles.boneLong)} />
                    <span className={cx(styles.bone, styles.boneShort)} />
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.skeletonPanel}>
              <span className={cx(styles.bone, styles.boneTitle)} />
              <span className={cx(styles.bone, styles.boneLong)} />
              <span className={cx(styles.bone, styles.boneBlock)} />
            </div>
          </>
        ) : (
          rows.map((i) => (
            <div key={i} className={styles.skeletonRow}>
              {look === "val" && <span className={cx(styles.bone, styles.boneCheck)} />}
              {look === "spjold" && <span className={cx(styles.bone, styles.boneAvatar)} />}
              <span className={styles.boneStack}>
                <span className={cx(styles.bone, styles.boneLong)} />
                <span className={cx(styles.bone, styles.boneShort)} />
              </span>
              <span className={cx(styles.bone, styles.boneControl)} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LoadError({ detail, onRetry }: { detail?: string; onRetry?: () => void }) {
  return (
    <div className={styles.stateBox} role="alert">
      <p className={styles.stateTitle}>Úps! Ekki tókst að sækja notendur.</p>
      <p className={styles.stateText}>Athugaðu tenginguna og reyndu aftur.</p>
      {detail && <p className={styles.smallPrint}>{detail}</p>}
      <button type="button" className={cx(styles.button, styles.buttonPrimary)} onClick={onRetry}>
        Reyna aftur
      </button>
    </div>
  );
}

function NoUsers() {
  return (
    <div className={styles.stateBox}>
      <p className={styles.stateTitle}>Engir notendur enn.</p>
      <p className={styles.stateText}>
        Notendur birtast hér um leið og þau skrá sig inn í Slóða í fyrsta sinn.
      </p>
    </div>
  );
}

function NoMatch({ onReset, query }: { onReset: () => void; query: string }) {
  return (
    <div className={styles.stateBox}>
      <p className={styles.stateTitle}>
        {query.trim()
          ? `Enginn notandi passar við „${query.trim()}“.`
          : "Enginn notandi með þessi réttindi."}
      </p>
      <p className={styles.stateText}>Prófaðu annað leitarorð eða aðra síu.</p>
      <button type="button" className={cx(styles.button, styles.buttonSecondary)} onClick={onReset}>
        Hreinsa leit og síur
      </button>
    </div>
  );
}

function Pager({ m }: { m: Model }) {
  return (
    <div className={styles.pager} role="group" aria-label="Síður">
      <button
        type="button"
        className={cx(styles.button, styles.buttonSecondary)}
        disabled={m.page === 0}
        onClick={() => m.setPage(m.page - 1)}
      >
        Fyrri
      </button>
      <span className={styles.pageInfo}>
        Síða {m.page + 1} af {m.pageCount}
      </span>
      <button
        type="button"
        className={cx(styles.button, styles.buttonSecondary)}
        disabled={m.page >= m.pageCount - 1}
        onClick={() => m.setPage(m.page + 1)}
      >
        Næsta
      </button>
    </div>
  );
}

/* ── Toast with "Afturkalla" ───────────────────────────────────────────────── */

function ToastRegion({ m }: { m: Model }) {
  const { toast, setToast } = m;
  const [paused, setPaused] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast || paused) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast, paused, setToast]);

  return (
    <div
      ref={regionRef}
      className={styles.toastRegion}
      role="status"
      tabIndex={-1}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
    >
      {toast && (
        <div key={toast.key} className={styles.toast}>
          <span className={styles.toastText}>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              className={cx(styles.button, styles.toastButton)}
              onClick={() => {
                toast.undo?.();
                // The button is about to go; keep focus in the region, not on <body>.
                regionRef.current?.focus();
              }}
            >
              Afturkalla
            </button>
          )}
          <button
            type="button"
            className={cx(styles.button, styles.toastClose)}
            aria-label="Loka"
            onClick={() => setToast(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Dialogs ───────────────────────────────────────────────────────────────── */

/**
 * Native `<dialog>` opened with `showModal()`: traps focus, makes the page inert and
 * closes on Escape. Focus returns to whatever opened it.
 */
function Modal({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement as HTMLElement | null;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={labelledBy}
      onClose={() => {
        onClose();
        opener.current?.focus();
      }}
    >
      {open && children}
    </dialog>
  );
}

function ConfirmDialog({
  request,
  onDone,
}: {
  request: ConfirmRequest | null;
  onDone: () => void;
}) {
  const id = useId();
  return (
    <Modal open={request !== null} onClose={onDone} labelledBy={`${id}-t`}>
      {request && (
        <>
          <h2 id={`${id}-t`} className={styles.dialogTitle}>
            {request.title}
          </h2>
          <div className={styles.dialogBody}>{request.body}</div>
          <div className={styles.dialogActions}>
            <button
              type="button"
              className={cx(styles.button, styles.buttonGhost)}
              onClick={onDone}
            >
              Hætta við
            </button>
            <button
              type="button"
              className={cx(
                styles.button,
                request.tone === "danger" ? styles.buttonDanger : styles.buttonPrimary
              )}
              onClick={() => {
                request.onConfirm();
                onDone();
              }}
            >
              {request.confirmLabel}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
