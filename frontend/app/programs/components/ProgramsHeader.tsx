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
}

export function ProgramsHeader({ onNewContent, suspendedUntil }: ProgramsHeaderProps) {
  const reason = !suspendedUntil
    ? undefined
    : suspendedUntil === "open-ended"
      ? "Þú getur ekki sent inn efni"
      : `Þú getur ekki sent inn efni fram til ${formatIcelandicDate(suspendedUntil)}`;

  return (
    // Disabled with a reason, never hidden. A button that vanishes reads as a
    // bug and produces a support message instead of understanding.
    <div className={styles.fabAnchor}>
      <ContentTypeChooser
        onChoose={onNewContent}
        disabled={!!suspendedUntil}
        disabledReason={reason}
      />
    </div>
  );
}
