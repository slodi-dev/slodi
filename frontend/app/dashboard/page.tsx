import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  return (
    <div className={styles.dashboardPage}>
      <h1 className={styles.title}>Velkomin í Stjórnborð Slóða</h1>
      <p className={styles.subtitle}>
        Hér verða alls kyns yfirlit og upplýsingar seinna, en núna er þetta bara smá lendingarpallur
        sem beinir þér inn á dagskrárbankann.
      </p>

      <Link href="/programs" className={styles.programBankCard}>
        <div className={styles.cardContent}>
          <Sparkles className={styles.sparkleIcon} aria-hidden="true" />
          <div className={styles.cardText}>
            <h2 className={styles.cardTitle}>Dagskrárbankinn</h2>
            <p className={styles.cardDescription}>Skoðaðu dagsrkárhugmyndir héðan og þaðan</p>
          </div>
          <ArrowRight className={styles.arrowIcon} aria-hidden="true" />
        </div>
      </Link>
    </div>
  );
}
