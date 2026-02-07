import { useEffect, useState } from "react";

// Get the API base URL from environment or use default
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

// Type for the API health status returned by the hook
interface ApiHealthStatus {
  isHealthy: boolean | null; // null = not checked yet, true/false = result
  isChecking: boolean;      // true while checking
  error: Error | null;      // error object if check failed
}

/**
 * Custom React hook to check the health of the backend API.
 * Performs a GET request to /healthz and returns health status, loading, and error info.
 */
export function useApiHealth() {
  // State to track API health status
  const [status, setStatus] = useState<ApiHealthStatus>({
    isHealthy: null,
    isChecking: true,
    error: null,
  });

  useEffect(() => {
    // Function to check API health
    async function checkApiConnection() {
      // Log the API base URL being used
      console.log("Checking API connection...");
      console.log("API_BASE_URL:", API_BASE_URL);
      
      // If API_BASE_URL is not set, log error and update state
      if (!API_BASE_URL) {
        const error = new Error("API_BASE_URL is not configured");
        console.error(
          "API_BASE_URL is not configured! Set API_BASE_URL in .env.local",
          "color: red; font-weight: bold; font-size: 14px;"
        );
        setStatus({ isHealthy: false, isChecking: false, error });
        return;
      }

      try {
        // Attempt to fetch the /healthz endpoint
        console.log("Attempting to fetch API health endpoint...");
        const response = await fetch(`${API_BASE_URL}/healthz`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });
        
        // Log the response status
        console.log("Response received:", {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
        });
        
        if (response.ok) {
          // If response is OK, parse JSON and update state to healthy
          const data = await response.json();
          console.log("API is reachable. Response data:", data);
          setStatus({ isHealthy: true, isChecking: false, error: null });
        } else {
          // If response is not OK, log warning and update state to unhealthy
          console.warn(
            `API returned status ${response.status}: ${response.statusText}`,
            "color: orange; font-weight: bold; font-size: 14px;"
          );
          setStatus({ 
            isHealthy: false, 
            isChecking: false, 
            error: new Error(`API returned status ${response.status}`) 
          });
        }
      } catch (error) {
        // If fetch fails, log error and update state
        console.error(
          "Failed to reach API. See error details below.",
          "color: red; font-weight: bold; font-size: 14px;"
        );
        console.error("Error details:", error);
        
        // If error is a fetch TypeError, provide CORS and server hints
        if (error instanceof TypeError && error.message.includes("fetch")) {
          console.error(
            "This might be a CORS issue or the API is not running.",
            "color: blue; font-weight: bold;"
          );
          console.error("Check:");
          console.error("  1. Is your API running? Try: curl http://localhost:8000/healthz");
          console.error("  2. Does your API have CORS enabled for http://localhost:3000?");
          console.error("  3. Is the port correct? (currently using 8000)");
        }
        
        setStatus({ 
          isHealthy: false, 
          isChecking: false, 
          error: error instanceof Error ? error : new Error('Unknown error') 
        });
      }
    }

    // Run the health check on mount
    checkApiConnection();
  }, []);

  // Return the API health status object
  return status;
}
