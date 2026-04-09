import EmailManagement from "@/components/EmailManagement/EmailManagement";
import TemplateTextEditor from "@/components/EmailManagement/TemplateTextEditor";
import styles from "../admin.module.css";

export default function AdminEmailsPage() {
  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <h1 className={styles.title}>Tölvupóstur</h1>
        <p className={styles.subtitle}>Veldu sniðmát, fylltu út og sendu.</p>
      </div>

      <EmailManagement />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Breyta texta í sniðmátum</h2>
        <TemplateTextEditor />
      </section>
    </main>
  );
}
