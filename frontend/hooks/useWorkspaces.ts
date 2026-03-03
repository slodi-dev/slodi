// Hook for fetching workspaces

export function useWorkspaces() {
  // TODO: Implement SWR or TanStack Query

  return {
    workspaces: [],
    isLoading: false,
    isError: false,
  };
}
