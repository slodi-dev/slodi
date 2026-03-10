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
      <p>This is a test to see if the automatic deployment on Azure VM works correctly.</p>
      <h1 className={styles.title}>Verkbók</h1>
      <p>test</p>
      <DevlogClient initialItems={items} total={total} pageSize={PAGE_SIZE} />
    </main>
  );
}
