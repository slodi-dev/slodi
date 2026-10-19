"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * TanStack Query for the app (A1, sc-34).
 *
 * The client is created in state rather than at module scope: a module-level
 * client is shared across requests on the server, which leaks one user's cached
 * data into another's render.
 */
export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Planning data is edited by co-leaders in other tabs and other
            // people, so it goes stale quickly, but not so fast that switching
            // views refetches everything.
            staleTime: 30_000,
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
