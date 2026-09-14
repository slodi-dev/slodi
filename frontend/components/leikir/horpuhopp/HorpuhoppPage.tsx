"use client";

import HorpuhoppGame from "@/components/leikir/horpuhopp/HorpuhoppGame";
import GameLeaderboard from "@/components/leikir/hub/GameLeaderboard";
import { useGameScores } from "@/hooks/useGameScores";
import styles from "./horpuhopp.module.css";

const GAME = "horpuhopp";

export default function HorpuhoppPage() {
  const {
    scores,
    leaderboardVisible,
    loginHref,
    scoreError,
    handleGameOver,
    handleRestart,
    hideLeaderboard,
  } = useGameScores(GAME);

  return (
    <div className={styles.root}>
      <div className={styles.gameArea}>
        <HorpuhoppGame onGameOver={handleGameOver} onRestart={handleRestart} />
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
