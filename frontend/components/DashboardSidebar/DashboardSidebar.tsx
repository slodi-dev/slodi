"use client";

/**
 * The app's side nav (B · Groups, picked in Lab/Sidebar on 2026-10-20): the items sorted under
 * headings, the active item a solid pill that slides to the new item when the page changes.
 * Collapsed, it shows icons only, with short rules standing in for the headings and each label
 * as a tip on hover or keyboard focus. On a phone it sits in AppShell's drawer and never
 * collapses. Rationale: AppShell.mdx.
 */

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BarChart3,
  Calendar,
  Hammer,
  Home,
  LayoutDashboard,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  ShieldCheck,
  Tags,
  User,
} from "lucide-react";
import {
  type UserPermissions,
  hasPermission as hasPlatformPermission,
} from "@/services/users.service";
import styles from "./DashboardSidebar.module.css";

type WorkspaceRole = "leader" | "editor" | "admin";

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Minimum workspace role. */
  roleRequired?: "admin" | "editor";
  /**
   * Minimum *platform* permission. Distinct from roleRequired, which is a workspace role:
   * Yfirferð and Merkimiðar belong to Dagskrárstjórnarteymið whichever workspaces they are in.
   */
  permissionRequired?: UserPermissions;
  /** Not built yet: shown, marked "Kemur síðar", not a link. */
  disabled?: boolean;
}

interface NavGroup {
  id: string;
  /** Shown when expanded; screen-reader only when collapsed, where a short rule stands in. */
  heading?: string;
  /** Pinned to the bottom of the nav. */
  bottom?: boolean;
  items: NavItem[];
}

/**
 * The admin group is "Umsjón" so that "Stjórnun" stays the name of one item, the same word as
 * the heading of the page it opens. The personal group is "Mínar síður", the phrase Icelandic
 * sites use for your own account pages, in the same voice as "Merkin mín".
 */
const NAV_GROUPS: NavGroup[] = [
  { id: "home", items: [{ label: "Slóði", path: "/", icon: Home }] },
  {
    id: "plan",
    heading: "Skipuleggja",
    items: [
      { label: "Stjórnborð", path: "/dashboard", icon: LayoutDashboard },
      {
        label: "Vinnubekkurinn",
        path: "/builder",
        icon: Hammer,
        roleRequired: "editor",
        disabled: true,
      },
      { label: "Veggurinn", path: "/social", icon: MessageSquare, disabled: true },
    ],
  },
  {
    id: "bank",
    heading: "Bankinn",
    items: [
      { label: "Dagskrárbankinn", path: "/programs", icon: Calendar },
      // Merkimiðar, not "Flokkar": "flokkar" is already the patrol filter in the bank. The
      // permission must stay in step with the guard inside TagManagement.
      { label: "Merkimiðar", path: "/tags", icon: Tags, permissionRequired: "moderator" },
      { label: "Yfirferð", path: "/yfirferd", icon: ShieldCheck, permissionRequired: "moderator" },
    ],
  },
  {
    id: "admin",
    heading: "Umsjón",
    items: [
      { label: "Greining", path: "/analytics", icon: BarChart3, disabled: true },
      // Platform permission, the same check UserManagement guards itself with, so a workspace
      // admin never sees a link that then refuses them.
      { label: "Stjórnun", path: "/admin", icon: Shield, permissionRequired: "admin" },
    ],
  },
  {
    id: "you",
    heading: "Mínar síður",
    bottom: true,
    items: [
      { label: "Prófíll", path: "/profile", icon: User, disabled: true },
      { label: "Stillingar", path: "/settings", icon: Settings },
      { label: "Merkin mín", path: "/badges", icon: Award, disabled: true },
    ],
  },
];

function canSee(item: NavItem, role: WorkspaceRole, permissions: UserPermissions | undefined) {
  if (item.permissionRequired && !hasPlatformPermission(permissions, item.permissionRequired)) {
    return false;
  }
  if (item.roleRequired === "admin") return role === "admin";
  if (item.roleRequired === "editor") return role === "editor" || role === "admin";
  return true;
}

/** "/" matches only itself (it used to be a bare `startsWith`, so Slóði was current on every
 * page); the rest match the path or a sub-route. */
