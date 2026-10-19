// app/dev/page.tsx
import DevlogClient from "@/app/dev/DevlogClient";
import { listAllDevlogs, paginateDevlogs } from "@/lib/devlogs";
import { tagsByUse, todayIso } from "./devlogView";
import styles from "./dev.module.css";

// The list comes from the file system, so it changes on deploy. A daily rebuild keeps "Nýtt"
// (posts up to 14 days old, judged against the server's "today") from going stale in between.
export const dynamic = "force-static";
export const revalidate = 86400;

const PAGE_SIZE = 10;

export default async function DevPage() {
  const { total, items } = paginateDevlogs(0, PAGE_SIZE);
  const tags = tagsByUse(listAllDevlogs());

  return (
    <main className={styles.main}>
      <DevlogClient
        initialItems={items}
        total={total}
        pageSize={PAGE_SIZE}
        today={todayIso()}
        tags={tags}
      />
    </main>
  );
}
