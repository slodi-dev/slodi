// hooks/useProgramActions.ts
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { Program } from "@/services/programs.service";
import { ROUTES } from "@/constants/routes";

export function useProgramActions(program: Program | null) {
  const router = useRouter();

  const handleShare = useCallback(async () => {
    if (!program) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: program.name,
          text: program.description || "",
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Hlekkur afritaður!");
      }
    } catch (error) {
      console.error("Failed to share:", error);
    }
  }, [program]);

  const handleAddToWorkspace = useCallback(() => {
    // TODO: Implement add to workspace
    alert("Bæta við vinnusvæði - kemur síðar");
  }, []);

  const handleBack = useCallback(() => {
    router.push(ROUTES.PROGRAMS);
  }, [router]);

  return { handleShare, handleAddToWorkspace, handleBack };
}
