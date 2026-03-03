import { useState, useEffect } from "react";

/**
 * Return type for useSidebarState hook
 */
interface UseSidebarStateReturn {
  sidebarCollapsed: boolean; // Is sidebar collapsed (desktop/tablet)
  mobileMenuOpen: boolean; // Is mobile menu open
  isMobile: boolean; // Is current viewport mobile
  isTablet: boolean; // Is current viewport tablet
  isDesktop: boolean; // Is current viewport desktop
  toggleSidebar: () => void; // Toggle sidebar collapsed state
  toggleMobileMenu: () => void; // Toggle mobile menu open/close
  closeMobileMenu: () => void; // Close mobile menu
}

/**
 * Custom React hook to manage sidebar and mobile menu state
 * Handles responsive breakpoints, scroll locking, and state toggles
 */
export function useSidebarState(): UseSidebarStateReturn {
  // State for sidebar collapsed/expanded
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // State for mobile menu open/closed
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // State for current window width (used for breakpoints)
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  // Update window width on resize
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto-close mobile menu when switching to desktop/tablet
  useEffect(() => {
    if (windowWidth >= 768 && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [windowWidth, mobileMenuOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    // Cleanup: always reset body overflow on unmount
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Responsive breakpoints
  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1200;
  const isDesktop = windowWidth >= 1200;

  // Return state and toggles for sidebar and mobile menu
  return {
    sidebarCollapsed,
    mobileMenuOpen,
    isMobile,
    isTablet,
    isDesktop,
    toggleSidebar: () => setSidebarCollapsed(!sidebarCollapsed),
    toggleMobileMenu: () => setMobileMenuOpen(!mobileMenuOpen),
    closeMobileMenu: () => setMobileMenuOpen(false),
  };
}
