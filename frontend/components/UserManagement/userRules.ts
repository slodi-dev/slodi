/**
 * Rules and copy for the user-management page: role names, who can be changed,
 * search, filter and counts, the URL, and the one message for each failure.
 */
import { compareIs, foldIs } from "@/lib/icelandic-text";
import { UserRequestError, type User, type UserPermissions } from "@/services/users.service";
import type { WorkspaceRole } from "@/services/workspaces.service";

/* ── Platform permission ── */

export const PERMISSION_RANK: Record<UserPermissions, number> = {
  viewer: 0,
  member: 1,
  moderator: 2,
  admin: 3,
};

/**
 * Lowest first, the order the panel offers them in. `admin` is not offered:
 * platform admin comes only from ADMIN_EMAILS, and the API refuses to grant or
 * remove it (sc-535).
 */
export const GRANTABLE_PERMISSIONS: UserPermissions[] = ["viewer", "member", "moderator"];

export const PERMISSION_LABEL: Record<UserPermissions, string> = {
  viewer: "Skoðandi",
  member: "Meðlimur",
  // Dagskrárstjórnarteymið. Named for the job rather than the rank, because
  // "Umsjónarmaður" is what the role is called in the movement.
  moderator: "Umsjónarmaður dagskrár",
  admin: "Stjórnandi",
};

/** For the middle of a sentence: "Anna er nú meðlimur." */
export const PERMISSION_LABEL_LOWER: Record<UserPermissions, string> = {
  viewer: "skoðandi",
  member: "meðlimur",
  moderator: "umsjónarmaður dagskrár",
  admin: "stjórnandi",
};

/** The filter chips. */
export const PERMISSION_PLURAL: Record<UserPermissions, string> = {
  viewer: "Skoðendur",
  member: "Meðlimir",
  moderator: "Umsjónarmenn dagskrár",
  admin: "Stjórnendur",
};

export const PERMISSION_DESCRIPTION: Record<UserPermissions, string> = {
  viewer: "Getur skoðað dagskrárbankann.",
  member: "Getur sett inn og breytt eigin efni.",
  moderator: "Getur falið og hafnað hvaða efni sem er í bankanum.",
  admin: "Hefur fullan aðgang að notendum og stillingum.",
};

/** UX rule 5: a promotion to moderator or above always confirms first. */
export function permissionNeedsConfirm(from: UserPermissions, to: UserPermissions): boolean {
  return (
    PERMISSION_RANK[to] >= PERMISSION_RANK.moderator && PERMISSION_RANK[to] > PERMISSION_RANK[from]
  );
}

/* ── Role in the shared programme bank (the default workspace) ── */

/** `owner` is shown but never offered: ownership is transferred, not set here. */
export const GRANTABLE_BANK_ROLES: WorkspaceRole[] = ["viewer", "editor", "admin"];

export const BANK_ROLE_LABEL: Record<WorkspaceRole, string> = {
  viewer: "Skoðandi",
  editor: "Ritstjóri",
  admin: "Stjórnandi",
  owner: "Eigandi",
};

export const BANK_ROLE_LABEL_LOWER: Record<WorkspaceRole, string> = {
  viewer: "skoðandi",
  editor: "ritstjóri",
  admin: "stjórnandi",
  owner: "eigandi",
};

export const BANK_ROLE_DESCRIPTION: Record<WorkspaceRole, string> = {
  viewer: "Getur skoðað efnið í bankanum.",
  editor: "Getur sett inn efni og breytt eigin efni í bankanum.",
  admin: "Getur breytt öllu efni og réttindum annarra í bankanum.",
  owner: "Á bankann.",
};

/** UX rule 5: making someone a bank admin confirms first. */
export function bankRoleNeedsConfirm(from: WorkspaceRole | null, to: WorkspaceRole): boolean {
  return to === "admin" && from !== "admin" && from !== "owner";
}

/* ── Who can be changed ── */

/** The admin's own account and other platform admins can't be changed from this page. */
export function isLocked(user: User, currentUserId: string | undefined): boolean {
  return user.id === currentUserId || user.permissions === "admin";
}

