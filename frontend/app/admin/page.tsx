import { Suspense } from "react";
import Link from "next/link";
import UserManagement from "@/components/UserManagement/UserManagement";
import styles from "./admin.module.css";

/**
 * A `div`, not `main`: the layout's `<main id="efni">` already wraps every page.
 * Suspense because the user list keeps its search, filter and selection in the
 * URL (useSearchParams).
 */
export default function AdminPage() {
  return (
    <div className={styles.main}>
      <div className={styles.header}>
        <h1 className={styles.title}>Stjórnun</h1>
        <p className={styles.subtitle}>Stjórnaðu kerfinu og notendum.</p>
      </div>

      <nav className={styles.section} aria-label="Stjórnun">
        <Link href="/admin/emails">Tölvupóstur →</Link>
      </nav>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Notendur</h2>
        <Suspense>
          <UserManagement />
        </Suspense>
      </section>
    </div>
  );
}
