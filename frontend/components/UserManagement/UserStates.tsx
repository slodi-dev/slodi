import { cn } from "@/lib/util";
import styles from "./UserManagement.module.css";

/** The list and panel in outline while the users load. */
export function UserListSkeleton() {
  const rows = Array.from({ length: 6 }, (_, i) => i);
  return (
    <div>
      <p role="status" className={styles.srOnly}>
        Sæki notendur…
      </p>
      <div className={styles.skeleton} aria-hidden="true">
        <div className={styles.skeletonList}>
          {rows.map((i) => (
            <div key={i} className={styles.skeletonRow}>
              <span className={cn(styles.bone, styles.boneAvatar)} />
              <span className={styles.boneStack}>
                <span className={cn(styles.bone, styles.boneLong)} />
                <span className={cn(styles.bone, styles.boneShort)} />
              </span>
            </div>
          ))}
        </div>
        <div className={styles.skeletonPanel}>
          <span className={cn(styles.bone, styles.boneTitle)} />
          <span className={cn(styles.bone, styles.boneLong)} />
          <span className={cn(styles.bone, styles.boneBlock)} />
        </div>
      </div>
    </div>
  );
}

export function UserListError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={styles.stateBox} role="alert">
      <p className={styles.stateTitle}>Úps! {message}</p>
      <button type="button" className={cn(styles.button, styles.buttonPrimary)} onClick={onRetry}>
        Reyna aftur
      </button>
    </div>
  );
}

export function NoUsers() {
  return (
    <div className={styles.stateBox}>
      <p className={styles.stateTitle}>Engir notendur enn.</p>
      <p className={styles.stateText}>
        Notendur birtast hér um leið og þau skrá sig inn í Slóða í fyrsta sinn.
      </p>
    </div>
  );
}

export function NoMatch({ query, onReset }: { query: string; onReset: () => void }) {
  return (
    <div className={styles.stateBox}>
      <p className={styles.stateTitle}>
        {query.trim()
          ? `Enginn notandi passar við „${query.trim()}“.`
          : "Enginn notandi með þessi réttindi."}
      </p>
      <p className={styles.stateText}>Prófaðu annað leitarorð eða aðra síu.</p>
      <button type="button" className={cn(styles.button, styles.buttonSecondary)} onClick={onReset}>
        Hreinsa leit og síur
      </button>
    </div>
  );
}
