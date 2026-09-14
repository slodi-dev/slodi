"use client";

import { useEffect, useRef } from "react";
import { createGameEngine } from "./gameEngine";
import styles from "./LaddiBirdGame.module.css";

interface Props {
  onGameOver: (score: number) => void;
  onRestart: () => void;
  onRunStart: () => void;
}

export default function LaddiBirdGame({ onGameOver, onRestart, onRunStart }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Keep stable refs to the latest callbacks so the engine never stales.
  const onGameOverRef = useRef(onGameOver);
  const onRestartRef = useRef(onRestart);
  const onRunStartRef = useRef(onRunStart);
  useEffect(() => {
    onGameOverRef.current = onGameOver;
    onRestartRef.current = onRestart;
    onRunStartRef.current = onRunStart;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return createGameEngine(canvas, {
      onGameOver: (score) => onGameOverRef.current(score),
      onRestart: () => onRestartRef.current(),
      onRunStart: () => onRunStartRef.current(),
    });
  }, []); // engine starts once; callbacks are kept fresh via refs

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      // The canvas is the whole game, so it has to be reachable and operable
      // without a mouse. Space and ↑ are handled on document by the engine.
      tabIndex={0}
      role="application"
      aria-label="Laddí-bird — ýttu á bilslá eða upp-ör til að fljúga"
    />
  );
}