export function isActivePath(pathname: string, path: string) {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Where the sliding pill goes: the active item, in the coordinates of the scrolling body. */
interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Measures the pill's box, again whenever the active page or the nav's size changes. */
function useMarkerBox(
  bodyRef: React.RefObject<HTMLElement | null>,
  activePath: string,
  collapsed: boolean,
  itemCount: number
) {
  const [marker, setMarker] = useState<Box | null>(null);

  const measure = useCallback(() => {
    const body = bodyRef.current;
    const active = body?.querySelector('[aria-current="page"]');
    if (!body || !active) {
      setMarker(null);
      return;
    }
    const origin = body.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    setMarker({
      top: rect.top - origin.top + body.scrollTop,
      left: rect.left - origin.left + body.scrollLeft,
      width: rect.width,
      height: rect.height,
    });
  }, [bodyRef]);

  useLayoutEffect(measure, [measure, activePath, collapsed, itemCount]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, [bodyRef, measure]);

  return marker;
}

function NavEntry({
  item,
  active,
  badge,
  badgePops,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  badge: number;
  /** Whether the count has changed since the nav mounted, so a new count pops in. */
  badgePops: boolean;
  onNavigate?: (path: string) => void;
}) {
  const Icon = item.icon;
  const content = (
    <>
      <span className={styles.icon} aria-hidden="true">
        <Icon />
        {badge > 0 && (
          // Keyed on the count, so each new count mounts afresh and replays the pop.
          <span key={badge} className={`${styles.badge} ${badgePops ? styles.badgePop : ""}`}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      {/* The label is also the collapsed tip, so the reason and the count go with it. */}
      <span className={styles.label}>
        {item.label}
        {item.disabled && <span className={styles.labelSoon}>, kemur síðar</span>}
        {badge > 0 && <span className="sl-sr-only">, {badge} ný</span>}
      </span>
      {item.disabled && (
        <span className={styles.soon} aria-hidden="true">
          Kemur síðar
        </span>
      )}
    </>
  );

  if (item.disabled) {
    // A link that isn't one yet: focusable, so the "kemur síðar" tip can also be reached from
    // the keyboard when collapsed, and announced as a dimmed link.
    return (
      <span
        className={`${styles.item} ${styles.disabled}`}
        role="link"
        aria-disabled="true"
        tabIndex={0}
      >
        {content}
      </span>
    );
  }
  return (
    <Link
      href={item.path}
      className={`${styles.item} ${active ? styles.active : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={() => onNavigate?.(item.path)}
    >
      {content}
    </Link>
  );
}

export interface DashboardSidebarProps {
  /** Workspace role, for the items behind `roleRequired`. */
  userRole?: WorkspaceRole;
  /** Platform permission, for the moderator- and admin-only items. */
  userPermissions?: UserPermissions;
  /** Unread count on Merkin mín. */
  badgeCount?: number;
  /** Icons only. AppShell decides it (by width, then by the user's toggle). */
  collapsed?: boolean;
  /** Called with the new state when the collapse toggle is pressed. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Whether the user has toggled since load; the labels fade in only after a real toggle. */
  toggled?: boolean;
  /** Id of the element the collapse toggle resizes. */
  controls?: string;
  /** Accessible name of the nav. */
  navLabel?: string;
  /** Overrides `usePathname()`, so a story can move the active page without a router. */
  activePath?: string;
  /** Called with the item's path when a nav link is clicked (AppShell closes the drawer). */
  onNavigate?: (path: string) => void;
}

export default function DashboardSidebar({
  userRole = "leader",
  userPermissions,
  badgeCount = 0,
  collapsed = false,
  onCollapsedChange,
  toggled = false,
  controls,
  navLabel = "Aðalvalmynd",
  activePath,
  onNavigate,
}: DashboardSidebarProps) {
  const routerPath = usePathname();
  const pathname = activePath ?? routerPath ?? "/";
  const uid = useId();

  /*
   * Permissions arrive from an async fetch, so the server renders the nav without them and the
   * client may render it with them: different markup for the same tree, which React reports as
   * a hydration mismatch. Holding the gated items back until after mount makes the first client
   * paint match the server's. Until the fetch lands nobody knows whether this is a moderator.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // The badge pops only when its count changes after mount, not on the first paint.
  const [shownBadge, setShownBadge] = useState(badgeCount);
  const [badgePops, setBadgePops] = useState(false);
  if (shownBadge !== badgeCount) {
    setShownBadge(badgeCount);
    setBadgePops(true);
  }

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => (!item.permissionRequired || mounted) && canSee(item, userRole, userPermissions)
    ),
  })).filter((group) => group.items.length > 0);
  const itemCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  const bodyRef = useRef<HTMLDivElement>(null);
  const marker = useMarkerBox(bodyRef, pathname, collapsed, itemCount);
  // The pill slides only once it has been placed, so it doesn't fly in from the corner.
  const [markerPlaced, setMarkerPlaced] = useState(false);
  const hasMarker = Boolean(marker);
  useEffect(() => {
    if (!hasMarker || markerPlaced) return;
    const frame = requestAnimationFrame(() => setMarkerPlaced(true));
    return () => cancelAnimationFrame(frame);
  }, [hasMarker, markerPlaced]);

  // The visible text is the accessible name, so speech control can say what it sees.
  const toggleLabel = collapsed ? "Stækka valmynd" : "Minnka valmynd";
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <nav
      aria-label={navLabel}
      className={styles.sidebar}
      data-collapsed={collapsed}
      data-toggled={toggled}
      data-marker={markerPlaced && hasMarker ? "placed" : undefined}
    >
      <div ref={bodyRef} className={styles.body}>
        {marker && (
          <span
            className={styles.marker}
            aria-hidden="true"
            style={{
              width: marker.width,
              height: marker.height,
              transform: `translate(${marker.left}px, ${marker.top}px)`,
            }}
          />
        )}
        {groups.map((group) => {
          const headingId = `${uid}-${group.id}`;
          return (
            <div
              key={group.id}
              className={`${styles.group} ${group.bottom ? styles.groupBottom : ""}`}
              data-group={group.id}
            >
              {group.heading && (
                <h2 id={headingId} className={styles.heading}>
                  {group.heading}
                </h2>
              )}
              <ul className={styles.list} aria-labelledby={group.heading ? headingId : undefined}>
                {group.items.map((item) => (
                  <li key={item.path}>
                    <NavEntry
                      item={item}
                      active={isActivePath(pathname, item.path)}
                      badge={item.path === "/badges" ? badgeCount : 0}
                      badgePops={badgePops}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div className={styles.foot}>
        <button
          type="button"
          className={styles.item}
          onClick={() => onCollapsedChange?.(!collapsed)}
          aria-expanded={!collapsed}
          aria-controls={controls}
        >
          <span className={styles.icon} aria-hidden="true">
            <ToggleIcon />
          </span>
          <span className={styles.label}>{toggleLabel}</span>
        </button>
      </div>
    </nav>
  );
}
