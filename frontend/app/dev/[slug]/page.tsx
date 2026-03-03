import path from "path";
import { notFound } from "next/navigation";
import { mdToHtmlLite } from "@/lib/markdown-lite";
import { getNeighbors } from "@/lib/devlogs";
import { promises as fs } from "fs";
import Link from "next/link";
import styles from "./devpost.module.css";

export const runtime = "nodejs";
export const dynamic = "force-static";

// Tiny front matter parser
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

function formatDate(d?: string): string | undefined {
  if (!d) return undefined;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function DevPostPage({
  params,
}: {
  params: { slug: string }; // app router passes a plain object; no Promise needed
}) {
  const { slug } = params;

  const file = path.join(process.cwd(), "content", "devlogs", `${slug}.md`);
  try {
    await fs.access(file);
  } catch {
    return notFound();
  }

  const md = await fs.readFile(file, "utf8");
  const { meta, body } = parseFrontMatter(md);
  const html = mdToHtmlLite(body);
  const niceDate = formatDate(meta.date);

  const { prev, next } = getNeighbors(slug);

  return (
    <main className={styles.main}>
      {/* Post header */}
      <header className={styles.postHeader}>
        {meta.title && <h1 className={styles.title}>{meta.title}</h1>}

        {(niceDate || meta.author) && (
          <p className={styles.meta}>
            {niceDate ? (
              <>
                Dags: <time>{niceDate}</time>
              </>
            ) : null}
            {niceDate && meta.author ? " · " : null}
            {meta.author ? <>Höfundur: {meta.author}</> : null}
          </p>
        )}

        {meta.summary && <p className={styles.summary}>{meta.summary}</p>}
      </header>

      {/* Post content */}
      <article className={styles.content}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </article>

      {/* Footer navigation */}
      <nav className={styles.footerNav} aria-label="Færslunavigering">
        <Link
          href="/dev"
          className={styles.btn}
          aria-label="Til baka á Devlog"
          title="Til baka á Devlog"
        >
          Til baka
        </Link>

        <div className={styles.navGroup}>
          {prev && (
            <Link
              href={`/dev/${prev.slug}`}
              className={styles.btn}
              aria-label="Fyrri færsla"
              title={prev.title}
            >
              Fyrri
            </Link>
          )}
          {next && (
            <Link
              href={`/dev/${next.slug}`}
              className={styles.btn}
              aria-label="Næsta færsla"
              title={next.title}
            >
              Næsta
            </Link>
          )}
        </div>
      </nav>
    </main>
  );
}
