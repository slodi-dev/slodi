"use client";

import { useEffect, useRef } from "react";
import { createGameEngine } from "./gameEngine";
import styles from "./HorpuhoppGame.module.css";

interface Props {
  onGameOver: (score: number) => void;
  onRestart: () => void;
}

export default function HorpuhoppGame({ onGameOver, onRestart }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Keep stable refs to the latest callbacks so the engine never stales.
  const onGameOverRef = useRef(onGameOver);
  const onRestartRef = useRef(onRestart);
  useEffect(() => {
    onGameOverRef.current = onGameOver;
    onRestartRef.current = onRestart;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return createGameEngine(canvas, {
      onGameOver: (score) => onGameOverRef.current(score),
      onRestart: () => onRestartRef.current(),
    });
  }, []); // engine starts once; callbacks are kept fresh via refs

  return <canvas ref={canvasRef} className={styles.canvas} />;
}
