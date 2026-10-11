import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0
  );
}

interface UseDrawerFocusOptions {
  /** Whether the drawer is open. */
  open: boolean;
  /** The drawer panel. */
  containerRef: RefObject<HTMLElement | null>;
  /** The button that opens the drawer; focus returns here on close. */
  triggerRef: RefObject<HTMLElement | null>;
  /** Called on Escape. */
  onClose: () => void;
  /**
   * Keep the trigger inside the Tab cycle. For a toggle that stays visible
   * above the open drawer (and closes it), so it is not trapped out.
   */
  includeTrigger?: boolean;
}

/**
 * Keyboard behaviour of an off-canvas drawer, while it is open: focus moves to
 * its first control, Tab and Shift+Tab cycle inside it, Escape closes it, and
 * on close focus goes back to the button that opened it.
 *
 * Hiding the closed drawer from the tab order and from assistive technology is
 * the caller's job (`inert`, or `visibility: hidden` in CSS) — this hook only
 * handles the open state.
 */
export function useDrawerFocus({
  open,
  containerRef,
  triggerRef,
  onClose,
  includeTrigger = false,
}: UseDrawerFocusOptions) {
  const wasOpen = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Move focus in on open; give it back on close.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      // A control that was `visibility: hidden` can refuse focus for a frame
      // or two while a `transition: all` brings it back, so keep trying for a
      // few frames until it takes.
      let frame = 0;
      let tries = 0;
      const tryFocus = () => {
        const first = focusables(containerRef.current)[0];
        first?.focus();
        if (first && document.activeElement !== first && ++tries < 30) {
          frame = requestAnimationFrame(tryFocus);
        }
      };
      frame = requestAnimationFrame(tryFocus);
      return () => cancelAnimationFrame(frame);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus();
    }
  }, [open, containerRef, triggerRef]);

  // Escape closes; Tab stays inside.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const cycle = focusables(containerRef.current);
      if (includeTrigger && triggerRef.current) cycle.unshift(triggerRef.current);
      if (cycle.length === 0) return;
      const first = cycle[0];
      const last = cycle[cycle.length - 1];
      const current = document.activeElement as HTMLElement | null;
      const inside = current ? cycle.includes(current) : false;
      if (event.shiftKey && (current === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, containerRef, triggerRef, includeTrigger]);
}
