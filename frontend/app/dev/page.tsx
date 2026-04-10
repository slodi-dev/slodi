// app/dev/page.tsx
import DevlogClient from "@/app/dev/DevlogClient";
import { paginateDevlogs } from "@/lib/devlogs";
import styles from "./dev.module.css";

export const dynamic = "force-static"; // list from filesystem; rebuild on deploy

export default async function DevPage() {
  const PAGE_SIZE = 10;
  const { total, items } = paginateDevlogs(0, PAGE_SIZE);

  return (
    <main className={styles.main}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Devlog</p>
        <h1 className={styles.title}>Verkbók</h1>
        <p className={styles.lead}>
          Þróunardagbók Slóða — uppfærslur, ákvarðanir og lærdómur úr vinnunni.
        </p>
      </header>
      <DevlogClient initialItems={items} total={total} pageSize={PAGE_SIZE} />
    </main>
  );
}
