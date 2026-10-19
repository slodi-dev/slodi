"use client";

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
  /**
   * Overrides `usePathname()` for the active item. Lets a story move the active page without
   * a router, so the motion between items can be watched.
   */
  activePath?: string;
  /** Called with the item's path when a nav link is clicked. */
  onNavigate?: (path: string) => void;
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
 * The items and gates of `components/DashboardSidebar`, sorted into three groups
 * (Skipuleggja / Bankinn / Umsjón) plus the personal items at the bottom.
 *
 * The admin group is "Umsjón" so that "Stjórnun" stays the name of one item, the same word
 * as the heading of the page it opens. The personal group is "Mínar síður", the phrase
 * Icelandic sites use for your own account pages, in the same voice as "Merkin mín".
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
    heading: "Umsjón",
    items: [
      { label: "Greining", path: "/analytics", icon: BarChart3, disabled: true },
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

/** A box in the coordinates of the scrolling nav body, so it scrolls with the items. */
interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface NavGeometry {
  /** Where the sliding marker sits: the active item (groups) or its waypoint (trail). */
  marker: Box | null;
  /** Centres of the waypoints, top to bottom. Trail look only. */
  waypoints: { x: number; y: number }[];
  width: number;
}

/**
 * Measures the active item and the waypoints inside the nav body, and measures again
 * whenever the body resizes, which covers the collapse animation and the phone drawer.
 */
function useNavGeometry(
  bodyRef: React.RefObject<HTMLElement | null>,
  look: SidebarLook,
  activePath: string,
  collapsed: boolean
) {
  const [geometry, setGeometry] = useState<NavGeometry | null>(null);
  const tracks = look === "groups" || look === "trail";

  const measure = useCallback(() => {
    const body = bodyRef.current;
    if (!body || !tracks) return;
    const origin = body.getBoundingClientRect();
    const toBox = (el: Element): Box => {
      const rect = el.getBoundingClientRect();
      return {
        top: rect.top - origin.top + body.scrollTop,
        left: rect.left - origin.left + body.scrollLeft,
        width: rect.width,
        height: rect.height,
      };
    };
    const active = body.querySelector('[aria-current="page"]');
    const markerEl = look === "trail" ? active?.querySelector("[data-waypoint]") : active;
    const waypoints =
      look === "trail"
        ? Array.from(body.querySelectorAll("[data-waypoint]"), (el) => {
            const box = toBox(el);
            return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
          })
        : [];
    setGeometry({
      marker: markerEl ? toBox(markerEl) : null,
      waypoints,
      width: body.clientWidth,
    });
  }, [bodyRef, look, tracks]);

  // Measure again when the active page or the collapsed state changes.
  useLayoutEffect(() => {
    measure();
  }, [measure, activePath, collapsed]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !tracks) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(body);
    return () => observer.disconnect();
  }, [bodyRef, measure, tracks]);

  return geometry;
}

/**
 * The trail through the waypoints. Short legs run straight from marker to marker; a long
 * leg (the climb to the pinned items at the bottom) bows out a little, like a path on a map.
 */
function trailPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  const r = (n: number) => Math.round(n * 10) / 10;
  let d = `M ${r(points[0].x)} ${r(points[0].y)}`;
  points.slice(1).forEach((to, index) => {
    const from = points[index];
    const dy = to.y - from.y;
    const bow = Math.min(Math.max((dy - 72) * 0.1, 0), 10) * (index % 2 ? -1 : 1);
    d +=
      ` C ${r(from.x + bow)} ${r(from.y + dy / 3)},` +
      ` ${r(to.x + bow)} ${r(to.y - dy / 3)}, ${r(to.x)} ${r(to.y)}`;
  });
  return d;
}

/** The dashed trail, drawn in from the top each time it mounts. */
function Trail({ geometry }: { geometry: NavGeometry }) {
  const maskId = `${useId()}-reveal`;
  const d = trailPath(geometry.waypoints);
  if (!d) return null;
  const height = geometry.waypoints[geometry.waypoints.length - 1].y + 2;
  return (
    <svg
      className={styles.trailMap}
      width={geometry.width}
      height={height}
      aria-hidden="true"
      focusable="false"
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" className={styles.trailMask}>
        {/* A solid copy of the path that unrolls, revealing the dashes beneath it. */}
        <path d={d} pathLength={1} className={styles.trailReveal} />
      </mask>
      <path d={d} className={styles.trailCasing} mask={`url(#${maskId})`} />
      <path d={d} className={styles.trailLine} mask={`url(#${maskId})`} />
    </svg>
  );
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
  onNavigate: (path: string) => void;
}) {
  const Icon = item.icon;
  const content = (
    <>
      <span className={styles.icon} aria-hidden="true" data-waypoint="">
        <Icon />
        {badge > 0 && (
          // Keyed on the count, so each new count mounts afresh and replays the pop.
          <span key={badge} className={`${styles.badge} ${badgePops ? styles.badgePop : ""}`}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
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
      onClick={() => onNavigate(item.path)}
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
  activePath,
  onNavigate,
  children,
}: SidebarLabProps) {
  const routerPath = usePathname();
  const pathname = activePath ?? routerPath ?? "/";
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [open, setOpen] = useState(drawerOpen);
  // Set by the first collapse or expand, so the labels fade in only after a real toggle.
  const [toggled, setToggled] = useState(false);
  // Bumped each time the nav opens (drawer or expand), which remounts and redraws the trail.
  const [trailRun, setTrailRun] = useState(0);

  // The badge pops only when its count changes after mount, not on the first paint.
  const [shownBadge, setShownBadge] = useState(badgeCount);
  const [badgePops, setBadgePops] = useState(false);
  if (shownBadge !== badgeCount) {
    setShownBadge(badgeCount);
    setBadgePops(true);
  }

  const shellRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navBodyRef = useRef<HTMLDivElement>(null);
  const isPhone = useIsPhone(shellRef);
  const geometry = useNavGeometry(navBodyRef, look, pathname, isCollapsed);
  // The marker slides only once it has been placed, so it doesn't fly in from the corner.
  const [markerPlaced, setMarkerPlaced] = useState(false);
  const hasMarker = Boolean(geometry?.marker);
  useEffect(() => {
    if (!hasMarker || markerPlaced) return;
    const frame = requestAnimationFrame(() => setMarkerPlaced(true));
    return () => cancelAnimationFrame(frame);
  }, [hasMarker, markerPlaced]);
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
    setToggled(true);
    if (!next) setTrailRun((run) => run + 1);
    onCollapsedChange?.(next);
  };

  const toggleDrawer = () => {
    if (!open) setTrailRun((run) => run + 1);
    setOpen(!open);
  };

  const navigate = (path: string) => {
    close();
    onNavigate?.(path);
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
                badgePops={badgePops}
                onNavigate={navigate}
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
      data-toggled={toggled}
      data-marker={markerPlaced && hasMarker ? "placed" : undefined}
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
            onClick={toggleDrawer}
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
            <div ref={navBodyRef} className={styles.navBody}>
              {look === "trail" && geometry && <Trail key={trailRun} geometry={geometry} />}
              {geometry?.marker && (
                <span
                  className={styles.marker}
                  aria-hidden="true"
                  style={{
                    width: geometry.marker.width,
                    height: geometry.marker.height,
                    transform: `translate(${geometry.marker.left}px, ${geometry.marker.top}px)`,
                  }}
                />
              )}
              {groups.map(renderGroup)}
            </div>
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
