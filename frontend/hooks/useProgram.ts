import { useState, useEffect } from "react";
import { fetchProgramById, type Program } from "@/services/programs.service";
import { useAuth } from "@/hooks/useAuth";

function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export function useProgram(id: string) {
  const { getToken } = useAuth();
  const [program, setProgram] = useState<Program | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchProgram() {
      if (!isValidUUID(id)) {
        setError(new Error("Invalid program ID format"));
        setProgram(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchProgramById(id, getToken);
        setProgram(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
        setProgram(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProgram();
  }, [id, getToken]);

  return { program, isLoading, error, setProgram };
}