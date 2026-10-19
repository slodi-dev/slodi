"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BarChart3,
  Calendar,
  Hammer,
  Home,
  LayoutDashboard,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  ShieldCheck,
  Tags,
  User,
  X,
} from "lucide-react";
import {
  type UserPermissions,
  hasPermission as hasPlatformPermission,
} from "@/services/users.service";
import { useDrawerFocus } from "@/hooks/useDrawerFocus";
import styles from "./SidebarLab.module.css";

export type SidebarLook = "rail" | "groups" | "trail" | "night" | "topbar";

export interface SidebarLabProps {
  /** Which lab variation to render. */
  look: SidebarLook;
  userRole?: "leader" | "editor" | "admin";
  userPermissions?: UserPermissions;
  /** Unread count on Merkin mín. */
  badgeCount?: number;
  /** Initial desktop state. Ignored at phone width, where the nav is a drawer. */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Initial phone state: whether the drawer starts open. */
  drawerOpen?: boolean;
  /** Accessible name of the nav. Only needs changing when several are on one page. */
  navLabel?: string;
  /** The page beside the nav. */
  children?: React.ReactNode;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roleRequired?: "admin" | "editor";
  permissionRequired?: UserPermissions;
  disabled?: boolean;
}

interface NavGroup {
  id: string;
  /** Section heading. Shown in the groups look, screen-reader only in the others. */
  heading?: string;
  /** Pinned to the bottom of the nav. */
  bottom?: boolean;
  items: NavItem[];
}

/**
 * The items and gates of `components/DashboardSidebar`, sorted into the three groups the
 * user suggested (Skipuleggja / Bankinn / Stjórnun) plus the personal items at the bottom.
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
      { label: "Merkimiðar", path: "/tags", icon: Tags, permissionRequired: "moderator" },
      { label: "Yfirferð", path: "/yfirferd", icon: ShieldCheck, permissionRequired: "moderator" },
    ],
  },
  {
    id: "admin",
    heading: "Stjórnun",
    items: [
      { label: "Greining", path: "/analytics", icon: BarChart3, disabled: true },
      { label: "Stjórnun", path: "/admin", icon: Shield, permissionRequired: "admin" },
    ],
  },
  {
    id: "you",
    heading: "Þú",
    bottom: true,
    items: [
      { label: "Prófíll", path: "/profile", icon: User, disabled: true },
      { label: "Stillingar", path: "/settings", icon: Settings },
      { label: "Merkin mín", path: "/badges", icon: Award, disabled: true },
    ],
  },
];

/** Below this shell width the nav is a drawer. Matches the 767px breakpoint in the CSS. */
const PHONE_MAX = 767;

function canSee(
  item: NavItem,
  role: SidebarLabProps["userRole"],
  permissions: UserPermissions | undefined
) {
  if (item.permissionRequired && !hasPlatformPermission(permissions, item.permissionRequired)) {
    return false;
  }
  if (item.roleRequired === "admin") return role === "admin";
  if (item.roleRequired === "editor") return role === "editor" || role === "admin";
  return true;
}

/**
 * "/" matches only itself, the rest match the path or a sub-route. The real sidebar uses a
 * bare `startsWith`, so Slóði ("/") is marked active on every page.
 */
