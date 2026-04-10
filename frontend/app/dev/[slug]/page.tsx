import path from "path";
import { notFound } from "next/navigation";
import { mdToHtmlLite } from "@/lib/markdown-lite";
import { getNeighbors, listAllDevlogs } from "@/lib/devlogs";
import { formatIcelandicDate } from "@/utils/date";
import { promises as fs } from "fs";
import Link from "next/link";
import styles from "./devpost.module.css";

export const runtime = "nodejs";
export const dynamic = "force-static";

// Tiny front matter parser. Array fields (tags) are read separately via
// listAllDevlogs so we don't duplicate the YAML parser in lib/devlogs.ts.
function parseFrontMatter(src: string): {
  meta: { title?: string; date?: string; summary?: string; author?: string };
  body: string;
} {
  const m = src.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);
  if (!m) return { meta: {}, body: src };

  const raw = m[1];
  const body = m[2];
  const meta: Record<string, string> = {};

  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf(":");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    const val = t
      .slice(i + 1)
      .trim()
      .replace(/^"(.*)"$/, "$1")
      .replace(/^'(.*)'$/, "$1");
    meta[key] = val;
  }
  return {
    meta: { title: meta.title, date: meta.date, summary: meta.summary, author: meta.author },
    body,
  };
}

export async function generateStaticParams() {
  return listAllDevlogs().map((d) => ({ slug: d.slug }));
}

export default async function DevPostPage({
  params,
}: {
  params: Promise<{ slug: string }>; // Next.js 15: params is async
}) {
  const { slug } = await params;

  const file = path.join(process.cwd(), "content", "devlogs", `${slug}.md`);
  try {
    await fs.access(file);
  } catch {
    return notFound();
  }

  const md = await fs.readFile(file, "utf8");
  const { meta, body } = parseFrontMatter(md);
  const html = mdToHtmlLite(body);
  const niceDate = meta.date ? formatIcelandicDate(meta.date) : undefined;

  // Pull tags (array field) from the canonical parser so we don't duplicate
  // YAML-array handling in this file.
  const current = listAllDevlogs().find((d) => d.slug === slug);
  const tags = current?.tags ?? [];

  const { prev, next } = getNeighbors(slug);

  return (
    <main className={styles.main}>
      <Link href="/dev" className={styles.backLink} aria-label="Til baka á Verkbók">
        <span aria-hidden>←</span> Verkbók
      </Link>

      {/* Post header */}
      <header className={styles.postHeader}>
        <p className={styles.eyebrow}>Devlog</p>

        {meta.title && <h1 className={styles.title}>{meta.title}</h1>}

        {(niceDate || meta.author) && (
          <p className={styles.meta}>
            {niceDate ? <time dateTime={meta.date}>{niceDate}</time> : null}
            {niceDate && meta.author ? <span className={styles.metaSep}>·</span> : null}
            {meta.author ? <span>{meta.author}</span> : null}
          </p>
        )}

        {meta.summary && <p className={styles.summary}>{meta.summary}</p>}

        {tags.length > 0 && (
          <ul className={styles.tags} aria-label="Merkingar">
            {tags.map((t) => (
              <li key={t} className={styles.tag}>
                {t}
              </li>
            ))}
          </ul>
        )}
      </header>

      {/* Post content */}
      <article className={styles.content}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </article>

      {/* Footer navigation — card-style prev/next with neighbour titles */}
      <nav className={styles.footerNav} aria-label="Færslunavigering">
        {prev ? (
          <Link
            href={`/dev/${prev.slug}`}
            className={styles.navCard}
            aria-label={`Fyrri færsla: ${prev.title}`}
          >
            <span className={styles.navLabel}>← Fyrri færsla</span>
            <span className={styles.navTitle}>{prev.title}</span>
          </Link>
        ) : (
          <div className={styles.navPlaceholder} aria-hidden />
        )}

        {next ? (
          <Link
            href={`/dev/${next.slug}`}
            className={`${styles.navCard} ${styles.navCardNext}`}
            aria-label={`Næsta færsla: ${next.title}`}
          >
            <span className={styles.navLabel}>Næsta færsla →</span>
            <span className={styles.navTitle}>{next.title}</span>
          </Link>
        ) : (
          <div className={styles.navPlaceholder} aria-hidden />
        )}
      </nav>
    </main>
  );
}