/* ── Search, filter, order, counts ── */

export type PermissionFilter = UserPermissions | "all";
export const PERMISSION_FILTERS: PermissionFilter[] = [
  "all",
  "viewer",
  "member",
  "moderator",
  "admin",
];

/** Users whose name or email contains the search text, ignoring case and accents. */
export function searchUsers(users: User[], query: string): User[] {
  const q = foldIs(query.trim());
  return q ? users.filter((u) => foldIs(`${u.name} ${u.email}`).includes(q)) : users;
}

/** How many of `users` have each permission, and all of them. */
export function countByPermission(users: User[]): Record<PermissionFilter, number> {
  const counts: Record<PermissionFilter, number> = {
    all: users.length,
    viewer: 0,
    member: 0,
    moderator: 0,
    admin: 0,
  };
  for (const u of users) counts[u.permissions] += 1;
  return counts;
}

/** The list as shown: the filter applied, in Icelandic order by name. */
export function filterUsers(users: User[], permission: PermissionFilter): User[] {
  const list = permission === "all" ? users : users.filter((u) => u.permissions === permission);
  return [...list].sort((a, b) => compareIs(a.name, b.name));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/* ── The URL (UX rule 10) ── */

export interface ListState {
  query: string;
  permission: PermissionFilter;
  /** 1-based. */
  page: number;
  selectedId: string | null;
}

function isPermissionFilter(value: string | null): value is PermissionFilter {
  return value !== null && (PERMISSION_FILTERS as string[]).includes(value);
}

/** Reads `?q=&rettindi=&sida=&notandi=`, falling back to the defaults for anything invalid. */
export function readListState(params: URLSearchParams): ListState {
  const rawPermission = params.get("rettindi");
  const page = Number(params.get("sida"));
  return {
    query: params.get("q") ?? "",
    permission: isPermissionFilter(rawPermission) ? rawPermission : "all",
    page: Number.isInteger(page) && page > 1 ? page : 1,
    selectedId: params.get("notandi") || null,
  };
}

/** `/admin?q=jon&rettindi=member&sida=2&notandi=…`, leaving out what is at its default. */
export function listStateUrl(pathname: string, state: ListState): string {
  const params = new URLSearchParams();
  if (state.query.trim()) params.set("q", state.query.trim());
  if (state.permission !== "all") params.set("rettindi", state.permission);
  if (state.page > 1) params.set("sida", String(state.page));
  if (state.selectedId) params.set("notandi", state.selectedId);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/* ── Errors (UX rule 3) ── */

export type UserAction = "load" | "permission" | "bankRole" | "delete";

const FAILED: Record<UserAction, string> = {
  load: "Ekki tókst að sækja notendur.",
  permission: "Ekki tókst að vista réttindin.",
  bankRole: "Ekki tókst að vista aðganginn að dagskrárbankanum.",
  delete: "Ekki tókst að eyða notandanum.",
};

/** The HTTP status of a failed request; the workspace service puts it in its message. */
function statusOf(err: unknown): number {
  if (err instanceof UserRequestError) return err.status;
  const match = err instanceof Error ? err.message.match(/: (\d{3})\b/) : null;
  return match ? Number(match[1]) : 0;
}

/**
 * The one Icelandic message for a failed request, chosen from the HTTP status.
 * The backend's English `detail` is never shown as the message.
 */
export function userErrorMessage(err: unknown, action: UserAction): string {
  switch (statusOf(err)) {
    case 403:
      return `${FAILED[action]} Þú hefur ekki heimild til þess.`;
    case 404:
      return `${FAILED[action]} Notandinn er ekki lengur til. Endurhlaðaðu síðuna.`;
    case 400:
    case 409:
    case 422:
      return `${FAILED[action]} Kerfið leyfir ekki þessa breytingu.`;
    case 0:
      return `${FAILED[action]} Athugaðu nettenginguna og reyndu aftur.`;
    default:
      return `${FAILED[action]} Reyndu aftur eftir smástund.`;
  }
}
