import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode, RefObject } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { countIs, formatIcelandicDate, formatIcelandicDateTime } from "@/lib/format";
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
}

/** The API `User`, plus what a user-management screen needs and the API doesn't have yet. */
export interface LabUser extends Pick<User, "id" | "name" | "email" | "permissions"> {
  status: "active" | "suspended";
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
}

interface Toast {
  key: number;
  message: string;
  undo?: () => void;
}

function useUserManagement(props: UserManagementLabProps) {
  const { currentUserId, pageSize = 10, onUrlChange } = props;
  const [users, setUsers] = useState(props.users);
  const [query, setQuery] = useState(props.defaultQuery ?? "");
  const [permission, setPermission] = useState<PermissionFilter>(props.defaultPermission ?? "all");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });
  const [selectedId, setSelectedId] = useState<string | null>(props.defaultSelectedId ?? null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

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
          {promotes && (
            <p>Umsjónarmenn dagskrár geta falið og hafnað hvaða efni sem er í dagskrárbankanum.</p>
          )}
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
  const rootRef = useRef<HTMLDivElement>(null);

  let body: ReactNode;
  if (state === "loading") body = <Skeleton look={look} />;
  else if (state === "error")
    body = <LoadError detail={props.errorDetail} onRetry={props.onRetry} />;
  else if (props.users.length === 0) body = <NoUsers />;
  else if (m.filtered.length === 0) body = <NoMatch onReset={m.resetFilters} query={m.query} />;
  else if (look === "tafla") body = <TableLook m={m} />;
  else if (look === "spjold") body = <CardsLook m={m} />;
  else if (look === "skipt") body = <SplitLook m={m} rootRef={rootRef} />;
  else body = <BulkLook m={m} />;

  const showSummary = ready && props.users.length > 0;

  return (
    <div ref={rootRef} className={cx(styles.root, styles[look])} aria-busy={state === "loading"}>
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
      <ConfirmDialog request={m.confirm} onDone={() => m.setConfirm(null)} />
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
      {users.length > shown.length && <li>og {users.length - shown.length} til viðbótar</li>}
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

function SplitLook({ m, rootRef }: { m: Model; rootRef: RefObject<HTMLDivElement | null> }) {
  const selected = m.users.find((u) => u.id === m.selectedId) ?? null;
  const [focusDetail, setFocusDetail] = useState(false);

  const back = () => {
    const id = m.selectedId;
    m.setSelectedId(null);
    requestAnimationFrame(() =>
      rootRef.current?.querySelector<HTMLElement>(`[data-user-id="${id}"]`)?.focus()
    );
  };

  return (
    <div className={styles.split} data-has-selection={selected ? "true" : undefined}>
      <ul className={styles.splitList} aria-label="Notendalisti">
        {m.visible.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              data-user-id={u.id}
              className={styles.splitItem}
              aria-current={u.id === m.selectedId ? "true" : undefined}
              onClick={() => {
                m.setSelectedId(u.id);
                setFocusDetail(true);
              }}
            >
              <Avatar name={u.name} />
              <span className={styles.splitWho}>
                <span className={styles.name}>
                  {u.name}
                  {m.isSelf(u) && <SelfBadge />}
                </span>
                <span className={styles.email}>{u.email}</span>
                <span className={styles.splitRole}>
                  {LABEL[u.permissions]}
                  {u.status === "suspended" && " · Frystur"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
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
          <p className={styles.detailEmpty}>
            Veldu notanda úr listanum til að sjá réttindi, aðgang og sögu.
          </p>
        )}
      </div>
    </div>
  );
}

function UserDetail({
  m,
  user,
  onBack,
  focusOnMount,
}: {
  m: Model;
  user: LabUser;
  onBack: () => void;
  focusOnMount: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState<UserPermissions | null>(null);
  const value = draft ?? user.permissions;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  // On a phone the panel replaces the list, so focus follows it there.
  useEffect(() => {
    if (focusOnMount && backRef.current?.offsetParent) headingRef.current?.focus();
  }, [focusOnMount]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.changeRole([user.id], value);
    setDraft(null);
  };

  const suspended = user.status === "suspended";

  return (
    <article className={styles.detailCard} aria-labelledby={`${id}-h`}>
      <button
        ref={backRef}
        type="button"
        className={cx(styles.button, styles.buttonGhost, styles.backButton)}
        onClick={onBack}
      >
        <ArrowLeft aria-hidden="true" className={styles.buttonIcon} />
        Til baka í lista
      </button>
      <header className={styles.detailHead}>
        <Avatar name={user.name} />
        <div className={styles.cardWho}>
          <h2 id={`${id}-h`} ref={headingRef} tabIndex={-1} className={styles.detailName}>
            {user.name}
            {m.isSelf(user) && <SelfBadge />}
          </h2>
          <p className={styles.email}>{user.email}</p>
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
        <div>
          <dt>Staða</dt>
          <dd>
            <StatusBadge user={user} />
          </dd>
        </div>
      </dl>

      <section className={styles.detailSection} aria-labelledby={`${id}-r`}>
        <h3 id={`${id}-r`} className={styles.sectionTitle}>
          Réttindi
        </h3>
        {m.isLocked(user) ? (
          <p className={styles.lockedNote}>
            <strong>{LABEL[user.permissions]}.</strong>{" "}
            {m.isSelf(user)
              ? "Þú getur ekki breytt eigin réttindum. Annar stjórnandi þarf að gera það."
              : "Stjórnendur eru skilgreindir í stillingum kerfisins og þeim er ekki breytt hér."}
          </p>
        ) : (
          <form onSubmit={submit} className={styles.roleForm}>
            <fieldset className={styles.radios}>
              <legend className={styles.srOnly}>Réttindi {user.name}</legend>
              {GRANTABLE.map((p) => (
                <label key={p} className={cx(styles.radio, value === p && styles.radioChecked)}>
                  <input
                    type="radio"
                    name={`${id}-perm`}
                    value={p}
                    checked={value === p}
                    onChange={() => setDraft(p)}
                  />
                  <span>
                    <span className={styles.radioLabel}>{LABEL[p]}</span>
                    <span className={styles.radioHint}>{DESCRIPTION[p]}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <button type="submit" className={cx(styles.button, styles.buttonPrimary)}>
              Vista réttindi
            </button>
          </form>
        )}
      </section>

      {!m.isLocked(user) && (
        <section className={styles.detailSection} aria-labelledby={`${id}-a`}>
          <h3 id={`${id}-a`} className={styles.sectionTitle}>
            Aðgangur
          </h3>
          <p className={styles.sectionText}>
            {suspended
              ? "Aðgangurinn er frystur. Notandinn kemst ekki inn, en efnið er óbreytt."
              : "Ef þú frystir aðganginn kemst notandinn ekki inn fyrr en hann er virkjaður aftur. Efnið helst óbreytt."}
          </p>
          <button
            type="button"
            className={cx(
              styles.button,
              suspended ? styles.buttonSecondary : styles.buttonDangerQuiet
            )}
            onClick={() => m.setSuspended([user.id], !suspended)}
          >
            {suspended ? "Virkja aðgang aftur" : "Frysta aðgang"}
          </button>
        </section>
      )}

      <section className={styles.detailSection} aria-labelledby={`${id}-s`}>
        <h3 id={`${id}-s`} className={styles.sectionTitle}>
          Saga
        </h3>
        {user.history.length === 0 ? (
          <p className={styles.sectionText}>Engar breytingar skráðar.</p>
        ) : (
          <ol className={styles.history}>
            {[...user.history].reverse().map((h, i) => (
              <li key={`${h.at}-${i}`}>
                <time dateTime={h.at} className={styles.historyTime}>
                  {formatIcelandicDateTime(h.at)}
                </time>
                <span>{h.text}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}

/* ── D · Val: checkbox rows with bulk actions ──────────────────────────────── */

function BulkLook({ m }: { m: Model }) {
  const id = useId();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState<UserPermissions>("member");
  const allRef = useRef<HTMLInputElement>(null);

  const selectable = m.visible.filter((u) => !m.isLocked(u));
  // Act only on what can be seen: a selection hidden by a later filter is ignored.
  const targets = m.filtered.filter((u) => chosen.has(u.id)).map((u) => u.id);
  const onPage = selectable.filter((u) => chosen.has(u.id)).length;
  const all = selectable.length > 0 && onPage === selectable.length;
  const some = onPage > 0 && !all;

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = some;
  }, [some]);

  const toggle = (uid: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  const toggleAll = () =>
    setChosen((prev) => {
      const next = new Set(prev);
      for (const u of selectable) {
        if (all) next.delete(u.id);
        else next.add(u.id);
      }
      return next;
    });

  const none = targets.length === 0;

  return (
    <div className={styles.bulk}>
      <div className={styles.bulkBar}>
        <label className={styles.checkLabel}>
          <input
            ref={allRef}
            type="checkbox"
            className={styles.checkbox}
            checked={all}
            onChange={toggleAll}
          />
          Velja alla á síðunni
        </label>
        <p className={styles.bulkCount} aria-live="polite">
          {none
            ? "Veldu notendur til að breyta þeim."
            : countIs(targets.length, "notandi valinn", "notendur valdir")}
        </p>
        <div className={styles.bulkActions}>
          <div className={styles.inlineField}>
            <label htmlFor={`${id}-role`} className={styles.fieldLabel}>
              Ný réttindi
            </label>
            <select
              id={`${id}-role`}
              className={styles.select}
              value={bulkRole}
              onChange={(e) => setBulkRole(e.target.value as UserPermissions)}
            >
              {GRANTABLE.map((p) => (
                <option key={p} value={p}>
                  {LABEL[p]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={cx(styles.button, styles.buttonPrimary)}
              disabled={none}
              onClick={() => m.changeRole(targets, bulkRole)}
            >
              Breyta réttindum
            </button>
          </div>
          <button
            type="button"
            className={cx(styles.button, styles.buttonDangerQuiet)}
            disabled={none}
            onClick={() => m.setSuspended(targets, true)}
          >
            Frysta aðgang
          </button>
          <button
            type="button"
            className={cx(styles.button, styles.buttonSecondary)}
            disabled={none}
            onClick={() => m.setSuspended(targets, false)}
          >
            Virkja aftur
          </button>
          {!none && (
            <button
              type="button"
              className={cx(styles.button, styles.buttonGhost)}
              onClick={() => setChosen(new Set())}
            >
              Afvelja
            </button>
          )}
        </div>
      </div>
      <ul className={styles.bulkList}>
        {m.visible.map((u) => {
          const locked = m.isLocked(u);
          const who = (
            <span className={styles.bulkWho}>
              <span className={styles.name}>
                {u.name}
                {m.isSelf(u) && <SelfBadge />}
              </span>
              <span className={styles.email}>{u.email}</span>
            </span>
          );
          return (
            <li key={u.id} className={cx(styles.bulkRow, chosen.has(u.id) && styles.bulkRowChosen)}>
              {locked ? (
                <div className={styles.checkLabel}>
                  <span className={styles.checkSpacer} aria-hidden="true" />
                  {who}
                </div>
              ) : (
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={chosen.has(u.id)}
                    onChange={() => toggle(u.id)}
                  />
                  {who}
                </label>
              )}
              <span className={styles.bulkMeta}>
                <span className={styles.bulkRole}>
                  {LABEL[u.permissions]}
                  {locked && <span className={styles.reason}>{lockReason(m, u)}</span>}
                </span>
                <StatusBadge user={u} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
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

/* ── Confirmation dialog ───────────────────────────────────────────────────── */

/**
 * Native `<dialog>` opened with `showModal()`: traps focus, makes the page inert and
 * closes on Escape. Focus returns to whatever opened it.
 */
function ConfirmDialog({
  request,
  onDone,
}: {
  request: ConfirmRequest | null;
  onDone: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const id = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (request && !d.open) {
      opener.current = document.activeElement as HTMLElement | null;
      d.showModal();
    } else if (!request && d.open) {
      d.close();
    }
  }, [request]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={`${id}-t`}
      onClose={() => {
        onDone();
        opener.current?.focus();
      }}
    >
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
    </dialog>
  );
}
