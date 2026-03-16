/**
 * DashboardSidebar Component
 *
 * A collapsible navigation sidebar for the dashboard with role-based access control.
 * Features:
 * - Three-tier navigation structure (primary, secondary, personal)
 * - Collapsible state with smooth transitions
 * - Role-based menu item visibility (leader, editor, admin)
 * - Active route highlighting
 * - Badge notifications for items
 * - Accessible keyboard navigation and ARIA labels
 * - Responsive mobile drawer support (via parent component)
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./DashboardSidebar.module.css";

// Icons from lucide-react for navigation items and controls
import {
  Home, // Slóði (Home)
  LayoutDashboard, // Stjórnborð (Dashboard)
  Calendar, // Dagskrárbankinn (Programs)
  Hammer, // Vinnubekkurinn (Builder)
  MessageSquare, // Veggurinn (Social wall)
  BarChart3, // Greining (Analytics)
  Shield, // Stjórnun (Admin)
  User, // Prófíll (Profile)
  Settings, // Stillingar (Settings)
  Award, // Merkin mín (Badges)
  PanelLeftClose, // Collapse sidebar icon
  PanelLeftOpen, // Expand sidebar icon
} from "lucide-react";
import Image from "next/image";

/**
 * Navigation item configuration
 */
interface NavItem {
  label: string; // Display text (Icelandic)
  path: string; // Route path
  icon: React.ComponentType<{ className?: string }>; // Lucide icon component
  badge?: number; // Optional notification count
  roleRequired?: "admin" | "editor"; // Minimum role required (omit for all users)
  group?: "home" | "dashboard" | "primary" | "secondary" | "personal"; // Navigation section
  disabled?: boolean; // Whether item is disabled (not yet implemented)
}

/**
 * Sidebar component props
 */
interface DashboardSidebarProps {
  userRole?: "leader" | "editor" | "admin"; // User's role for access control
  userName?: string; // Display name for user section
  userAvatar?: string; // Avatar URL for user section
  badgeCount?: number; // Unread badge count
  collapsed?: boolean; // Initial collapsed state
  onCollapsedChange?: (collapsed: boolean) => void; // Callback for state changes
  showUserSection?: boolean; // Whether to display user avatar section
}

/**
 * Navigation items configuration
 * Organized into groups:
 * - Home: Back to main site
 * - Dashboard: Dashboard overview
 * - Primary: Main application features (Programs, Builder, Social)
 * - Secondary: Analytics and administration
 * - Personal: User profile, settings, and badges
 *
 * Access control:
 * - Items without roleRequired are visible to all users
 * - roleRequired "editor": visible to editors and admins
 * - roleRequired "admin": visible only to admins
 *
 * Disabled items are shown but not clickable (for features in development)
 */
const NAV_ITEMS: NavItem[] = [
  // Home navigation
  {
    label: "Slóði",
    path: "/",
    icon: Home,
    group: "home",
  },
  // Dashboard navigation
  {
    label: "Stjórnborð",
    path: "/dashboard",
    icon: LayoutDashboard,
    group: "dashboard",
  },
  // Primary navigation - core features accessible to most users
  {
    label: "Dagskrárbankinn",
    path: "/content",
    icon: Calendar,
    group: "primary",
  },
  {
    label: "Vinnubekkurinn",
    path: "/builder",
    icon: Hammer,
    group: "primary",
    roleRequired: "editor", // Requires editor or admin role
    disabled: true, // Not yet implemented
  },
  {
    label: "Veggurinn",
    path: "/social",
    icon: MessageSquare,
    group: "primary",
    disabled: true, // Not yet implemented
  },
  // Secondary navigation - advanced features
  {
    label: "Greining",
    path: "/analytics",
    icon: BarChart3,
    group: "secondary",
    disabled: true, // Not yet implemented
  },
  {
    label: "Stjórnun",
    path: "/admin",
    icon: Shield,
    group: "secondary",
    roleRequired: "admin", // Admin-only access
    disabled: true, // Not yet implemented
  },
  // Personal navigation - user-specific items
  {
    label: "Prófíll",
    path: "/profile",
    icon: User,
    group: "personal",
    disabled: true, // Not yet implemented
  },
  {
    label: "Stillingar",
    path: "/settings",
    icon: Settings,
    group: "personal",
  },
  {
    label: "Merkin mín",
    path: "/badges",
    icon: Award,
    group: "personal",
    disabled: true, // Not yet implemented
  },
];

