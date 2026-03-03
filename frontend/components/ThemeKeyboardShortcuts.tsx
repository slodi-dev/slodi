"use client";

import { useEffect } from "react";

/**
 * ThemeKeyboardShortcuts Component
 *
 * Provides keyboard shortcuts for theme switching:
 * - Ctrl/Cmd + Shift + L: Light theme
 * - Ctrl/Cmd + Shift + D: Dark theme
 * - Ctrl/Cmd + Shift + H: High contrast theme
 * - Ctrl/Cmd + Shift + C: Colorblind theme
 * - Ctrl/Cmd + Shift + R: Reduced motion theme
 * - Ctrl/Cmd + Shift + T: Cycle through all themes
 */
export default function ThemeKeyboardShortcuts() {
  useEffect(() => {
    const themes = ["light", "dark", "high-contrast", "colorblind", "reduced-motion"];

    const getCurrentTheme = (): string => {
      return document.documentElement.getAttribute("data-theme") || "light";
    };

    const setTheme = (theme: string) => {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("slodi-theme", theme);

      // Also set dark class for compatibility
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    const cycleTheme = () => {
      const currentTheme = getCurrentTheme();
      const currentIndex = themes.indexOf(currentTheme);
      const nextIndex = (currentIndex + 1) % themes.length;
      setTheme(themes[nextIndex]);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl/Cmd + Shift combination
      const modifierKey = event.ctrlKey || event.metaKey;
      if (!modifierKey || !event.shiftKey) return;

      let handled = false;

      switch (event.key.toLowerCase()) {
        case "l":
          setTheme("light");
          handled = true;
          break;
        case "d":
          setTheme("dark");
          handled = true;
          break;
        case "h":
          setTheme("high-contrast");
          handled = true;
          break;
        case "c":
          setTheme("colorblind");
          handled = true;
          break;
        case "r":
          setTheme("reduced-motion");
          handled = true;
          break;
        case "h":
          cycleTheme();
          handled = true;
          break;
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null; // This component doesn't render anything
}
