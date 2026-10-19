"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Footprints } from "lucide-react";
import Alert from "@/components/Alert/Alert";
import Button from "@/components/Button/Button";
import type { DevlogMeta } from "@/lib/devlogs";
import { countIs, formatIcelandicDate, formatIcelandicNumber } from "@/lib/format";
import { isOptimisableImageUrl } from "@/lib/image-hosts";
import {
  DEVLOG_PATH,
  TAG_PARAM,
  coverTintOf,
  isNewPost,
  listHrefFor,
  postHref,
  type CoverTint,
} from "./devlogView";
import styles from "./devlog.module.css";

type Props = {
  /** The first page, rendered on the server. */
  initialItems: DevlogMeta[];
  /** How many posts there are in all. */
  total: number;
  pageSize: number;
  /** `YYYY-MM-DD`, computed on the server, so "Nýtt" is the same on both sides of hydration. */
  today: string;
  /** The tags the filter offers, most used first (`tagsByUse` over every post). */
  tags: string[];
};

/** How many tags the filter bar offers. A tag from the URL is added if it isn't among them. */
const FILTER_TAGS = 8;
/** How many tags a card shows before "+N". */
const CARD_TAGS = 3;
const SKELETON_CARDS = 4;

/**
 * The /dev list (Verkbók), "D · Magazine" from Lab/Devlog: cover cards, the newest one wide.
 *
 * The server renders the first page; older posts load from `/api/devlogs` when the end of the list
 * scrolls into view, or on the button. A failed load stops the automatic loading and offers
 * "Reyna aftur".
 *
 * The tag filter lives in the URL (`?merki=`, written with `replace`) and filters the posts loaded
 * so far on the client: the page is static, so the server never sees the query. Loading more keeps
 * filling the filtered list.
 *
 * Every card is one link: the title, stretched over the card with `::after`, so its accessible
 * name is the title alone.
 */
