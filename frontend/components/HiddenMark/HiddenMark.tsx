import ActiveChip from "@/components/ui/ActiveChip";
import styles from "./HiddenMark.module.css";

/**
 * How hidden content is marked wherever it reaches a reader.
 *
 * The backend only ever sends a hidden item (non-null `hidden_at`) to
 * Dagskrárstjórnarteymið and platform admins — and, for the item itself, its
 * own author. They need to find it in order to unhide it, but must never
 * mistake it for something live in the bank. So it is greyed out *and* labelled
 * "Falið": the chip's text and icon carry the meaning, the dimming supports it.
 */

export function isHidden(item: { hidden_at?: string | null } | null | undefined): boolean {
  return Boolean(item?.hidden_at);
}

/** The "Falið" chip. */
export function HiddenChip({ className }: { className?: string }) {
  return <ActiveChip label="Falið" tone="hidden" className={className} />;
}

/** Reduced-opacity, desaturated treatment for the hidden item's own visuals. */
export const hiddenDimClass = styles.dimmed;
