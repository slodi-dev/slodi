/**
 * API utility functions for handling fetch responses and errors
 */

// Get the API base URL - must be absolute URL for client-side requests
const getApiBase = (): string => {
  // Check if we're on the client side
  if (typeof window !== 'undefined') {
    // In browser, use NEXT_PUBLIC_API_URL or construct from window.location
    return process.env.NEXT_PUBLIC_API_URL || window.location.origin;
  }

  // On server side, use NEXT_PUBLIC_API_URL or fallback
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
};

const API_BASE = getApiBase();

/**
 * Validates if a fetch response is successful
 * @param response The fetch Response object
 * @throws Error if response is not ok
 */
export async function checkResponse(response: Response): Promise<void> {
  if (!response.ok) {
    // Try to get error details from response body
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;

    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        // FastAPI typically returns errors in a "detail" field
        if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string'
            ? errorData.detail
            : JSON.stringify(errorData.detail);
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else {
          errorMessage = JSON.stringify(errorData);
        }
      }
    } catch (parseError) {
      // If we can't parse the error, use the default message
      console.error("Failed to parse error response:", parseError);
    }

    console.error("API Error Details:", {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      message: errorMessage
    });

    throw new Error(errorMessage);
  }
}

/**
 * Validates if a fetch response is successful (Icelandic error message)
 * @param response The fetch Response object
 * @throws Error if response is not ok (with Icelandic message)
 */
export async function checkResponseIs(response: Response): Promise<void> {
  if (!response.ok) {
    // Try to get error details from response body
    let errorMessage = `Villa kom upp: ${response.status} ${response.statusText}`;

    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        // FastAPI typically returns errors in a "detail" field
        if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string'
            ? `Villa: ${errorData.detail}`
            : `Villa: ${JSON.stringify(errorData.detail)}`;
        } else if (errorData.message) {
          errorMessage = `Villa: ${errorData.message}`;
        }
      }
    } catch (parseError) {
      console.error("Gat ekki lesið villuskilaboð:", parseError);
    }

    console.error("API Villa:", {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      message: errorMessage
    });

    throw new Error(errorMessage);
  }
}

/**
 * Fetches data and validates the response
 * @param url The URL to fetch from
 * @param options Fetch options
 * @returns The parsed JSON data
 * @throws Error if response is not ok
 */
export async function fetchAndCheck<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options);
  await checkResponse(response);

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  // Check if response has JSON content
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }

  // Return empty object for non-JSON responses
  return {} as T;
}

/**
 * Fetches data and validates the response (Icelandic error messages)
 * @param url The URL to fetch from
 * @param options Fetch options
 * @returns The parsed JSON data
 * @throws Error if response is not ok (with Icelandic message)
 */
export async function fetchAndCheckIs<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options);
  await checkResponseIs(response);

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  // Check if response has JSON content
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }

  // Return empty object for non-JSON responses
  return {} as T;
}

/**
 * Builds a full API URL from an endpoint path
 * @param endpoint The endpoint path (e.g., "/programs" or "api/programs")
 * @param baseUrl Optional base URL (defaults to API_BASE)
 * @returns The complete URL
 */
export function buildApiUrl(endpoint: string, baseUrl: string = API_BASE): string {
  // Ensure we have a valid base URL
  if (!baseUrl || baseUrl === '/api') {
    baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  }

  // Remove leading slash from endpoint if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

  try {
    const url = new URL(cleanEndpoint, baseUrl);
    return url.toString();
  } catch (error) {
    console.error('Failed to build API URL:', {
      endpoint,
      baseUrl,
      cleanEndpoint,
      window: typeof window !== 'undefined' ? window.location.origin : 'N/A',
      env: process.env.NEXT_PUBLIC_API_URL,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Handles API errors by extracting useful error messages
 * @param error The error object
 * @param defaultMessage Default message if error cannot be parsed
 * @returns A user-friendly error message
 */
export function handleApiError(
  error: unknown,
  defaultMessage: string = "An unknown error occurred"
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return defaultMessage;
}

/**
 * Handles API errors with Icelandic default message
 * @param error The error object
 * @param defaultMessage Default message if error cannot be parsed
 * @returns A user-friendly error message in Icelandic
 */
export function handleApiErrorIs(
  error: unknown,
  defaultMessage: string = "Óþekkt villa kom upp"
): string {
  if (error instanceof Error) {
    return error.message;
  }
  return defaultMessage;
}

/**
 * Creates a FormData object from a plain object
 * @param data The data to convert
 * @returns FormData object
 */
export function createFormData(data: Record<string, string | number | boolean | File | object | null | undefined>): FormData {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      if (value instanceof File) {
        formData.append(key, value);
      } else if (Array.isArray(value) || typeof value === "object") {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    }
  });

  return formData;
}

export { API_BASE };