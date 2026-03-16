import styles from "../[id]/program-detail.module.css";

export function ProgramDetailSkeleton() {
  return (
    <div className={styles.container}>
      <div className={styles.skeleton}>Hleð dagskrá...</div>
    </div>
  );
}
