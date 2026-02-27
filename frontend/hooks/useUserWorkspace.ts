// frontend/hooks/useUserWorkspace.ts
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { getOrCreatePersonalWorkspace } from "../services/workspaces.service";

// Custom hook to fetch or create the user's personal workspace
export function useUserWorkspace() {
    // Get authentication context
    const { user, getToken, isAuthenticated } = useAuth();
    // State to hold workspace ID
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);
    // State to track loading status
    const [isLoading, setIsLoading] = useState(false);
    // State to track any errors
    const [error, setError] = useState<Error | null>(null);

    // Effect runs when authentication or user changes
    useEffect(() => {
        // Async function to fetch or create workspace
        async function fetchUserWorkspace() {
            // Only proceed if user is authenticated and user object exists
            if (!isAuthenticated || !user) return;

            try {
                setIsLoading(true); // Start loading
                setError(null);     // Reset error
                // Get authentication token
                const token = await getToken();
                if (!token) throw new Error("No authentication token");

                // Fetch or create the user's personal workspace
                const workspace = await getOrCreatePersonalWorkspace(token);
                setWorkspaceId(workspace.id); // Store workspace ID
            } catch (err) {
                // Log and set error state
                console.error("Failed to get user workspace:", err);
                setError(err instanceof Error ? err : new Error('Unknown error'));
            } finally {
                setIsLoading(false); // Stop loading
            }
        }

        fetchUserWorkspace(); // Invoke the async function
    }, [isAuthenticated, user, getToken]);

    // Return workspace ID, loading, and error states
    return { workspaceId, isLoading, error };
}
