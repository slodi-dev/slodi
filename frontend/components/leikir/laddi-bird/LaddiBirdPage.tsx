"use client";

import LaddiBirdGame from "@/components/leikir/laddi-bird/LaddiBirdGame";
import GameLeaderboard from "@/components/leikir/hub/GameLeaderboard";
import { useGameScores } from "@/hooks/useGameScores";
import styles from "./laddiBird.module.css";

const GAME = "laddi-bird";

export default function LaddiBirdPage() {
  const {
    scores,
    leaderboardVisible,
    loginHref,
    scoreError,
    startRun,
    handleGameOver,
    handleRestart,
    hideLeaderboard,
  } = useGameScores(GAME);

  return (
    <div className={styles.root}>
      <div className={styles.gameArea}>
        <LaddiBirdGame
          onGameOver={handleGameOver}
          onRestart={handleRestart}
          onRunStart={startRun}
        />
        <GameLeaderboard
          entries={scores}
          visible={leaderboardVisible}
          onClose={hideLeaderboard}
          loginHref={loginHref}
          errorMessage={scoreError}
        />
      </div>
    </div>
  );
}
