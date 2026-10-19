"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Footprints } from "lucide-react";
import Alert from "@/components/Alert/Alert";
import Button from "@/components/Button/Button";
import type { DevlogMeta } from "@/lib/devlogs";
import { countIs, formatIcelandicDate, formatIcelandicDateShort } from "@/lib/format";
import styles from "./DevlogLab.module.css";

export type DevlogLook = "slodi" | "breytingaskra" | "forsida" | "timarit";

/** A devlog post, plus an optional cover image for the magazine look. */
export type DevlogLabPost = DevlogMeta & { cover?: string };

/** `loading` with no posts is the first load (skeleton); with posts, it's loading more. */
export type DevlogLoadState = "idle" | "loading" | "failed";

export interface DevlogLabProps {
  /** Which lab variation to render. */
  look: DevlogLook;
  /** The posts loaded so far, newest first. */
  items: DevlogLabPost[];
  /** How many posts the server has in all. */
  total: number;
  state?: DevlogLoadState;
  /** Posts up to 14 days older than this get "Nýtt". An ISO date; defaults to now. */
  today?: string;
  /** Show the page header (title, lead, post count) above the list. */
  showHeader?: boolean;
  /** Where the posts live: a post's link is `${basePath}/${slug}`. */
  basePath?: string;
  /** "Sýna eldri færslur" and "Reyna aftur". */
  onLoadMore?: () => void;
}

const NEW_FOR_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
/** How many tags the filter bar offers, most used first. */
const FILTER_TAGS = 6;
const SKELETON_COUNT = 4;

const formatDate = (date: string) => formatIcelandicDate(date) || date;
const formatDateShort = (date: string) => formatIcelandicDateShort(date) || date;
/** "október 2026": the Icelandic date without its day. */
const monthOf = (date: string) => formatIcelandicDate(date).replace(/^\d+\.\s/, "") || date;
const yearOf = (date: string) => monthOf(date).split(" ").pop() ?? date;

function isNew(date: string, today: string | undefined) {
  const now = today ? Date.parse(today) : Date.now();
  const age = (now - Date.parse(date)) / DAY_MS;
  return age >= 0 && age < NEW_FOR_DAYS;
}

/** Consecutive posts that share a label, in their original order. */
function groupBy(posts: DevlogLabPost[], label: (post: DevlogLabPost) => string) {
  const groups: { label: string; posts: DevlogLabPost[] }[] = [];
  for (const post of posts) {
    const key = label(post);
    const last = groups[groups.length - 1];
    if (last?.label === key) last.posts.push(post);
    else groups.push({ label: key, posts: [post] });
  }
  return groups;
}

/** The tags in use, most frequent first, ties in the order they first appear. */
function topTags(posts: DevlogLabPost[]) {
  const counts = new Map<string, number>();
  for (const post of posts)
    for (const tag of post.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, FILTER_TAGS)
    .map(([tag]) => tag);
}

/** The same post always gets the same fallback cover tint. */
function tintOf(slug: string) {
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return ["tintPrimary", "tintAccent", "tintInfo", "tintWarning"][hash % 4];
}

/**
 * Lab copy of `app/dev/DevlogClient` (and the page header around it), same data plus `look`.
 * Presentational: the parent owns fetching and passes `state`.
 *
 * Every card or row is one link. The link is the title, stretched over the card with `::after`,
 * so its accessible name is just the title and no hidden text is needed.
 */
