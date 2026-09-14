"use client";

// frontend/app/programs/components/ProgramsHeader.tsx
import ContentTypeChooser, {
  type BankContentType,
} from "@/components/ContentTypeChooser/ContentTypeChooser";
import { formatIcelandicDate } from "@/lib/format";
import styles from "./ProgramsHeader.module.css";

interface ProgramsHeaderProps {
  /** Called with what the leader chose to make, not just that they want to. */
  onNewContent: (type: BankContentType) => void;
  /** ISO date this leader can submit again, if they are in skammarkrókur. */
  suspendedUntil?: string | null;
  /** Whether this leader may post here at all — `canCreateProgram`, same rule as the server. */
  canCreate?: boolean;
}

export function ProgramsHeader({
  onNewContent,
  suspendedUntil,
  canCreate = true,
}: ProgramsHeaderProps) {
  // Suspension wins the explanation when both apply: it is the more specific
  // reason, and it is the only one of the two that names a way out.
  const reason = suspendedUntil
    ? suspendedUntil === "open-ended"
      ? "Þú getur ekki sent inn efni"
      : `Þú getur ekki sent inn efni fram til ${formatIcelandicDate(suspendedUntil)}`
    : canCreate
      ? undefined
      : "Þú hefur ekki aðgang að því að senda inn efni hér";

  return (
    // Disabled with a reason, never hidden. A button that vanishes reads as a
    // bug and produces a support message instead of understanding.
    <div className={styles.fabAnchor}>
      <ContentTypeChooser
        onChoose={onNewContent}
        disabled={!!suspendedUntil || !canCreate}
        disabledReason={reason}
      />
    </div>
  );
}
