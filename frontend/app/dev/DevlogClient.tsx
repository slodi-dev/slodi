"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DevlogMeta } from "@/lib/devlogs";
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

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (done || loading) return;
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      async (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting || loading || done) return;

        setLoading(true);
        try {
          const res = await fetch(`/api/devlogs?offset=${offset}&limit=${pageSize}`, {
            cache: "no-store",
          });
          if (!res.ok) throw new Error("Failed to load");
          const data = (await res.json()) as { total: number; items: DevlogMeta[] };
          setItems((prev) => [...prev, ...data.items]);
          const nextOffset = offset + data.items.length;
          setOffset(nextOffset);
          if (nextOffset >= data.total || data.items.length === 0) setDone(true);
        } catch (e) {
          console.error("Error loading more devlogs:", e);
          // Fail softly; manual button remains available
        } finally {
          setLoading(false);
        }
      },
      { rootMargin: "200px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [offset, pageSize, done, loading]);

  const loadMore = async () => {
    if (loading || done) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/devlogs?offset=${offset}&limit=${pageSize}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { total: number; items: DevlogMeta[] };
      setItems((prev) => [...prev, ...data.items]);
      const nextOffset = offset + data.items.length;
      setOffset(nextOffset);
      if (nextOffset >= data.total || data.items.length === 0) setDone(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ul className={styles.list}>
        {items.map((post) => (
          <li key={post.slug} className={styles.listItem}>
            <div className={styles.headerRow}>
              <h2 className={styles.title}>{post.title}</h2>
              <time className={styles.date}>{formatDate(post.date)}</time>
            </div>
            {post.summary && <p className={styles.summary}>{post.summary}</p>}
            <div>
              <Link href={`/dev/${post.slug}`} className={styles.readMore}>
                Lesa nánar
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {!done && <div ref={sentinelRef} className={styles.sentinel} aria-hidden />}

      {!done && (
        <div className={styles.actions}>
          <button type="button" onClick={loadMore} disabled={loading} className={styles.button}>
            {loading ? "Hleð..." : "Hlaða inn meira"}
          </button>
        </div>
      )}

      {done && items.length === 0 && <p className={styles.empty}>Engar færslur fundust.</p>}
    </>
  );
}

function formatDate(d: string) {
  try {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return d;
  }
}
