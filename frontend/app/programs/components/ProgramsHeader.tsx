// frontend/app/programs/components/ProgramsHeader.tsx
import styles from "./ProgramsHeader.module.css";

interface ProgramsHeaderProps {
    onNewProgram: () => void;
}

export function ProgramsHeader({ onNewProgram }: ProgramsHeaderProps) {
    return (
        <>
            <header>
                <div>
                    <h1>Dagskrárbankinn</h1>
                    <p>Leitaðu að og skoðaðu dagskrár hugmyndir.</p>
                </div>
            </header>

            <button
                type="button"
                className={styles.fab}
                onClick={onNewProgram}
                aria-label="Bæta við dagskrá"
            >
                <svg className={styles.fabIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className={styles.fabLabel}>Bæta við dagskrá</span>
            </button>
        </>
    );
}
