"use client";

import { useAuth } from "@/hooks/useAuth";
import { GAMES } from "@/lib/leikir-games";
import GameCard from "./GameCard";
import styles from "./LeikirHub.module.css";

function GuestGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.7-8 6v2h16v-2c0-3.3-3.6-6-8-6Z" />
    </svg>
  );
}

function TopBar() {
  const { user, isAuthenticated, isLoading } = useAuth();

  const who = isAuthenticated && user ? user.name : "Gestur";
  const status = isLoading
    ? "Sæki notanda…"
    : isAuthenticated
      ? "Stig þín eru vistuð"
      : "Stig eru ekki vistuð";

  return (
    <div className={styles.topbar}>
      <span className={styles.avatar}>
        <GuestGlyph />
      </span>
      <span className={styles.ident}>
        <span className={styles.who}>{who}</span>
        <span className={styles.status}>{status}</span>
      </span>
      {!isLoading && !isAuthenticated && (
        <a className={styles.signinBtn} href="/auth/login">
          Skrá inn
        </a>
      )}
    </div>
  );
}

export default function LeikirHub() {
  return (
    <div className={styles.hub}>
      <TopBar />

      <header className={styles.masthead}>
        <h1 className={styles.title}>Leikir</h1>
        <p className={styles.sub}>
          Leikjatorg skátanna — spilaðu, safnaðu stigum og komdu þér á stigatöfluna.
        </p>
      </header>

      <div className={styles.grid}>
        {GAMES.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </div>
    </div>
  );
}
