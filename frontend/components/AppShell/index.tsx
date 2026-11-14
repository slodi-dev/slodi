"use client";

import { useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardSidebar from "@/components/DashboardSidebar/DashboardSidebar";
import { MAIN_CONTENT_ID, skipToMain } from "@/components/Header";
import { MobileMenuButton } from "@/components/MobileMenuButton/MobileMenuButton";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useDrawerFocus } from "@/hooks/useDrawerFocus";
import styles from "./AppShell.module.css";

const NAV_ID = "app-nav";

interface AppShellProps {
  children: React.ReactNode;
  userRole?: "leader" | "editor" | "admin";
  badgeCount?: number;
  /** Start collapsed to icons, whatever the width. Stories only; the app follows the width. */
  initialCollapsed?: boolean;
}

/**
 * The frame around every signed-in page: a skip link, the side nav and the page's `<main>`.
 * No header or footer; those are for the public pages.
 *
 * - Desktop (1200px and up): the nav is full width; tablet (768–1199px): icons only. Either
 *   way the toggle at the bottom of the nav overrides it, and its `aria-expanded` is the truth.
 * - Phone: the nav is a drawer behind the menu button. Open, it holds focus until Escape, the
 *   menu button, the backdrop or a link closes it (useDrawerFocus).
 * - The skip link comes first in the tab order and goes to the same `#efni` as the public
 *   header's, so every page has one target.
 */
export default function AppShell({
  children,
  userRole = "admin",
  badgeCount = 0,
  initialCollapsed,
}: AppShellProps) {
  // The platform permission that gates Yfirferð, Merkimiðar and Stjórnun lives on our own
  // user record, not on the Auth0 profile.
  const { user: slodiUser } = useAuth();
  const {
    sidebarCollapsed,
    sidebarToggled,
    mobileMenuOpen,
    isMobile,
    toggleSidebar,
    toggleMobileMenu,
    closeMobileMenu,
  } = useSidebarState(initialCollapsed);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  // The menu button stays in the Tab cycle, since it is also how the drawer closes. Closed,
  // the drawer is `visibility: hidden` (AppShell.module.css), so its links are out of reach.
  useDrawerFocus({
    open: mobileMenuOpen && isMobile,
    containerRef: drawerRef,
    triggerRef: menuButtonRef,
    onClose: closeMobileMenu,
    includeTrigger: true,
  });

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href={`#${MAIN_CONTENT_ID}`} onClick={skipToMain}>
        Fara beint í efni
      </a>

      <MobileMenuButton
        ref={menuButtonRef}
        isOpen={mobileMenuOpen}
        onClick={toggleMobileMenu}
        controls={NAV_ID}
      />

      <div ref={drawerRef} id={NAV_ID} className={styles.drawer} data-open={mobileMenuOpen}>
        <DashboardSidebar
          userRole={userRole}
          userPermissions={slodiUser?.permissions}
          badgeCount={badgeCount}
          collapsed={sidebarCollapsed}
          toggled={sidebarToggled}
          onCollapsedChange={toggleSidebar}
          controls={NAV_ID}
          onNavigate={closeMobileMenu}
        />
      </div>

      {mobileMenuOpen && (
        <div className={styles.backdrop} onClick={closeMobileMenu} aria-hidden="true" />
      )}

      {/* The target of the skip link. tabIndex -1 lets the link move focus here. */}
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className={styles.main}>
        {children}
      </main>
    </div>
  );
}
