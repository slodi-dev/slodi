// lib/devlogs.ts
import fs from "fs";
import path from "path";

export type DevlogMeta = {
  slug: string;
  title: string;
  date: string; // ISO or YYYY-MM-DD
  author?: string;
  tags?: string[];
  summary?: string;
};

// Store devlogs under content/devlogs so they can be read at build time and on the server (runtime=nodejs)
const DEVLOG_DIR = path.join(process.cwd(), "content", "devlogs");

/** Very small front-matter parser (no external libs). */
function parseFrontMatter(src: string): Record<string, unknown> {
  const fmMatch = src.match(/^---\s*([\s\S]*?)\s*---/);
  if (!fmMatch) return {};
  const body = fmMatch[1];
  const out: Record<string, unknown> = {};
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    // key: value
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const raw = trimmed.slice(idx + 1).trim();

    // crude array detection: ["a","b"] or [a, b]
    if (/^\[.*\]$/.test(raw)) {
      const inner = raw.slice(1, -1).trim();
      const arr = inner
        ? inner.split(",").map((s) =>
            s
              .trim()
              .replace(/^"(.*)"$/, "$1")
              .replace(/^'(.*)'$/, "$1")
          )
        : [];
      out[key] = arr;
    } else {
      out[key] = raw.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
  return out;
}

export function listAllDevlogs(): DevlogMeta[] {
  if (!fs.existsSync(DEVLOG_DIR)) return [];
  const files = fs
    .readdirSync(DEVLOG_DIR)
    .filter((f) => f.endsWith(".md") && !/^template\.md$/i.test(f));

  const items: DevlogMeta[] = [];
  for (const file of files) {
    const full = path.join(DEVLOG_DIR, file);
    const content = fs.readFileSync(full, "utf8");
    const fm = parseFrontMatter(content);

    const title = String(fm.title ?? "").trim();
    const date = String(fm.date ?? "").trim();
    const author = fm.author ? String(fm.author) : undefined;
    const tags = Array.isArray(fm.tags) ? (fm.tags as string[]) : undefined;
    const summary = fm.summary ? String(fm.summary) : undefined;

    // slug from filename without extension
    const slug = file.replace(/\.md$/, "");

    if (!title || !date) continue; // must-have fields
    items.push({ slug, title, date, author, tags, summary });
  }

  // newest → oldest
  items.sort((a, b) => {
    const ad = new Date(a.date).getTime();
    const bd = new Date(b.date).getTime();
    return isNaN(bd - ad) ? 0 : bd - ad;
  });

  return items;
}

/** Paginate on the server */
export function paginateDevlogs(offset: number, limit: number) {
  const all = listAllDevlogs();
  const slice = all.slice(offset, offset + limit);
  return { total: all.length, items: slice };
}

export function getNeighbors(slug: string) {
  const all = listAllDevlogs(); // newest → oldest
  const idx = all.findIndex((p) => p.slug === slug);
  if (idx === -1) return { prev: null, next: null };

  // In a newest → oldest array:
  // prev = newer item (lower index), next = older item (higher index)
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx < all.length - 1 ? all[idx + 1] : null;
  return { prev, next };
}