export default function DevlogClient({ initialItems, total, pageSize, today, tags }: Props) {
  const [items, setItems] = useState<DevlogMeta[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(initialItems.length);
  const [done, setDone] = useState(initialItems.length >= total);
  const [failed, setFailed] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname() ?? DEVLOG_PATH;
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

  const chooseTag = (tag: string | null) => {
    setActiveTag(tag);
    router.replace(tag ? `${pathname}?${TAG_PARAM}=${encodeURIComponent(tag)}` : pathname, {
      scroll: false,
    });
  };

  const shown = activeTag ? items.filter((post) => post.tags?.includes(activeTag)) : items;
  const listHref = listHrefFor(activeTag);
  const filterTags = filterTagsFor(tags, activeTag);

  const firstLoad = items.length === 0 && !done;
  const hasMore = items.length > 0 && !done;

  return (
    <div className={styles.devlog}>
      <Suspense fallback={null}>
        <TagFromUrl onTag={setActiveTag} />
      </Suspense>

      <header className={styles.header}>
        <p className={styles.eyebrow}>Þróunardagbók Slóða</p>
        <h1 className={styles.pageTitle}>Verkbók</h1>
        <p className={styles.lead}>
          Hvað kom í loftið, hvað við ákváðum og hvað við lærðum á leiðinni.
        </p>
        {items.length > 0 ? (
          <p className={styles.pageMeta}>
            {countIs(total, "færsla", "færslur")} · nýjust{" "}
            <time dateTime={items[0].date}>{formatDate(items[0].date)}</time>
          </p>
        ) : null}
      </header>

      {filterTags.length > 1 ? (
        <div className={styles.filter}>
          <div className={styles.chips} role="group" aria-label="Sía eftir merkimiða">
            <button
              type="button"
              className={styles.chip}
              aria-pressed={activeTag === null}
              onClick={() => chooseTag(null)}
            >
              Allar
            </button>
            {filterTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={styles.chip}
                aria-pressed={activeTag === tag}
                onClick={() => chooseTag(activeTag === tag ? null : tag)}
              >
                {tag}
              </button>
            ))}
          </div>
          <p className={styles.filterStatus} role="status">
            {activeTag && shown.length > 0
              ? `${countIs(shown.length, "færsla", "færslur")} með merkimiðann „${activeTag}“`
              : ""}
          </p>
        </div>
      ) : null}

      {firstLoad ? <Skeleton /> : null}
      {done && items.length === 0 ? <Empty /> : null}
      {activeTag && items.length > 0 && shown.length === 0 ? (
        <NoMatch tag={activeTag} hasMore={hasMore} onShowAll={() => chooseTag(null)} />
      ) : null}

      {shown.length > 0 ? (
        <ul className={styles.magazine}>
          {shown.map((post, index) => (
            <li key={post.slug}>
              <PostCard post={post} today={today} listHref={listHref} lead={index === 0} />
            </li>
          ))}
        </ul>
      ) : null}

      {hasMore ? <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" /> : null}

      {hasMore ? (
        <div className={styles.more}>
          <p className={styles.moreCount} role="status">
            Sýni {formatIcelandicNumber(items.length)} af {countIs(total, "færslu", "færslum")}
          </p>
          {failed ? (
            <Alert variant="error" className={styles.moreError}>
              Ekki tókst að sækja fleiri færslur. Athugaðu tenginguna og reyndu aftur.
            </Alert>
          ) : null}
          <Button
            variant="secondary"
            className={styles.moreButton}
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? "Sæki fleiri færslur…" : failed ? "Reyna aftur" : "Sýna eldri færslur"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Reads `?merki=` into the list's state. Its own Suspense boundary: `useSearchParams` on a static
 * page renders nothing on the server, and this way only this empty component waits, not the list.
 */
function TagFromUrl({ onTag }: { onTag: (tag: string | null) => void }) {
  const tag = useSearchParams()?.get(TAG_PARAM) ?? null;
  useEffect(() => onTag(tag), [tag, onTag]);
  return null;
}

/** The most used tags, plus the active one if it isn't among them. */
function filterTagsFor(tags: string[], activeTag: string | null): string[] {
  const top = tags.slice(0, FILTER_TAGS);
  return activeTag && !top.includes(activeTag) ? [...top, activeTag] : top;
}

// Not Intl: Chrome has no is-IS data, so the browser and the server (which
// rendered this page) would print different dates and hydration would fail.
function formatDate(date: string) {
  return formatIcelandicDate(date) || date;
}

const TINT_CLASS: Record<CoverTint, string> = {
  primary: styles.tintPrimary,
  accent: styles.tintAccent,
  info: styles.tintInfo,
  warning: styles.tintWarning,
};

/** A local path (`/…`, not `//…`) or our blob container goes through the image optimiser. */
function canOptimise(src: string) {
  return /^\/(?!\/)/.test(src) || isOptimisableImageUrl(src);
}

/** `lead`: the wide newest card, whose cover is the largest thing above the fold. */
function Cover({ post, lead }: { post: DevlogMeta; lead: boolean }) {
  return (
    <div className={`${styles.cover} ${TINT_CLASS[coverTintOf(post.slug)]}`} aria-hidden="true">
      {post.cover ? (
        <Image
          src={post.cover}
          alt=""
          fill
          sizes="(min-width: 48rem) 40rem, 100vw"
          className={styles.coverImage}
          priority={lead}
          unoptimized={!canOptimise(post.cover)}
        />
      ) : (
        <Footprints className={styles.coverIcon} />
      )}
    </div>
  );
}

function PostCard({
  post,
  today,
  listHref,
  lead,
}: {
  post: DevlogMeta;
  today: string;
  listHref: string;
  lead: boolean;
}) {
  const fresh = isNewPost(post.date, today);
  const tags = post.tags ?? [];
  const hiddenTags = tags.length - CARD_TAGS;

  return (
    <article className={styles.card}>
      <Cover post={post} lead={lead} />
      <div className={styles.cardBody}>
        {fresh || tags.length > 0 ? (
          <div className={styles.kicker}>
            {fresh ? <span className={styles.new}>Nýtt</span> : null}
            {tags.length > 0 ? (
              <ul className={styles.tags} aria-label="Merkimiðar">
                {tags.slice(0, CARD_TAGS).map((tag) => (
                  <li key={tag} className={styles.tag}>
                    {tag}
                  </li>
                ))}
                {hiddenTags > 0 ? (
                  <li className={styles.tagMore}>{`+${formatIcelandicNumber(hiddenTags)}`}</li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : null}
        <h2 className={styles.title}>
          <Link href={postHref(post.slug, listHref)} className={styles.link}>
            {post.title}
          </Link>
        </h2>
        {post.summary ? <p className={styles.summary}>{post.summary}</p> : null}
        <p className={styles.byline}>
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          {post.author ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{post.author}</span>
            </>
          ) : null}
        </p>
      </div>
    </article>
  );
}

function Empty() {
  return (
    <div className={styles.empty}>
      <Footprints className={styles.emptyIcon} aria-hidden="true" />
      <p className={styles.emptyTitle}>Engar færslur enn</p>
      <p className={styles.emptyText}>
        Hér segir teymið frá því sem kemst í loftið. Fyrsta færslan er á leiðinni.
      </p>
    </div>
  );
}

/** The filter matches none of the posts loaded so far. */
function NoMatch({
  tag,
  hasMore,
  onShowAll,
}: {
  tag: string;
  hasMore: boolean;
  onShowAll: () => void;
}) {
  return (
    <div className={styles.empty}>
      <Footprints className={styles.emptyIcon} aria-hidden="true" />
      <p className={styles.emptyTitle}>Engin færsla með merkimiðann „{tag}“</p>
      <p className={styles.emptyText}>
        {hasMore
          ? "Ekki í þeim færslum sem eru komnar. Sæktu eldri færslur hér fyrir neðan eða sýndu allar."
          : "Prófaðu annan merkimiða eða sýndu allar færslurnar."}
      </p>
      <Button variant="ghost" onClick={onShowAll}>
        Sýna allar færslur
      </Button>
    </div>
  );
}

const Bone = ({ width, tall = false }: { width: "short" | "medium" | "full"; tall?: boolean }) => (
  <span className={`${styles.bone} ${styles[width]} ${tall ? styles.tall : ""}`} />
);

/** Cards in the magazine's shape, the first one wide, so nothing jumps when the posts arrive. */
function Skeleton() {
  return (
    <div role="group" aria-busy="true" aria-label="Sæki færslur">
      <ul className={styles.magazine} aria-hidden="true">
        {Array.from({ length: SKELETON_CARDS }, (_, i) => (
          <li key={i}>
            <div className={styles.card}>
              <div className={`${styles.cover} ${styles.coverBone}`} />
              <div className={styles.cardBody}>
                <Bone width="short" />
                <Bone width="medium" tall />
                <Bone width="full" />
                <Bone width="full" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
