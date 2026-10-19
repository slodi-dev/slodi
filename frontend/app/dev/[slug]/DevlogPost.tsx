"use client";

import { Suspense, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { DevlogMeta } from "@/lib/devlogs";
import { formatIcelandicDate } from "@/lib/format";
import {
  DEVLOG_PATH,
  FROM_PARAM,
  backToListHref,
  isDevlogListHref,
  listHrefFor,
  postHref,
} from "../devlogView";
import styles from "./devpost.module.css";

type Props = {
  post: DevlogMeta;
  /** The post body as HTML (`mdToHtmlLite` of the post file). */
  html: string;
  /** `getNeighbors().prev`: the next newer post. */
  newer?: DevlogMeta | null;
  /** `getNeighbors().next`: the next older post. */
  older?: DevlogMeta | null;
};

const formatDate = (date: string) => formatIcelandicDate(date) || date;

/**
 * One devlog post, from Lab/Devlog: a 65ch reading column, date and author above the title, tags
 * that lead to the filtered list, and the neighbours named by direction ("Nýrri/Eldri færsla"),
 * which a newest-first list makes unambiguous.
 *
 * "Aftur í Verkbók" returns to the list URL the reader came from (`?fra=`, else a same-site
 * referrer, else `/dev`); the neighbour links carry `?fra=` along.
 */
export default function DevlogPost({ post, html, newer, older }: Props) {
  return (
    <article className={styles.post}>
      <ListAwareLink className={styles.back}>
        <ArrowLeft aria-hidden="true" className={styles.icon} />
        Aftur í Verkbók
      </ListAwareLink>

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
                <Link href={listHrefFor(tag)} className={styles.tag}>
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className={styles.prose} dangerouslySetInnerHTML={{ __html: html }} />

      {newer || older ? (
        <nav className={styles.neighbours} aria-label="Fleiri færslur">
          {newer ? <Neighbour post={newer} direction="newer" /> : <span />}
          {older ? <Neighbour post={older} direction="older" /> : null}
        </nav>
      ) : null}
    </article>
  );
}

function Neighbour({ post, direction }: { post: DevlogMeta; direction: "newer" | "older" }) {
  const Arrow = direction === "newer" ? ArrowLeft : ArrowRight;
  return (
    <ListAwareLink
      slug={post.slug}
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
    </ListAwareLink>
  );
}

type ListAwareLinkProps = {
  /** A post to link to, carrying `?fra=` along. Without it, the link goes back to the list. */
  slug?: string;
  className?: string;
  children: ReactNode;
};

/** Where the link goes before the browser knows the list URL: the bare list, or the bare post. */
const plainHref = (slug?: string) => (slug ? postHref(slug) : DEVLOG_PATH);

/**
 * A link that knows the list URL the reader came from. The server renders the plain link (the
 * page is static and can't see the query); the browser swaps in the list-aware one.
 */
function ListAwareLink(props: ListAwareLinkProps) {
  return (
    <Suspense
      fallback={
        <Link href={plainHref(props.slug)} className={props.className}>
          {props.children}
        </Link>
      }
    >
      <ListAwareLinkInBrowser {...props} />
    </Suspense>
  );
}

const noSubscribe = () => () => {};

function ListAwareLinkInBrowser({ slug, className, children }: ListAwareLinkProps) {
  const from = useSearchParams()?.get(FROM_PARAM);
  const referrer = useSyncExternalStore(
    noSubscribe,
    () => document.referrer,
    () => ""
  );
  const origin = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => ""
  );

  const href = slug
    ? postHref(slug, isDevlogListHref(from) ? from : DEVLOG_PATH)
    : backToListHref(from, referrer, origin);

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
