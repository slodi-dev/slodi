import UserManagement from "@/components/UserManagement/UserManagement";
import styles from "./admin.module.css";

export default function AdminPage() {
    return (
        <main className={styles.main}>
            <div className={styles.header}>
                <h1 className={styles.title}>Stjórnun</h1>
                <p className={styles.subtitle}>Stjórnaðu kerfinu og notendum.</p>
            </div>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Notendur</h2>
                <UserManagement />
            </section>
        </main>
    );
}
