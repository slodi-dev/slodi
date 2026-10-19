import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { ArrowLeft, Lock, Search, UserRound } from "lucide-react";
import { countIs, formatIcelandicDate } from "@/lib/format";
import type { User, UserPermissions } from "@/services/users.service";
import styles from "./UserManagementLab.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type UserManagementLook = "skipt";
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
  /** The user open in the detail panel. */
  defaultSelectedId?: string;
  pageSize?: number;
  /** Lab only: ids the fake API refuses on the first try, to show a failed save. */
  failIds?: string[];
  /** Lab only: how long the fake API takes, in ms. */
  latencyMs?: number;
  /** Lab only: render just the detail panel of `defaultSelectedId`. */
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

interface ConfirmRequest {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  tone: "primary" | "danger";
  onConfirm: () => void;
  onCancel?: () => void;
}

/** What the (fake) API did with one change. */
type SaveResult = "saved" | "refused";

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
    return [...list].sort((a, b) => compareIs(a.name, b.name));
  }, [matching, permission]);

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

  const nothingChanged = () => setToast({ key: Date.now(), message: "Engin breyting." });

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
   * Sends one change to the (fake) API. If it goes through, the user changes at once and the
   * toast's "Afturkalla" puts them back as they were. A user in `failIds` is refused once.
   */
  const send = async (
    target: LabUser,
    change: (u: LabUser) => LabUser,
    message: string
  ): Promise<SaveResult> => {
    await new Promise((r) => setTimeout(r, latencyMs));
    if (failIds?.includes(target.id) && !refused.current.has(target.id)) {
      refused.current.add(target.id);
      return "refused";
    }
    setUsers((prev) => prev.map((u) => (u.id === target.id ? change(u) : u)));
    setToast({
      key: Date.now(),
      message,
      undo: () => {
        setUsers((prev) => prev.map((u) => (u.id === target.id ? target : u)));
        setToast({ key: Date.now(), message: "Afturkallað." });
      },
    });
    return "saved";
  };

  const changeRole = async (
    id: string,
    to: UserPermissions,
    options: { onStart?: () => void } = {}
  ): Promise<SaveResult | null> => {
    const target = users.find((u) => u.id === id && !isLocked(u) && u.permissions !== to);
    if (!target) {
      nothingChanged();
      return null;
    }
    // UX rule 5: promoting to moderator always confirms.
    if (RANK[to] >= RANK.moderator && RANK[target.permissions] < RANK[to]) {
      const ok = await askConfirm({
        title: "Gera að umsjónarmanni dagskrár?",
        body: (
          <>
            <p>{`${target.name} verður ${LABEL_LOWER[to]}.`}</p>
            <p>{PROMOTE_WARNING}</p>
          </>
        ),
        confirmLabel: "Gera að umsjónarmanni",
        tone: "primary",
      });
      if (!ok) return null;
    }
    options.onStart?.();
    const at = new Date().toISOString();
    return send(
      target,
      (u) => ({
        ...u,
        permissions: to,
        history: [
          ...u.history,
          { at, text: `Réttindi: ${LABEL[u.permissions]} → ${LABEL[to]}`, by: "Þú" },
        ],
      }),
      `${target.name} er nú ${LABEL_LOWER[to]}.`
    );
  };

  /** Reversible, so it happens at once, with "Afturkalla" in the toast. */
  const setSuspended = async (
    id: string,
    suspend: boolean,
    options: { reason?: string; onStart?: () => void } = {}
  ): Promise<SaveResult | null> => {
    const wanted = suspend ? "active" : "suspended";
    const target = users.find((u) => u.id === id && !isLocked(u) && u.status === wanted);
    if (!target) {
      nothingChanged();
      return null;
    }
    options.onStart?.();
    const at = new Date().toISOString();
    const reason = options.reason?.trim() || undefined;
    const verb = suspend ? "frystur" : "virkjaður aftur";
    return send(
      target,
      (u) => ({
        ...u,
        status: suspend ? "suspended" : "active",
        suspension: suspend ? { since: at, reason } : undefined,
        history: [
          ...u.history,
          { at, text: reason ? `Aðgangur ${verb}: ${reason}` : `Aðgangur ${verb}`, by: "Þú" },
        ],
      }),
      `Aðgangur ${verb}: ${target.name}.`
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
  const closeConfirm = () => {
    m.confirm?.onCancel?.();
    m.setConfirm(null);
  };

  if (props.panelOnly) {
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
  if (state === "loading") body = <Skeleton />;
  else if (state === "error")
    body = <LoadError detail={props.errorDetail} onRetry={props.onRetry} />;
  else if (props.users.length === 0) body = <NoUsers />;
  else if (m.filtered.length === 0) body = <NoMatch onReset={m.resetFilters} query={m.query} />;
  else body = <SplitLook m={m} />;

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
    const result = await m.changeRole(user.id, value, { onStart: () => setBusy("role") });
    setBusy(null);
    if (result === "refused") setRoleError("Ekki tókst að vista réttindin. Reyndu aftur.");
    else if (result) setDraft(null);
  };

  const toggleAccess = async (e: FormEvent) => {
    e.preventDefault();
    setAccessError(null);
    const result = await m.setSuspended(user.id, !suspended, {
      reason,
      onStart: () => setBusy("access"),
    });
    setBusy(null);
    if (result === "refused") {
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

/* ── States ────────────────────────────────────────────────────────────────── */

function Skeleton() {
  const rows = Array.from({ length: 6 }, (_, i) => i);
  return (
    <div>
      <p role="status" className={styles.srOnly}>
        Sæki notendur…
      </p>
      <div className={cx(styles.skeleton, styles.skeleton_skipt)} aria-hidden="true">
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
