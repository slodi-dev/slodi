import { Clock } from "lucide-react";
import type { SlotKind } from "@/services/plan.service";
import { KIND_ICON, themeIcon } from "./blockIcons";
import styles from "./palette.module.css";

/**
 * The parts of a bank card that are drawn the same wherever a block appears: the picture tile,
 * the length and the kind line. BlockPalette's cards use them, and so does anything else that shows a
 * block as a card (the SplitGrid lab's editable cards), so a block looks the same in the bank
 * and on the plan.
 *
 * Outside the rail, wrap the cards in `blockCardStyles.kindScope` so the kind tints apply.
 */

export const blockCardStyles = {
  kindScope: styles.kindScope,
  card: styles.card,
  marker: styles.marker,
  markerSmall: styles.markerSmall,
  title: styles.title,
  cardKind: styles.cardKind,
  cardTheme: styles.cardTheme,
  badges: styles.badges,
  badge: styles.badge,
};

export interface BlockPictureProps {
  kind: SlotKind;
  theme?: string | null;
  /** The block's own picture, when it has one. */
  image?: string;
  /** The 40px tile instead of the full-width one. */
  small?: boolean;
}

/** The block's picture: its own image if it has one, else its theme's icon on its kind's tint. */
export function BlockMarker({ kind, theme, image, small = false }: BlockPictureProps) {
  const { icon: Icon } = themeIcon(theme ?? "");
  return (
    <span
      className={small ? `${styles.marker} ${styles.markerSmall}` : styles.marker}
      data-kind={kind}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- bank pictures are small SVGs; next/image does not optimise SVG.
        <img className={styles.markerImage} src={image} alt="" />
      ) : (
        <Icon className={styles.markerIcon} aria-hidden="true" />
      )}
    </span>
  );
}

/**
 * "🕒 15 mín": the block's length, a clock and the minutes in the body text, never laid over the
 * picture, so it stays sharp on any tile and in both themes. Decorative for screen readers when
 * the card's own name already says the length.
 */
export function BlockMinutes({ minutes, hidden = false }: { minutes: number; hidden?: boolean }) {
  return (
    <span className={styles.minutes} aria-hidden={hidden || undefined}>
      <Clock aria-hidden="true" />
      {minutes} mín
    </span>
  );
}

/** "Dagskrá · Ratleikni": the kind with its icon, then the theme. */
export function BlockKindLine({ kind, theme }: { kind: SlotKind; theme?: string | null }) {
  const { icon: KindIcon, label } = KIND_ICON[kind];
  return (
    <span className={styles.cardKind}>
      <KindIcon aria-hidden="true" />
      {label}
      {theme && <span className={styles.cardTheme}> · {theme}</span>}
    </span>
  );
}