function isActivePath(pathname: string, path: string) {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Tracks whether the shell is phone-width, so the drawer's focus trap runs only there. */
function useIsPhone(ref: React.RefObject<HTMLElement | null>) {
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setIsPhone(entry.contentRect.width <= PHONE_MAX);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return isPhone;
}

function NavEntry({
  item,
  active,
  badge,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  badge: number;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const content = (
    <>
      <span className={styles.icon} aria-hidden="true">
        <Icon />
        {badge > 0 && <span className={styles.badge}>{badge}</span>}
      </span>
      <span className={styles.label}>
        {item.label}
        {item.disabled && <span className="sl-sr-only">, kemur síðar</span>}
        {badge > 0 && <span className="sl-sr-only">, {badge} ný</span>}
      </span>
      {item.disabled && (
        <span className={styles.soon} aria-hidden="true">
          Kemur síðar
        </span>
      )}
      {/* Only the trail look shows it; aria-current already says it to screen readers. */}
      {active && (
        <span className={styles.here} aria-hidden="true">
          Þú ert hér
        </span>
      )}
    </>
  );

  if (item.disabled) {
    return (
      <span className={`${styles.item} ${styles.disabled}`} aria-disabled="true">
        {content}
      </span>
    );
  }
  return (
    <Link
      href={item.path}
      className={`${styles.item} ${active ? styles.active : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      {content}
    </Link>
  );
}

/**
 * Lab copy of `components/DashboardSidebar` together with the drawer and menu button from
 * `DashboardLayout` / `MobileMenuButton`, plus `look`. It renders the whole shell (nav and
 * page) because the phone drawer, the menu button and the page padding belong together.
 *
 * Phone or desktop is decided by the width of the shell (a container query), not of the
 * window, so a phone-sized frame shows the drawer and menu button even in a wide Storybook.
 */
export default function SidebarLab({
  look,
  userRole = "leader",
  userPermissions,
  badgeCount = 0,
  collapsed = false,
  onCollapsedChange,
  drawerOpen = false,
  navLabel = "Aðalvalmynd",
  children,
}: SidebarLabProps) {
  const pathname = usePathname() ?? "/";
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [open, setOpen] = useState(drawerOpen);

  const shellRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const isPhone = useIsPhone(shellRef);
  const drawerActive = open && isPhone;

  const close = useCallback(() => setOpen(false), []);
  useDrawerFocus({
    open: drawerActive,
    containerRef: drawerRef,
    triggerRef: menuButtonRef,
    onClose: close,
    includeTrigger: true,
  });

  const uid = useId();
  const drawerId = `${uid}-drawer`;
  const contentId = `${uid}-content`;

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    onCollapsedChange?.(next);
  };

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canSee(item, userRole, userPermissions)),
  })).filter((group) => group.items.length > 0);

  const activeLabel = groups
    .flatMap((group) => group.items)
    .find((item) => isActivePath(pathname, item.path))?.label;

  const renderGroup = (group: NavGroup) => {
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
                onNavigate={close}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const toggleLabel = isCollapsed ? "Stækka valmynd" : "Minnka valmynd";
  const ToggleIcon = isCollapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <div
      ref={shellRef}
      className={`${styles.shell} ${styles[look]}`}
      data-collapsed={isCollapsed}
      data-open={open}
    >
      <div className={styles.layout}>
        <a href={`#${contentId}`} className={styles.skipLink}>
          Sleppa í efni
        </a>

        <div className={styles.phoneBar}>
          <button
            ref={menuButtonRef}
            type="button"
            className={styles.menuButton}
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={drawerId}
            aria-label={open ? "Loka valmynd" : "Opna valmynd"}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
          {look === "topbar" && (
            <p className={styles.barTitle}>
              <span className={styles.barBrand}>Slóði</span>
              {activeLabel && activeLabel !== "Slóði" && (
                <span className={styles.barPage}>{activeLabel}</span>
              )}
            </p>
          )}
        </div>

        <div ref={drawerRef} id={drawerId} className={styles.drawer}>
          <nav aria-label={navLabel} className={styles.nav}>
            <div className={styles.navBody}>{groups.map(renderGroup)}</div>
            <div className={styles.navFoot}>
              <button
                type="button"
                className={styles.item}
                onClick={toggleCollapsed}
                aria-expanded={!isCollapsed}
                aria-controls={drawerId}
              >
                <span className={styles.icon} aria-hidden="true">
                  <ToggleIcon />
                </span>
                <span className={styles.label}>{toggleLabel}</span>
              </button>
            </div>
          </nav>
        </div>

        {open && <div className={styles.backdrop} onClick={close} aria-hidden="true" />}

        <div id={contentId} className={styles.content} tabIndex={-1}>
          {children}
        </div>
      </div>
    </div>
  );
}
