"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DashboardLayout from "@/components/DashboardLayout";

/**
 * ConditionalLayout Component
 *
 * Routes between two layout types based on the current path:
 *
 * 1. Marketing Layout (Header + Content + Footer)
 *    - Home page: /
 *    - About page: /about
 *    - Palette showcase: /palette
 *    - Dev logs: /dev
 *    - Any other public/marketing pages
 *
 * 2. Dashboard Layout (Sidebar + Content, no Header/Footer)
 *    - Dashboard: /dashboard
 *    - Programs: /programs
 *    - Builder: /builder
 *    - Social: /social
 *    - Analytics: /analytics
 *    - Admin: /admin
 *    - Profile: /profile
 *    - Settings: /settings
 *    - Badges: /badges
 *    - Any other authenticated pages
 */

// Public routes that should show header and footer
const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/palette",
  "/dev",
  "/login",
  "/signup",
  "/onboard",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

// Dashboard/app routes that should use sidebar-only layout
const DASHBOARD_ROUTES = [
  "/dashboard",
  "/content",
  "/builder",
  "/social",
  "/analytics",
  "/admin",
  "/profile",
  "/settings",
  "/badges",
];

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();

  /**
   * Determine if current route is a public/marketing page
   * Returns true for exact matches or if no dashboard route matches
   */
  const isPublicRoute = (): boolean => {
    // Exact match in public routes
    if (PUBLIC_ROUTES.includes(pathname)) {
      return true;
    }

    // Check if starts with any dashboard route
    const isDashboardRoute = DASHBOARD_ROUTES.some((route) => pathname.startsWith(route));

    // If it's a dashboard route, it's not public
    if (isDashboardRoute) {
      return false;
    }

    // Default: treat as public (for any other pages like /terms, /privacy, etc.)
    return true;
  };

  const showPublicLayout = isPublicRoute();

  // Marketing/Public Layout: Header + Content + Footer
  if (showPublicLayout) {
    return (
      <>
        <Header />
        <main className="sl-main flex-1">{children}</main>
        <Footer />
      </>
    );
  }

  // Dashboard/App Layout: Sidebar + Content (no header/footer)
  return <DashboardLayout>{children}</DashboardLayout>;
}
