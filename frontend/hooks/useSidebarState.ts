import { useCallback, useEffect, useState } from "react";

/** Below this window width the side nav is a drawer behind the menu button. */
export const PHONE_MAX_WIDTH = 767;
/** Below this window width (and above a phone) the side nav starts collapsed to icons. */
export const TABLET_MAX_WIDTH = 1199;

type Viewport = "phone" | "tablet" | "desktop";

function viewportOf(width: number): Viewport {
  if (width <= PHONE_MAX_WIDTH) return "phone";
  if (width <= TABLET_MAX_WIDTH) return "tablet";
  return "desktop";
}

interface UseSidebarStateReturn {
  /** Whether the nav shows icons only. Never true on a phone, where the nav is a drawer. */
  sidebarCollapsed: boolean;
  /** Whether the user has collapsed or expanded the nav since the page loaded. */
  sidebarToggled: boolean;
  mobileMenuOpen: boolean;
  isMobile: boolean;
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
}

/**
 * The side nav's state: collapsed or not on a tablet or desktop, the drawer open or not on a
 * phone.
 *
 * Collapsed follows the window until the user says otherwise: icons only on a tablet, full
 * width on a desktop. Once the user presses the toggle, their choice holds at any width, so
 * the toggle's `aria-expanded` always tells the truth (the old layout forced icons at
 * 768–1199px with CSS while the toggle still flipped).
 *
 * The first render assumes a desktop, the same as the server's, so hydration matches; the
 * real width is read straight after mount.
 */
export function useSidebarState(initialCollapsed?: boolean): UseSidebarStateReturn {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [choice, setChoice] = useState<boolean | undefined>(initialCollapsed);
  const [toggled, setToggled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => setViewport(viewportOf(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const isMobile = viewport === "phone";

  // Off a phone the drawer has nothing to be open over.
  if (!isMobile && mobileMenuOpen) setMobileMenuOpen(false);

  // The page behind an open drawer doesn't scroll.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const sidebarCollapsed = !isMobile && (choice ?? viewport === "tablet");

  const toggleSidebar = useCallback(() => {
    setChoice(!sidebarCollapsed);
    setToggled(true);
  }, [sidebarCollapsed]);
  const toggleMobileMenu = useCallback(() => setMobileMenuOpen((open) => !open), []);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  return {
    sidebarCollapsed,
    sidebarToggled: toggled,
    mobileMenuOpen,
    isMobile,
    toggleSidebar,
    toggleMobileMenu,
    closeMobileMenu,
  };
}