export default function DashboardSidebar({
  userRole = "leader",
  userName = "Notandi",
  userAvatar,
  badgeCount = 0,
  collapsed = false,
  onCollapsedChange,
  showUserSection = false, // Default to hidden
  ...props // Accept additional props like data-open
}: DashboardSidebarProps & { "data-open"?: string }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  /**
   * Check if user has permission to see a navigation item
   * Implements hierarchical role system: admin > editor > leader
   */
  const hasPermission = (item: NavItem): boolean => {
    if (!item.roleRequired) return true;
    if (item.roleRequired === "admin") return userRole === "admin";
    if (item.roleRequired === "editor") return userRole === "editor" || userRole === "admin";
    return true;
  };

  /**
   * Toggle sidebar collapsed state
   * Notifies parent component via callback for responsive handling
   */
  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    onCollapsedChange?.(newState);
  };

  /**
   * Determine if a navigation path is currently active
   * Uses exact match for root and prefix match for sub-routes
   */
  const isActive = (path: string) => {
    // Exact match for root paths
    if (path === "/dashboard") return pathname === "/dashboard";
    // Starts with match for sub-routes
    return pathname.startsWith(path);
  };

  // Group navigation items by their designated section
  const homeItems = NAV_ITEMS.filter((item) => item.group === "home");
  const dashboardItems = NAV_ITEMS.filter((item) => item.group === "dashboard");
  const primaryItems = NAV_ITEMS.filter((item) => item.group === "primary");
  const secondaryItems = NAV_ITEMS.filter((item) => item.group === "secondary");
  const personalItems = NAV_ITEMS.filter((item) => item.group === "personal");

  /**
   * Render a single navigation item
   * Handles permission checking, active state, badges, disabled state, and accessibility
   */
  const renderNavItem = (item: NavItem) => {
    // Hide items the user doesn't have permission for
    if (!hasPermission(item)) return null;

    const Icon = item.icon;
    const active = isActive(item.path);
    const isDisabled = item.disabled || false;

    // Apply badge count to "Merkin mín" item
    const badge = item.path === "/badges" ? badgeCount : item.badge;
    const showBadge = badge && badge > 0;

    const content = (
      <>
        <Icon className={styles.navIcon} aria-hidden="true" />
        {!isCollapsed && <span className={styles.navLabel}>{item.label}</span>}
        {showBadge && (
          <span className={styles.navBadge} aria-label={`${badge} ólesnar`}>
            {badge}
          </span>
        )}
      </>
    );

    return (
      <li key={item.path}>
        {isDisabled ? (
          <div
            className={`${styles.navItem} ${styles.navItemDisabled}`}
            aria-disabled="true"
            title="Ennþá í vinnslu..."
          >
            {content}
          </div>
        ) : (
          <Link
            href={item.path}
            className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
            title={isCollapsed ? item.label : undefined} // Tooltip when collapsed
          >
            {content}
          </Link>
        )}
      </li>
    );
  };

  return (
    <aside
      className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ""}`}
      aria-label="Aðalvalmynd"
      data-collapsed={isCollapsed}
      data-open={props["data-open"]}
    >
      <nav className={styles.nav}>
        {/* Home navigation: Slóði */}
        <ul className={styles.navList} role="list">
          {homeItems.map((item) => renderNavItem(item))}
        </ul>

        {/* Visual separator */}
        <div className={styles.navSeparator} role="separator" aria-hidden="true" />

        {/* Dashboard navigation: Stjórnborð */}
        <ul className={styles.navList} role="list">
          {dashboardItems.map((item) => renderNavItem(item))}
        </ul>

        {/* Primary navigation: main features like Programs, Builder, Social */}
        <ul className={styles.navList} role="list">
          {primaryItems.map((item) => renderNavItem(item))}
        </ul>

        {/* Visual separator between navigation sections */}
        <div className={styles.navSeparator} role="separator" aria-hidden="true" />

        {/* Secondary navigation: analytics and admin tools */}
        <ul className={styles.navList} role="list">
          {secondaryItems.map((item) => renderNavItem(item))}
        </ul>

        {/* 
                    User avatar section - optional
                    Only displays if showUserSection prop is true
                */}
        {showUserSection && (
          <div className={styles.userSection}>
            <Link
              href="/profile"
              className={`${styles.userLink} ${isActive("/profile") ? styles.userLinkActive : ""}`}
              aria-label={`Prófíll: ${userName}`}
              title={isCollapsed ? userName : undefined}
            >
              {userAvatar ? (
                <Image src={userAvatar} alt="" className={styles.userAvatar} aria-hidden="true" />
              ) : (
                <div className={styles.userAvatarPlaceholder} aria-hidden="true">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              {!isCollapsed && <span className={styles.userName}>{userName}</span>}
            </Link>
          </div>
        )}

        {/* 
                    Personal navigation: pinned to bottom using CSS (margin-top: auto)
                    Contains profile, settings, and badges
                */}
        <ul className={`${styles.navList} ${styles.personalList}`} role="list">
          {personalItems.map((item) => renderNavItem(item))}
        </ul>

        {/* Visual separator before collapse button */}
        <div className={styles.navSeparator} role="separator" aria-hidden="true" />

        {/* Collapse/expand toggle button - at bottom */}
        <div className={styles.collapseButtonWrapper}>
          <button
            className={`${styles.collapseButton} ${styles.collapseButtonCompact}`}
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? "Opna valmynd" : "Loka valmynd"}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? "Opna valmynd" : "Loka valmynd"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className={styles.collapseIcon} />
            ) : (
              <>
                <PanelLeftClose className={styles.collapseIcon} />
                {!isCollapsed && <span className={styles.collapseLabel}>Fela valmynd</span>}
              </>
            )}
          </button>
        </div>
      </nav>

      {/* Accessibility: skip link for keyboard navigation to main content */}
      <a href="#main-content" className={styles.skipLink}>
        Sleppa í efni
      </a>
    </aside>
  );
}
