"use client";

import React, { useEffect, useRef, useCallback } from "react";
import AgeGroupFilter from "./AgeGroupFilter";
import TagFilter from "./TagFilter";
import EquipmentFilter from "./EquipmentFilter";
import AuthorFilter from "./AuthorFilter";
import DurationFilter from "./DurationFilter";
import PrepTimeFilter from "./PrepTimeFilter";
import ParticipantFilter from "./ParticipantFilter";
import PriceFilter from "./PriceFilter";
import LocationFilter from "./LocationFilter";
import styles from "./FilterSidebar.module.css";

export interface FilterSidebarProps {
  // Age group filter
  selectedAges: string[];
  onAgesChange: (ages: string[]) => void;

  // Tag filter
  availableTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;

  // Equipment filter
  uniqueEquipment: string[];
  selectedEquipment: string[];
  onEquipmentChange: (equipment: string[]) => void;

  // Author filter
  authorValue: string;
  onAuthorChange: (author: string) => void;
  uniqueAuthors: string[];

  // Duration filter
  durationMin: number | undefined;
  durationMax: number | undefined;
  onDurationChange: (min: number | undefined, max: number | undefined) => void;

  // Prep time filter
  prepMin: number | undefined;
  prepMax: number | undefined;
  onPrepTimeChange: (min: number | undefined, max: number | undefined) => void;

  // Participant filter
  countMin: number | undefined;
  countMax: number | undefined;
  onParticipantChange: (min: number | undefined, max: number | undefined) => void;

  // Price filter
  freeOnly: boolean;
  priceMax: number | undefined;
  onPriceChange: (freeOnly: boolean, maxPrice: number | undefined) => void;

  // Location filter
  locationValue: string;
  onLocationChange: (location: string) => void;
  uniqueLocations: string[];
}

/**
 * Desktop filter sidebar assembling all 9 filter sections.
 * Sticky container with scrollable overflow.
 */
export default function FilterSidebar(props: FilterSidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label="Síur">
      <AgeGroupFilter
        selected={props.selectedAges}
        onChange={props.onAgesChange}
        defaultOpen={true}
      />
      <TagFilter
        availableTags={props.availableTags}
        selected={props.selectedTags}
        onChange={props.onTagsChange}
        defaultOpen={true}
      />
      <EquipmentFilter
        availableItems={props.uniqueEquipment}
        selected={props.selectedEquipment}
        onChange={props.onEquipmentChange}
      />
      <AuthorFilter
        value={props.authorValue}
        onChange={props.onAuthorChange}
        suggestions={props.uniqueAuthors}
      />
      <DurationFilter
        minValue={props.durationMin}
        maxValue={props.durationMax}
        onChange={props.onDurationChange}
      />
      <PrepTimeFilter
        minValue={props.prepMin}
        maxValue={props.prepMax}
        onChange={props.onPrepTimeChange}
      />
      <ParticipantFilter
        minValue={props.countMin}
        maxValue={props.countMax}
        onChange={props.onParticipantChange}
      />
      <PriceFilter
        freeOnly={props.freeOnly}
        maxPrice={props.priceMax}
        onChange={props.onPriceChange}
      />
      <LocationFilter
        value={props.locationValue}
        onChange={props.onLocationChange}
        suggestions={props.uniqueLocations}
      />
    </aside>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   FilterDrawer — Mobile slide-out drawer wrapping FilterSidebar
   ════════════════════════════════════════════════════════════════════════ */

interface FilterDrawerProps extends FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeFilterCount: number;
  /** Ref to the trigger button for returning focus on close */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

/**
 * Mobile filter drawer. Slides in from the left with a backdrop overlay.
 * Implements focus trap, body scroll lock, and Escape key handling.
 */
export function FilterDrawer({
  isOpen,
  onClose,
  activeFilterCount,
  triggerRef,
  ...sidebarProps
}: FilterDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // Focus management: focus close button on open, return focus on close
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      // Small delay to allow transition to start
      requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
    } else if (previousActiveElement.current) {
      // Return focus to the trigger button
      if (triggerRef.current) {
        triggerRef.current.focus();
      } else if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    }
  }, [isOpen, triggerRef]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;

    const drawer = drawerRef.current;
    if (!drawer) return;

    const focusableElements = drawer.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift+Tab: if focus is on first element, move to last
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: if focus is on last element, move to first
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Síuval"
        onKeyDown={handleKeyDown}
      >
        {/* Drawer header */}
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>
            Síur
            {activeFilterCount > 0 && (
              <span className={styles.drawerBadge} aria-label={`${activeFilterCount} virkar síur`}>
                {activeFilterCount}
              </span>
            )}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.drawerClose}
            onClick={onClose}
            aria-label="Loka síuvali"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Drawer body with all filters */}
        <div className={styles.drawerBody}>
          <FilterSidebar {...sidebarProps} />
        </div>
      </div>
    </>
  );
}
