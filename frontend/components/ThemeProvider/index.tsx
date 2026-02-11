"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "forest-night" | "campfire" | "northern-lights";
type PatrolColor = "drekar" | "falkar" | "drott" | "rekkar" | "rover" | "adrir";

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    patrolColor: PatrolColor | null;
    setPatrolColor: (color: PatrolColor | null) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within ThemeProvider");
    }
    return context;
}

interface ThemeProviderProps {
    children: React.ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
}

export default function ThemeProvider({
    children,
    defaultTheme = "light",
    storageKey = "slodi-theme",
}: ThemeProviderProps) {
    const [theme, setThemeState] = useState<Theme>(defaultTheme);
    const [patrolColor, setPatrolColorState] = useState<PatrolColor | null>(null);
    const [mounted, setMounted] = useState(false);

    // Load saved theme on mount
    useEffect(() => {
        const savedTheme = localStorage.getItem(storageKey) as Theme;
        const savedPatrol = localStorage.getItem("slodi-patrol") as PatrolColor;

        if (savedTheme) {
            setThemeState(savedTheme);
        } else {
            // Check system preference
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            setThemeState(prefersDark ? "dark" : "light");
        }

        if (savedPatrol) {
            setPatrolColorState(savedPatrol);
        }

        setMounted(true);
    }, [storageKey]);

    // Apply theme to document
    useEffect(() => {
        if (!mounted) return;

        const root = document.documentElement;

        // Remove all theme classes/attributes
        root.classList.remove("dark");
        root.removeAttribute("data-theme");

        // Apply new theme
        if (theme === "dark") {
            root.classList.add("dark");
        } else if (theme !== "light") {
            root.setAttribute("data-theme", theme);
        }

        // Save to localStorage
        localStorage.setItem(storageKey, theme);
    }, [theme, mounted, storageKey]);

    // Apply patrol color as primary accent
    useEffect(() => {
        if (!mounted) return;

        const root = document.documentElement;

        if (patrolColor) {
            // Override primary color with patrol color
            root.style.setProperty(
                "--sl-color-primary",
                `var(--sl-color-patrol-${patrolColor})`
            );
            root.style.setProperty(
                "--sl-color-primary-hover",
                `var(--sl-color-patrol-${patrolColor}-hover)`
            );
            root.style.setProperty(
                "--sl-color-primary-subtle",
                `var(--sl-color-patrol-${patrolColor}-subtle)`
            );
            root.style.setProperty(
                "--sl-color-primary-muted",
                `var(--sl-color-patrol-${patrolColor}-muted)`
            );

            localStorage.setItem("slodi-patrol", patrolColor);
        } else {
            // Reset to default primary (moss green)
            root.style.removeProperty("--sl-color-primary");
            root.style.removeProperty("--sl-color-primary-hover");
            root.style.removeProperty("--sl-color-primary-subtle");
            root.style.removeProperty("--sl-color-primary-muted");

            localStorage.removeItem("slodi-patrol");
        }
    }, [patrolColor, mounted]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
    };

    const setPatrolColor = (color: PatrolColor | null) => {
        setPatrolColorState(color);
    };

    const toggleTheme = () => {
        setThemeState((prev) => (prev === "light" ? "dark" : "light"));
    };

    // Always render the provider to avoid context errors
    // The mounted flag just controls when we apply theme changes to the DOM
    return (
        <ThemeContext.Provider
            value={{
                theme,
                setTheme,
                patrolColor,
                setPatrolColor,
                toggleTheme,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}