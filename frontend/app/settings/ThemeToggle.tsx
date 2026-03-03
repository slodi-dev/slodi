"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useEffect, useState } from "react";
import styles from "./settings.module.css";

type ThemeMode = "light" | "dark" | "system";

export default function ThemeToggle() {
  const { setTheme } = useTheme();
  const [selectedMode, setSelectedMode] = useState<ThemeMode>("system");

  // Initialize from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("slodi-theme-mode") as ThemeMode;
    if (stored) {
      setSelectedMode(stored);
    } else {
      setSelectedMode("system");
    }
  }, []);

  const options: { value: ThemeMode; label: string; icon: React.ReactNode; description: string }[] =
    [
      {
        value: "light",
        label: "Ljóst",
        icon: <Sun className={styles.themeIcon} aria-hidden="true" />,
        description: "Alltaf ljóst",
      },
      {
        value: "dark",
        label: "Dökkt",
        icon: <Moon className={styles.themeIcon} aria-hidden="true" />,
        description: "Alltaf dökkt",
      },
      {
        value: "system",
        label: "Kerfi",
        icon: <Monitor className={styles.themeIcon} aria-hidden="true" />,
        description: "Fylgir kerfi",
      },
    ];

  const handleThemeChange = (value: ThemeMode) => {
    setSelectedMode(value);
    localStorage.setItem("slodi-theme-mode", value);

    if (value === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    } else {
      setTheme(value);
    }
  };

  return (
    <div className={styles.themeToggle}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => handleThemeChange(option.value)}
          className={`${styles.themeOption} ${selectedMode === option.value ? styles.themeOptionActive : ""}`}
          aria-pressed={selectedMode === option.value}
          aria-label={option.label}
        >
          {option.icon}
          <div className={styles.themeOptionText}>
            <span className={styles.themeOptionLabel}>{option.label}</span>
            <span className={styles.themeOptionDescription}>{option.description}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
