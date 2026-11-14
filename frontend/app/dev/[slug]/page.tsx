import path from "path";
import { promises as fs } from "fs";
import { notFound } from "next/navigation";
import { mdToHtmlLite } from "@/lib/markdown-lite";
import { getNeighbors, listAllDevlogs } from "@/lib/devlogs";
import DevlogPost from "./DevlogPost";
import styles from "./devpost.module.css";

export const runtime = "nodejs";
export const dynamic = "force-static";

/** Every post is pre-rendered at build time. */
export function generateStaticParams() {
  return listAllDevlogs().map((post) => ({ slug: post.slug }));
}

/** The post body: the file without its front matter (lib/devlogs.ts reads that). */
function stripFrontMatter(src: string): string {
  return src.replace(/^---\s*[\s\S]*?\s*---\s*/, "");
}

export default async function DevPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Only slugs lib/devlogs.ts knows, so the URL can't reach any other file.
  const post = listAllDevlogs().find((d) => d.slug === slug);
  if (!post) notFound();

  const file = path.join(process.cwd(), "content", "devlogs", `${post.slug}.md`);
  const html = mdToHtmlLite(stripFrontMatter(await fs.readFile(file, "utf8")));
  const { prev, next } = getNeighbors(post.slug);

  return (
    <main className={styles.main}>
      <DevlogPost post={post} html={html} newer={prev} older={next} />
    </main>
  );
}
