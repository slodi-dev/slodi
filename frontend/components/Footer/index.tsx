import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footerRoot}>
      <div className={styles.footerContent}>
        <p className={styles.footerText}>&copy; 2025 Slóði. Öll réttindi áskilin.</p>
      </div>
    </footer>
  );
}
