export const DEFAULT_WORKSPACE_ID = process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID || "";
export const PROGRAMS_PER_PAGE = 12;

export const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

// Validate configuration on import (only in development)
if (process.env.NODE_ENV === 'development' && !process.env.API_BASE_URL) {
    console.warn(
        "API_BASE_URL is not set. Using default: http://localhost:8000"
    );
}

// Validation: warn if default workspace ID is not set
if (!DEFAULT_WORKSPACE_ID) {
	console.error("NEXT_PUBLIC_DEFAULT_WORKSPACE_ID is not configured");
}
