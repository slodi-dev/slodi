import Link from "next/link";
import type { GameDef } from "@/lib/leikir-games";
import GamePodium from "./GamePodium";
import styles from "./GameCard.module.css";

const ACCENT_CLASS: Record<GameDef["accent"], string> = {
  heidursordla: styles.accentHeidursordla,
  falkar: styles.accentFalkar,
  rekkar: styles.accentRekkar,
  drekar: styles.accentDrekar,
};

function Cover({ game }: { game: GameDef }) {
  const emblemClass =
    game.emblemKind === "letter" ? `${styles.emblem} ${styles.letter}` : styles.emblem;
  return (
    <span className={styles.cover}>
      <span className={emblemClass} aria-hidden="true">
        {game.emblem}
      </span>
      {game.status === "soon" ? (
        <span className={styles.soonPill}>Kemur bráðum</span>
      ) : (
        <span className={styles.playCue}>Spila →</span>
      )}
    </span>
  );
}

function Body({ game }: { game: GameDef }) {
  return (
    <span className={styles.body}>
      <h2 className={styles.name}>{game.name}</h2>
      <p className={styles.tagline}>{game.tagline}</p>
    </span>
  );
}

export default function GameCard({ game }: { game: GameDef }) {
  const cardClass = [styles.card, ACCENT_CLASS[game.accent], game.status === "soon" && styles.soon]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cardClass}>
      {game.status === "live" ? (
        <Link className={styles.link} href={`/leikir/${game.slug}`}>
          <Cover game={game} />
          <Body game={game} />
        </Link>
      ) : (
        <div className={styles.link}>
          <Cover game={game} />
          <Body game={game} />
        </div>
      )}

      {game.status === "live" && game.hasLeaderboard && <GamePodium slug={game.slug} />}
    </article>
  );
}