export default function DevlogLab({
  look,
  items,
  total,
  state = "idle",
  today,
  showHeader = true,
  basePath = "/dev",
  onLoadMore,
}: DevlogLabProps) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const tags = useMemo(() => topTags(items), [items]);
  const shown = activeTag ? items.filter((p) => p.tags?.includes(activeTag)) : items;

  const firstLoad = items.length === 0 && state === "loading";
  const empty = items.length === 0 && !firstLoad;
  const hasMore = items.length > 0 && items.length < total;
  const ctx: LookContext = { posts: shown, basePath, today };

  return (
    <div className={`${styles.devlog} ${styles[look]}`}>
      {showHeader ? (
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
      ) : null}

      {tags.length > 1 ? (
        <div className={styles.filter} role="group" aria-label="Sía eftir merkimiða">
          <button
            type="button"
            className={styles.chip}
            aria-pressed={activeTag === null}
            onClick={() => setActiveTag(null)}
          >
            Allar
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={styles.chip}
              aria-pressed={activeTag === tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}

      {firstLoad ? <Skeleton look={look} /> : null}
      {empty ? <Empty /> : null}
      {shown.length > 0 ? <LookList look={look} ctx={ctx} /> : null}

      {hasMore ? (
        <div className={styles.more}>
          <p className={styles.moreCount}>
            Sýni {items.length} af {countIs(total, "færslu", "færslum")}
          </p>
          {state === "failed" ? (
            <Alert variant="error" className={styles.moreError}>
              Ekki tókst að sækja fleiri færslur. Athugaðu tenginguna og reyndu aftur.
            </Alert>
          ) : null}
          <Button
            variant="secondary"
            className={styles.moreButton}
            onClick={onLoadMore}
            disabled={state === "loading"}
          >
            {state === "loading"
              ? "Sæki fleiri færslur…"
              : state === "failed"
                ? "Reyna aftur"
                : "Sýna eldri færslur"}
          </Button>
        </div>
      ) : null}

      {look === "slodi" && items.length > 0 && !hasMore && !activeTag ? (
        <p className={styles.trailEnd}>Hér hefst slóðinn.</p>
      ) : null}
    </div>
  );
}

type LookContext = { posts: DevlogLabPost[]; basePath: string; today?: string };

function LookList({ look, ctx }: { look: DevlogLook; ctx: LookContext }) {
  if (look === "slodi") return <Timeline {...ctx} />;
  if (look === "breytingaskra") return <Changelog {...ctx} />;
  if (look === "forsida") return <Featured {...ctx} />;
  return <Magazine {...ctx} />;
}

/* ── Shared pieces ───────────────────────────────────────────────────────── */

function PostLink({ post, basePath }: { post: DevlogLabPost; basePath: string }) {
  return (
    <Link href={`${basePath}/${post.slug}`} className={styles.link}>
      {post.title}
    </Link>
  );
}

function NewMark({ post, today }: { post: DevlogLabPost; today?: string }) {
  return isNew(post.date, today) ? <span className={styles.new}>Nýtt</span> : null;
}

function Tags({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null;
  return (
    <ul className={styles.tags} aria-label="Merkimiðar">
      {tags.map((tag) => (
        <li key={tag} className={styles.tag}>
          {tag}
        </li>
      ))}
    </ul>
  );
}

function Byline({ post, short = false }: { post: DevlogLabPost; short?: boolean }) {
  return (
    <p className={styles.byline}>
      <time dateTime={post.date}>{short ? formatDateShort(post.date) : formatDate(post.date)}</time>
      {post.author ? (
        <>
          <span aria-hidden="true"> · </span>
          <span>{post.author}</span>
        </>
      ) : null}
    </p>
  );
}

/* ── A · Slóði: a trail down the left, grouped by month ─────────────────── */

function Timeline({ posts, basePath, today }: LookContext) {
  return (
    <div className={styles.timeline}>
      {groupBy(posts, (p) => monthOf(p.date)).map((group) => (
        <section key={group.label} className={styles.month}>
          <h2 className={styles.monthLabel}>{group.label}</h2>
          <ol className={styles.trail}>
            {group.posts.map((post) => (
              <li key={post.slug} className={styles.stop}>
                <article className={`${styles.card} ${styles.stopCard}`}>
                  <time className={styles.stopDate} dateTime={post.date}>
                    {formatDateShort(post.date)}
                  </time>
                  <div className={styles.stopBody}>
                    <h3 className={styles.title}>
                      <PostLink post={post} basePath={basePath} />
                    </h3>
                    {post.author || isNew(post.date, today) ? (
                      <p className={styles.byline}>
                        <NewMark post={post} today={today} />
                        {post.author ? <span>{post.author}</span> : null}
                      </p>
                    ) : null}
                    {post.summary ? <p className={styles.summary}>{post.summary}</p> : null}
                    <Tags tags={post.tags} />
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/* ── B · Breytingaskrá: compact rows under year headings ────────────────── */

function Changelog({ posts, basePath, today }: LookContext) {
  return (
    <div className={styles.changelog}>
      {groupBy(posts, (p) => yearOf(p.date)).map((group) => (
        <section key={group.label}>
          <h2 className={styles.yearLabel}>{group.label}</h2>
          <ol className={styles.rows}>
            {group.posts.map((post) => (
              <li key={post.slug}>
                <article className={`${styles.card} ${styles.row}`}>
                  <time className={styles.rowDate} dateTime={post.date}>
                    {formatDateShort(post.date)}
                  </time>
                  <div className={styles.rowMain}>
                    <h3 className={styles.rowTitle}>
                      <PostLink post={post} basePath={basePath} />
                      <NewMark post={post} today={today} />
                    </h3>
                    {post.summary ? <p className={styles.rowSummary}>{post.summary}</p> : null}
                  </div>
                  <Tags tags={post.tags} />
                </article>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/* ── C · Forsíða: the newest post large, older ones in a grid ───────────── */

function Featured({ posts, basePath, today }: LookContext) {
  const [lead, ...rest] = posts;
  return (
    <div className={styles.featured}>
      <article className={`${styles.card} ${styles.leadCard}`}>
        <p className={styles.kicker}>
          Nýjasta færslan
          <NewMark post={lead} today={today} />
        </p>
        <h2 className={styles.leadTitle}>
          <PostLink post={lead} basePath={basePath} />
        </h2>
        {lead.summary ? <p className={styles.leadSummary}>{lead.summary}</p> : null}
        <Byline post={lead} />
        <Tags tags={lead.tags} />
      </article>

      {rest.length > 0 ? (
        <section>
          <h2 className={styles.sectionLabel}>Eldri færslur</h2>
          <ul className={styles.grid}>
            {rest.map((post) => (
              <li key={post.slug}>
                <article className={`${styles.card} ${styles.gridCard}`}>
                  <Byline post={post} />
                  <h3 className={styles.title}>
                    <PostLink post={post} basePath={basePath} />
                  </h3>
                  {post.summary ? <p className={styles.summary}>{post.summary}</p> : null}
                  <Tags tags={post.tags} />
                </article>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/* ── D · Tímarit: covers, with a drawn fallback when there's no image ───── */

function Cover({ post }: { post: DevlogLabPost }) {
  return (
    <div className={`${styles.cover} ${styles[tintOf(post.slug)]}`} aria-hidden="true">
      {post.cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- lab copy, no next/image loader in Storybook
        <img src={post.cover} alt="" className={styles.coverImage} />
      ) : (
        <Footprints className={styles.coverIcon} />
      )}
    </div>
  );
}

function Magazine({ posts, basePath, today }: LookContext) {
  return (
    <ul className={styles.magazine}>
      {posts.map((post) => (
        <li key={post.slug}>
          <article className={`${styles.card} ${styles.issue}`}>
            <Cover post={post} />
            <div className={styles.issueBody}>
              <p className={styles.kicker}>
                {post.tags?.[0] ?? "Verkbók"}
                <NewMark post={post} today={today} />
              </p>
              <h2 className={styles.title}>
                <PostLink post={post} basePath={basePath} />
              </h2>
              {post.summary ? <p className={styles.summary}>{post.summary}</p> : null}
              <Byline post={post} />
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

/* ── Empty and loading ───────────────────────────────────────────────────── */

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

const Bone = ({ w, tall = false }: { w: "short" | "medium" | "full"; tall?: boolean }) => (
  <span className={`${styles.bone} ${styles[w]} ${tall ? styles.tall : ""}`} />
);

/** A skeleton in the shape of each look, so nothing jumps when the posts arrive. */
function Skeleton({ look }: { look: DevlogLook }) {
  const slots = Array.from({ length: SKELETON_COUNT }, (_, i) => i);
  const busy = { "aria-busy": true, "aria-label": "Sæki færslur" } as const;

  if (look === "slodi") {
    return (
      <div className={styles.timeline} {...busy} role="group">
        <div className={styles.month} aria-hidden="true">
          <Bone w="short" tall />
          <ol className={styles.trail}>
            {slots.map((i) => (
              <li key={i} className={styles.stop}>
                <div className={`${styles.card} ${styles.stopCard}`}>
                  <span className={styles.stopDate}>
                    <Bone w="medium" />
                  </span>
                  <div className={styles.stopBody}>
                    <Bone w="medium" tall />
                    <Bone w="full" />
                    <Bone w="short" />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  if (look === "breytingaskra") {
    return (
      <div className={styles.changelog} {...busy} role="group">
        <div aria-hidden="true">
          <Bone w="short" tall />
          <ol className={styles.rows}>
            {slots.map((i) => (
              <li key={i}>
                <div className={`${styles.card} ${styles.row}`}>
                  <span className={styles.rowDate}>
                    <Bone w="full" />
                  </span>
                  <div className={styles.rowMain}>
                    <Bone w="medium" tall />
                    <Bone w="full" />
                  </div>
                  <span className={styles.tags}>
                    <Bone w="full" />
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  if (look === "forsida") {
    return (
      <div className={styles.featured} {...busy} role="group">
        <div className={`${styles.card} ${styles.leadCard}`} aria-hidden="true">
          <Bone w="short" />
          <Bone w="full" tall />
          <Bone w="medium" tall />
          <Bone w="full" />
          <Bone w="short" />
        </div>
        <ul className={styles.grid} aria-hidden="true">
          {slots.slice(1).map((i) => (
            <li key={i}>
              <div className={`${styles.card} ${styles.gridCard}`}>
                <Bone w="short" />
                <Bone w="medium" tall />
                <Bone w="full" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div {...busy} role="group">
      <ul className={styles.magazine} aria-hidden="true">
        {slots.map((i) => (
          <li key={i}>
            <div className={`${styles.card} ${styles.issue}`}>
              <div className={`${styles.cover} ${styles.coverBone}`} />
              <div className={styles.issueBody}>
                <Bone w="short" />
                <Bone w="medium" tall />
                <Bone w="full" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
