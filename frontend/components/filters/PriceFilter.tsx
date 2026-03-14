"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { formatPrice } from "@/lib/format";
import styles from "./range-filters.module.css";

interface PriceFilterProps {
  freeOnly: boolean;
  maxPrice: number | undefined;
  onChange: (freeOnly: boolean, maxPrice: number | undefined) => void;
  defaultOpen?: boolean;
}

const DEBOUNCE_MS = 300;

export default function PriceFilter({
  freeOnly,
  maxPrice,
  onChange,
  defaultOpen,
}: PriceFilterProps) {
  const [localMaxPrice, setLocalMaxPrice] = useState(maxPrice);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Sync local state when controlled value changes externally
  useEffect(() => {
    setLocalMaxPrice(maxPrice);
  }, [maxPrice]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleFreeOnlyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      onChangeRef.current(checked, checked ? undefined : localMaxPrice);
    },
    [localMaxPrice]
  );

  const handleMaxPriceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      let value: number | undefined;
      if (raw === "") {
        value = undefined;
      } else {
        const parsed = Number(raw);
        if (Number.isNaN(parsed)) return;
        value = parsed;
      }

      setLocalMaxPrice(value);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        onChangeRef.current(freeOnly, value);
      }, DEBOUNCE_MS);
    },
    [freeOnly]
  );

  const showHint = !freeOnly && localMaxPrice != null;

  return (
    <CollapsibleSection label="Kostnaður (kr.)" defaultOpen={defaultOpen}>
      <div className={styles.priceWrapper}>
        <label className={styles.priceCheckboxLabel}>
          <input
            type="checkbox"
            className={styles.priceCheckbox}
            checked={freeOnly}
            onChange={handleFreeOnlyChange}
          />
          Einungis kostnaðarlaust
        </label>

        {!freeOnly && (
          <input
            type="number"
            className={styles.priceMaxInput}
            value={localMaxPrice ?? ""}
            onChange={handleMaxPriceChange}
            aria-label="Hámarksverð"
            min={0}
            step={100}
            placeholder="Hámarksverð"
          />
        )}

        {showHint && (
          <p className={styles.priceHint} aria-live="polite" aria-atomic="true">
            Upp að {formatPrice(localMaxPrice!)}
          </p>
        )}
      </div>
    </CollapsibleSection>
  );
}
