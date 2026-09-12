import { cn } from "@/lib/util";

import styles from "./TypeBadge.module.css";

export type BadgeContentType = "task" | "event" | "program";

const LABEL: Record<BadgeContentType, string> = {
  task: "Verkefni",
  event: "Viðburður",
  program: "Dagskrá",
};

const ACCENT: Record<BadgeContentType, string> = {
  task: styles.task,
  event: styles.event,
  program: styles.program,
};

/**
 * One bar for a verkefni, a pennant for a viðburður, three lines for a
 * dagskrá.
 *
 * A tent was rejected for viðburður: a triangle with a bar through it is the
 * shape of a hazard sign, which is the wrong thing to say about an outing.
 */
function Glyph({ type }: { type: BadgeContentType }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.5,
    strokeLinecap: "round" as const,
    "aria-hidden": true,
    className: styles.glyph,
  };

  if (type === "event") {
    return (
      <svg {...common} strokeLinejoin="round">
        <path d="M7 3v18" />
        <path d="M7 4.5h10l-2.6 4 2.6 4H7z" />
      </svg>
    );
  }
  if (type === "program") {
    return (
      <svg {...common}>
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="20" y2="18" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3" y="9" width="18" height="6" rx="2" />
    </svg>
  );
}

/**
 * Says what a bank item is.
 *
 * **Never colour alone.** The badge always carries the word and the glyph, so
 * its meaning survives greyscale, bright sun, colour blindness and print. It
 * is a `span`, not a control — it states a fact about the item rather than
 * offering an action on it, so it has no hover or selected state.
 */
export default function TypeBadge({
  type,
  size = "sm",
  className,
}: {
  type: BadgeContentType;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span className={cn(styles.badge, ACCENT[type], size === "md" && styles.md, className)}>
      <Glyph type={type} />
      {LABEL[type]}
    </span>
  );
}
