import Link from "next/link";
import styles from "./skatathing.module.css";

export const metadata = {
  title: "Skátaþing — Slóði",
};

export default function SkatathingHubPage() {
  return (
    <div className={styles.hub}>
      <h1 className={styles.hubTitle}>Skátaþing</h1>
      <div className={styles.tileGrid}>
        <Link href="/skatathing/heidursordla" className={`${styles.tile} ${styles.tileActive}`}>
          <span className={styles.tileTitle}>Heiðursorðla</span>
          <span className={styles.tileSubtitle}>Spila</span>
        </Link>
        <Link href="/leikir/horpuhopp" className={`${styles.tile} ${styles.tileActive}`}>
          <span className={styles.tileTitle}>Hörpuhopp</span>
          <span className={styles.tileSubtitle}>Spila</span>
        </Link>
        <div className={`${styles.tile} ${styles.tileDisabled}`} aria-disabled="true">
          <span className={styles.tileTitle}>Tengingar</span>
          <span className={styles.tileSubtitle}>Kemur bráðum</span>
        </div>
      </div>
    </div>
  );
}
