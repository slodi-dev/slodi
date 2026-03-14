"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import RangeInput from "@/components/ui/RangeInput";
import { formatDuration } from "@/lib/format";

interface DurationFilterProps {
  minValue: number | undefined;
  maxValue: number | undefined;
  onChange: (min: number | undefined, max: number | undefined) => void;
  defaultOpen?: boolean;
}

const DEBOUNCE_MS = 300;

export default function DurationFilter({
  minValue,
  maxValue,
  onChange,
  defaultOpen,
}: DurationFilterProps) {
  const [localMin, setLocalMin] = useState(minValue);
  const [localMax, setLocalMax] = useState(maxValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Sync local state when controlled values change externally
  useEffect(() => {
    setLocalMin(minValue);
    setLocalMax(maxValue);
  }, [minValue, maxValue]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const scheduleChange = useCallback((nextMin: number | undefined, nextMax: number | undefined) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onChangeRef.current(nextMin, nextMax);
    }, DEBOUNCE_MS);
  }, []);

  const handleMinChange = useCallback(
    (value: number | undefined) => {
      setLocalMin(value);
      scheduleChange(value, localMax);
    },
    [localMax, scheduleChange]
  );

  const handleMaxChange = useCallback(
    (value: number | undefined) => {
      setLocalMax(value);
      scheduleChange(localMin, value);
    },
    [localMin, scheduleChange]
  );

  const hint = formatDuration(localMin, localMax) || undefined;

  return (
    <CollapsibleSection label="Lengd (mínútur)" defaultOpen={defaultOpen}>
      <RangeInput
        minValue={localMin}
        maxValue={localMax}
        onMinChange={handleMinChange}
        onMaxChange={handleMaxChange}
        step={5}
        min={0}
        minPlaceholder="Frá"
        maxPlaceholder="Til"
        minLabel="Lágmark: mínútur"
        maxLabel="Hámark: mínútur"
        hint={hint}
      />
    </CollapsibleSection>
  );
}
