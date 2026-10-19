"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DevlogMeta } from "@/lib/devlogs";
import { formatIcelandicDate } from "@/lib/format";
import styles from "./devlog.module.css";

type Props = {
  initialItems: DevlogMeta[];
  total: number;
  pageSize: number;
};

export default function DevlogClient({ initialItems, total, pageSize }: Props) {
  const [items, setItems] = useState<DevlogMeta[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(initialItems.length);
  const [done, setDone] = useState(initialItems.length >= total);
  const [failed, setFailed] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (done || loading || failed) return;
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      async (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting || loading || done) return;

        await fetchMore();
      },
      { rootMargin: "200px" }
    );

    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchMore reads the same state
  }, [offset, pageSize, done, loading, failed]);

  async function fetchMore() {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/devlogs?offset=${offset}&limit=${pageSize}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`devlogs ${res.status}`);
      const data = (await res.json()) as { total: number; items: DevlogMeta[] };
      setItems((prev) => [...prev, ...data.items]);
      const nextOffset = offset + data.items.length;
      setOffset(nextOffset);
      if (nextOffset >= data.total || data.items.length === 0) setDone(true);
    } catch {
      // The observer stops retrying; the reader gets the error and a retry button.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  const loadMore = () => {
    if (!loading && !done) void fetchMore();
  };

  return (
    <>
      {items.length === 0 && !done ? (
        <ul className={styles.grid} aria-busy="true" aria-label="Hleður færslum">
          {[0, 1, 2].map((i) => (
            <li key={i} className={styles.skeletonCard} aria-hidden>
              <div className={`${styles.skeletonLine} ${styles.short}`} />
              <div className={`${styles.skeletonLine} ${styles.medium}`} />
              <div className={`${styles.skeletonLine} ${styles.full}`} />
              <div className={`${styles.skeletonLine} ${styles.full}`} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className={styles.grid}>
          {items.map((post) => (
            <li key={post.slug}>
              <article className={styles.card}>
                <p className={styles.eyebrow}>
                  <time className={styles.date} dateTime={post.date}>
                    {formatDate(post.date)}
                  </time>
                  {post.author ? <span aria-hidden>·</span> : null}
                  {post.author ? <span>{post.author}</span> : null}
                </p>
                <h2 className={styles.title}>{post.title}</h2>
                {post.summary && <p className={styles.summary}>{post.summary}</p>}
                {post.tags && post.tags.length > 0 && (
                  <ul className={styles.tags} aria-label="Merkingar">
                    {post.tags.map((t) => (
                      <li key={t} className={styles.tag}>
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href={`/dev/${post.slug}`}
                  className={styles.stretchedLink}
                  aria-label={`Lesa: ${post.title}`}
                />
              </article>
            </li>
          ))}
        </ul>
      )}

      {!done && items.length > 0 && (
        <div ref={sentinelRef} className={styles.sentinel} aria-hidden />
      )}

      {loading && items.length > 0 && <p className={styles.loadingLine}>Hleð…</p>}

      {failed && (
        <p role="alert" className={styles.loadingLine}>
          Ekki tókst að sækja fleiri færslur.
        </p>
      )}

      {!done && items.length > 0 && (
        <div className={styles.actions}>
          <button type="button" onClick={loadMore} disabled={loading} className={styles.button}>
            {loading ? "Sæki fleiri færslur…" : failed ? "Reyna aftur" : "Hlaða inn meira"}
          </button>
        </div>
      )}

      {done && items.length === 0 && <p className={styles.empty}>Engar færslur fundust.</p>}
    </>
  );
}

// Not Intl: Chrome has no is-IS data, so the browser and the server (which
// rendered this page) would print different dates and hydration would fail.
function formatDate(d: string) {
  return formatIcelandicDate(d) || d;
}
