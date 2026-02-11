import { useEffect, useState } from "react";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

interface ApiHealthStatus {
  isHealthy: boolean | null;
  isChecking: boolean;
  error: Error | null;
}

/**
 * Custom React hook to check the health of the backend API.
 * Performs a GET request to /healthz and returns health status, loading, and error info.
 */
export function useApiHealth() {
  const [status, setStatus] = useState<ApiHealthStatus>({
    isHealthy: null,
    isChecking: true,
    error: null,
  });

  useEffect(() => {
    async function checkApiConnection() {
      if (!API_BASE_URL) {
        setStatus({
          isHealthy: false,
          isChecking: false,
          error: new Error("API_BASE_URL is not configured"),
        });
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/healthz`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (response.ok) {
          setStatus({ isHealthy: true, isChecking: false, error: null });
        } else {
          setStatus({
            isHealthy: false,
            isChecking: false,
            error: new Error(`API returned status ${response.status}`),
          });
        }
      } catch (error) {
        setStatus({
          isHealthy: false,
          isChecking: false,
          error: error instanceof Error ? error : new Error("Unknown error"),
        });
      }
    }

    checkApiConnection();
  }, []);

  return status;
}