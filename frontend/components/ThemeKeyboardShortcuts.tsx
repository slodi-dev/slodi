"use client";

import { useEffect } from "react";
import { useTheme } from "@/components/ThemeProvider";

/**
 * ThemeKeyboardShortcuts
 *
 * Global hotkey for theme switching:
 * - F8: toggle between light and dark
 *
 * Routes through ThemeProvider (the canonical theme system) via `toggleTheme`,
 * so the change actually applies and persists — matching the settings toggle.
 * (Earlier Ctrl/Cmd+Shift shortcuts poked `data-theme` directly and were
 * overridden by the provider, so they never worked.)
 */
export default function ThemeKeyboardShortcuts() {
  const { toggleTheme } = useTheme();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F8") {
        event.preventDefault();
        toggleTheme();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggleTheme]);

  return null; // This component doesn't render anything
}
