// frontend/app/programs/components/ProgramsHeader.tsx
import styles from "./ProgramsHeader.module.css";

interface ProgramsHeaderProps {
  onNewProgram: () => void;
  /** ISO date this leader can submit again, if they are in skammarkrókur. */
  suspendedUntil?: string | null;
}

export function ProgramsHeader({ onNewProgram, suspendedUntil }: ProgramsHeaderProps) {
  return (
    <>
      {/* Disabled with a reason, never hidden. A button that vanishes reads as
          a bug and produces a support message instead of understanding. */}
      <button
        className={styles.fab}
        onClick={onNewProgram}
        disabled={!!suspendedUntil}
        aria-label={
          suspendedUntil
            ? `Þú getur ekki sent inn efni fram til ${suspendedUntil}`
            : "Bæta við dagskrá"
        }
        title={
          suspendedUntil ? `Þú getur ekki sent inn efni fram til ${suspendedUntil}` : undefined
        }
      >
        <svg className={styles.fabIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className={styles.fabLabel}>Bæta við í dagskrá</span>
      </button>
    </>
  );
}
