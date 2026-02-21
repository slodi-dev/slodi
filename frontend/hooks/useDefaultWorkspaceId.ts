"use client";

import { useEffect, useState } from "react";
import { DEFAULT_WORKSPACE_ID } from "@/constants/config";

/**
 * Resolve the default (shared program bank) workspace ID.
 *
 * In development, NEXT_PUBLIC_DEFAULT_WORKSPACE_ID is set in .env and baked
 * into the build. In Docker, when the frontend is built before the backend
 * workspace is seeded, the env var may be empty. In that case this hook
 * fetches /api/config (which proxies GET /config/public on the backend) and
 * caches the result in sessionStorage so subsequent renders are instant.
 */
export function useDefaultWorkspaceId(): string | null {
  const [workspaceId, setWorkspaceId] = useState<string | null>(
    DEFAULT_WORKSPACE_ID || null
  );

  useEffect(() => {
    // Already resolved via env var — nothing to do.
    if (DEFAULT_WORKSPACE_ID) return;

    // Check session cache first to avoid a fetch on every render.
    const cached =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem("default_workspace_id")
        : null;

    if (cached) {
      setWorkspaceId(cached);
      return;
    }

    let cancelled = false;

    async function resolve() {
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const id: string | undefined = data?.default_workspace_id;
        if (id && !cancelled) {
          sessionStorage.setItem("default_workspace_id", id);
          setWorkspaceId(id);
        }
      } catch {
        // Non-fatal: programs page will simply stay empty until a workspace ID
        // is configured.
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  return workspaceId;
}
