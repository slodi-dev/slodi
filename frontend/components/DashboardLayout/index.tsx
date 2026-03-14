"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import Sidebar from "@/components/DashboardSidebar/DashboardSidebar";
import { MobileMenuButton } from "@/components/MobileMenuButton/MobileMenuButton";
import { useSidebarState } from "@/hooks/useSidebarState";
import styles from "./DashboardLayout.module.css";

interface DashboardLayoutProps {
  children: React.ReactNode;
  userRole?: "leader" | "editor" | "admin";
  userName?: string;
  userAvatar?: string;
  badgeCount?: number;
}

/**
 * DashboardLayout Component
 *
 * Full-page layout for authenticated dashboard routes
 * Features:
 * - Left sidebar navigation (collapsible on desktop)
 * - Mobile hamburger menu with drawer
 * - No header or footer (those are for public pages only)
 * - Responsive: drawer on mobile, icon-only on tablet, full on desktop
 */
export default function DashboardLayout({
  children,
  userRole = "admin",
  userName = "Notandi",
  userAvatar,
  badgeCount = 0,
}: DashboardLayoutProps) {
  const { user } = useUser();
  const { sidebarCollapsed, mobileMenuOpen, toggleSidebar, toggleMobileMenu, closeMobileMenu } =
    useSidebarState();

  // Resolve user data with Auth0 fallbacks
  const resolvedUserName = user?.name || userName;
  const resolvedUserAvatar = user?.picture || userAvatar;
  const resolvedUserRole = userRole;
  const resolvedBadgeCount = badgeCount;

  return (
    <div className={styles.layout}>
      {/* Mobile menu button - only visible on mobile */}
      <MobileMenuButton isOpen={mobileMenuOpen} onClick={toggleMobileMenu} />

      {/* Sidebar wrapper - handles mobile drawer positioning */}
      <div
        className={styles.sidebarWrapper}
        data-open={mobileMenuOpen}
        data-collapsed={sidebarCollapsed}
      >
        <Sidebar
          userRole={resolvedUserRole}
          userName={resolvedUserName}
          userAvatar={resolvedUserAvatar}
          badgeCount={resolvedBadgeCount}
          collapsed={sidebarCollapsed}
          onCollapsedChange={toggleSidebar}
          showUserSection={false}
          data-open={mobileMenuOpen.toString()} // Add this prop
        />
      </div>

      {/* Mobile overlay - darkens background and closes menu on click */}
      {mobileMenuOpen && (
        <div className={styles.overlay} onClick={closeMobileMenu} aria-hidden="true" />
      )}

      {/* Main content area */}
      <main
        id="main-content"
        className={`${styles.main} ${sidebarCollapsed ? styles.mainCollapsed : ""}`}
      >
        {children}
      </main>
    </div>
  );
}
