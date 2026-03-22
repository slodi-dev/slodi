"use client";

import { useEffect, useState } from "react";

/**
 * Resolve the default (shared program bank) workspace ID.
 *
 * Fetches /api/config (a server-side Next.js route that reads the workspace ID
 * from the seed_output.json file on the shared Docker volume) and caches the
 * result in sessionStorage so subsequent renders are instant.
 */
export function useDefaultWorkspaceId(): string | null {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    // Check session cache first to avoid a fetch on every render.
    const cached =
      typeof sessionStorage !== "undefined" ? sessionStorage.getItem("default_workspace_id") : null;

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
