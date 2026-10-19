import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { DevlogMeta } from "@/lib/devlogs";
import { formatIcelandicDate } from "@/lib/format";
import styles from "./DevlogPostLab.module.css";

export interface DevlogPostLabProps {
  post: DevlogMeta;
  /** The post body, already rendered (the app gets it from `mdToHtmlLite`). */
  children: ReactNode;
  /** `getNeighbors().prev`: the next newer post. */
  newer?: DevlogMeta | null;
  /** `getNeighbors().next`: the next older post. */
  older?: DevlogMeta | null;
  /** The list URL the reader came from, filter included (`/dev?merki=leikir`). */
  listHref?: string;
  /** Where the posts live: a post is `${basePath}/${slug}`, a tag `${basePath}?merki=…`. */
  basePath?: string;
}

const formatDate = (date: string) => formatIcelandicDate(date) || date;

/**
 * Lab copy of `app/dev/[slug]/page.tsx`: a 65ch reading column, the date and author up top,
 * tags that lead to the filtered list, and newer/older posts named by direction rather than
 * "Fyrri/Næsta", which in a newest-first list is ambiguous.
 */
export default function DevlogPostLab({
  post,
  children,
  newer,
  older,
  listHref = "/dev",
  basePath = "/dev",
}: DevlogPostLabProps) {
  return (
    <article className={styles.post}>
      <Link href={listHref} className={styles.back}>
        <ArrowLeft aria-hidden="true" className={styles.icon} />
        Aftur í Verkbók
      </Link>

      <header className={styles.header}>
        <p className={styles.meta}>
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          {post.author ? (
            <>
              <span aria-hidden="true"> · </span>
              <span>{post.author}</span>
            </>
          ) : null}
        </p>
        <h1 className={styles.title}>{post.title}</h1>
        {post.summary ? <p className={styles.summary}>{post.summary}</p> : null}
        {post.tags?.length ? (
          <ul className={styles.tags} aria-label="Merkimiðar">
            {post.tags.map((tag) => (
              <li key={tag}>
                <Link href={`${basePath}?merki=${encodeURIComponent(tag)}`} className={styles.tag}>
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className={styles.prose}>{children}</div>

      {newer || older ? (
        <nav className={styles.neighbours} aria-label="Fleiri færslur">
          {newer ? <NeighbourCard post={newer} basePath={basePath} direction="newer" /> : <span />}
          {older ? <NeighbourCard post={older} basePath={basePath} direction="older" /> : null}
        </nav>
      ) : null}
    </article>
  );
}

function NeighbourCard({
  post,
  basePath,
  direction,
}: {
  post: DevlogMeta;
  basePath: string;
  direction: "newer" | "older";
}) {
  const Arrow = direction === "newer" ? ArrowLeft : ArrowRight;
  return (
    <Link
      href={`${basePath}/${post.slug}`}
      className={`${styles.neighbour} ${direction === "older" ? styles.older : ""}`}
    >
      <span className={styles.neighbourLabel}>
        <Arrow aria-hidden="true" className={styles.icon} />
        {direction === "newer" ? "Nýrri færsla" : "Eldri færsla"}
      </span>
      <span className={styles.neighbourTitle}>{post.title}</span>
      <time className={styles.neighbourDate} dateTime={post.date}>
        {formatDate(post.date)}
      </time>
    </Link>
  );
}
