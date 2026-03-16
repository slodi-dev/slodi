"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, X, ListTodo, CalendarDays, BookOpen } from "lucide-react";
import styles from "./ContentFab.module.css";

interface ContentFabProps {
  onNewTask: () => void;
  onNewEvent: () => void;
  onNewProgram: () => void;
}

const ACTIONS = [
  { key: "task" as const, label: "Verkefni", Icon: ListTodo, delay: "0ms" },
  { key: "event" as const, label: "Viðburður", Icon: CalendarDays, delay: "40ms" },
  { key: "program" as const, label: "Dagskrá", Icon: BookOpen, delay: "80ms" },
];

export function ContentFab({ onNewTask, onNewEvent, onNewProgram }: ContentFabProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlers = { task: onNewTask, event: onNewEvent, program: onNewProgram };

  const handleAction = (key: "task" | "event" | "program") => {
    setOpen(false);
    handlers[key]();
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className={styles.container} aria-label="Bæta efni við">
      {/* Speed-dial actions */}
      <div className={`${styles.actions} ${open ? styles.actionsOpen : ""}`} aria-hidden={!open}>
        {ACTIONS.map(({ key, label, Icon, delay }) => (
          <button
            key={key}
            type="button"
            className={styles.action}
            style={{ "--delay": delay } as React.CSSProperties}
            onClick={() => handleAction(key)}
            tabIndex={open ? 0 : -1}
            aria-label={label}
          >
            <span className={styles.actionLabel}>{label}</span>
            <span className={styles.actionIcon}>
              <Icon size={20} aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>

      {/* Main FAB button */}
      <button
        type="button"
        className={`${styles.fab} ${open ? styles.fabOpen : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Loka valmynd" : "Bæta við í dagskrá"}
      >
        {open ? (
          <X size={28} aria-hidden="true" className={styles.fabIcon} />
        ) : (
          <Plus size={28} aria-hidden="true" className={styles.fabIcon} />
        )}
        <span className={styles.fabLabel}>Bæta við í dagskrá</span>
      </button>
    </div>
  );
}
