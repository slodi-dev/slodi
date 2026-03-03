"use client";

import { useApiHealth } from "@/hooks/useApiHealth";
import styles from "./ApiHealthIndicator.module.css";

interface ApiHealthIndicatorProps {
  showInProduction?: boolean;
}

/**
 * Displays API health status - useful for development
 * Hidden in production by default
 */
export function ApiHealthIndicator({ showInProduction = false }: ApiHealthIndicatorProps) {
  const { isHealthy, isChecking } = useApiHealth();

  // Don't show in production unless explicitly enabled
  if (process.env.NODE_ENV === "production" && !showInProduction) {
    return null;
  }

  if (isChecking) {
    return (
      <div className={styles.indicator} data-status="checking">
        <span className={styles.dot}></span>
        <span className={styles.text}>Checking API...</span>
      </div>
    );
  }

  return (
    <div className={styles.indicator} data-status={isHealthy ? "healthy" : "unhealthy"}>
      <span className={styles.dot}></span>
      <span className={styles.text}>{isHealthy ? "API Connected" : "API Disconnected"}</span>
    </div>
  );
}
