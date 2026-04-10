// lib/markdown-lite.ts
// Minimal, dependency-free Markdown → HTML for devlogs.
// Goals: simplicity, safety, readability. Not a full spec implementation.
//
// Supported block syntax:
//   - ATX headings (# … ######)
//   - Fenced code blocks with optional language info (```ts)
//   - Multi-line blockquotes (consecutive > lines merge, blank > = paragraph break)
//   - Unordered and ordered lists (nested by indentation)
//   - GitHub-style task list items ([ ] / [x])
//   - GFM tables with | --- | separator and optional :--: alignment
//   - Horizontal rules (---, ***, ___)
//
// Supported inline syntax:
//   - Inline code (backticks)
//   - Images: ![alt](url)
//   - Links: [label](url)
//   - Autolinks: <https://…> and <mailto:…>
//   - Bold: **text**
//   - Italic: *text*
//   - Strikethrough: ~~text~~

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Very small URL allowlist to avoid javascript: etc.
function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  return "#";
}

// Validate a code-fence info string so we only emit known-safe class names.
function sanitizeLang(info: string): string {
  const lang = info.trim().split(/\s+/)[0] ?? "";
  return /^[a-zA-Z0-9_-]+$/.test(lang) ? lang : "";
}

// Inline formatting: runs on a text chunk that is NOT inside code spans.
function renderInline(md: string): string {
  // Protect inline code by splitting on backticks
  const parts = md.split(/(`+)([\s\S]*?)(\1)/g); // delimiter, content, delimiter
  for (let i = 0; i < parts.length; i += 1) {
    // parts pattern: [text, delim, content, delim, text, delim, content, ...]
    if (i % 4 === 0) {
      let t = parts[i];

      // Autolinks: <https://…> or <mailto:…> — rewrite to bracket-link form
      // BEFORE we escape, so the downstream link regex picks them up and so
      // the url/label end up html-escaped exactly once.
      t = t.replace(/<((?:https?:|mailto:)[^\s>]+)>/gi, (_m, url) => `[${url}](${url})`);

      // HTML-escape the text. Everything after this point (url/label/alt
      // captures) is already escaped, so we must NOT re-escape when
      // substituting into attributes or element bodies.
      t = escapeHtml(t);

      // Images: ![alt](url) — must run before links so ![…](…) isn't
      // misread as a `[…](…)` link with a leading bang.
      t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, url) => {
        const safe = sanitizeUrl(String(url));
        return `<img src="${safe}" alt="${String(alt)}" loading="lazy" decoding="async" />`;
      });

      // Links: [label](url)
      t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
        const safe = sanitizeUrl(String(url));
        return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${String(label)}</a>`;
      });

      // Bold: **text**
      t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

      // Italic: *text*  (simple version, avoids conflict with bold we already handled)
      t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, (_m, pre, body) => `${pre}<em>${body}</em>`);

      // Strikethrough: ~~text~~
      t = t.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");

      parts[i] = t;
    } else if ((i - 1) % 4 === 0) {
      // this is a delimiter captured group → ignore
    } else if ((i - 2) % 4 === 0) {
      // code content
      parts[i] = `<code>${escapeHtml(parts[i])}</code>`;
    }
  }
  return parts.join("");
}

// Parse a GFM table separator row like `| --- | :--: | ---: |` into
// alignment values. Returns null if the row is not a valid separator.
function parseTableAlign(line: string): (null | "left" | "center" | "right")[] | null {
  const cells = splitTableRow(line);
  if (cells.length === 0) return null;
  const aligns: (null | "left" | "center" | "right")[] = [];
  for (const raw of cells) {
    const c = raw.trim();
    if (!/^:?-+:?$/.test(c)) return null;
    const left = c.startsWith(":");
    const right = c.endsWith(":");
    aligns.push(left && right ? "center" : right ? "right" : left ? "left" : null);
  }
  return aligns;
}

// Split a table row on `|`, handling leading/trailing pipes.
function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|");
}

function isTableRow(line: string): boolean {
  return /\|/.test(line);
}

export function mdToHtmlLite(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");

  let html = "";
  let inCode = false;
  let codeLang = "";
  let codeBuffer: string[] = [];

  let paragraph: string[] = [];

  // Buffered blockquote lines (without the leading `> `).
  let quoteBuffer: string[] | null = null;

  type ListCtx = { type: "ul" | "ol"; indent: number };
  const listStack: ListCtx[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      const text = paragraph.join(" ").trim();
      if (text) html += `<p>${renderInline(text)}</p>\n`;
      paragraph = [];
    }
  };

  const flushBlockquote = () => {
    if (!quoteBuffer) return;
    // Split the buffer into paragraphs on empty lines.
    const paragraphs: string[] = [];
    let current: string[] = [];
    for (const l of quoteBuffer) {
      if (l.trim() === "") {
        if (current.length) {
          paragraphs.push(current.join(" "));
          current = [];
        }
      } else {
        current.push(l);
      }
    }
    if (current.length) paragraphs.push(current.join(" "));
    html += "<blockquote>\n";
    for (const p of paragraphs) {
      html += `<p>${renderInline(p)}</p>\n`;
    }
    html += "</blockquote>\n";
    quoteBuffer = null;
  };

  const closeListsTo = (level: number) => {
    while (listStack.length > level) {
      html += `</li>\n</${listStack.pop()!.type}>\n`;
    }
  };

  const closeAllLists = () => closeListsTo(0);

  const flushAllOpenBlocks = () => {
    flushParagraph();
    flushBlockquote();
    closeAllLists();
  };

  for (let idx = 0; idx < lines.length; idx += 1) {
    const raw = lines[idx];
    const line = raw.replace(/\t/g, "    ");

    // Fenced code
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      if (!inCode) {
        flushAllOpenBlocks();
        inCode = true;
        codeLang = sanitizeLang(fence[1]);
        codeBuffer = [];
      } else {
        const classAttr = codeLang ? ` class="language-${codeLang}"` : "";
        html += `<pre><code${classAttr}>${escapeHtml(codeBuffer.join("\n"))}</code></pre>\n`;
        inCode = false;
        codeLang = "";
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(raw);
      continue;
    }

    // Blockquote — buffer consecutive `>` lines into a single <blockquote>.
    const bq = line.match(/^>\s?(.*)$/);
    if (bq) {
      flushParagraph();
      closeAllLists();
      if (!quoteBuffer) quoteBuffer = [];
      quoteBuffer.push(bq[1]);
      continue;
    } else if (quoteBuffer) {
      flushBlockquote();
    }

    // Blank line
    if (!line.trim()) {
      flushParagraph();
      if (listStack.length > 0) {
        // Loose list: a blank line inside a list does NOT end the list as
        // long as the next non-blank line is still a list item. We peek
        // ahead so `1.\n\n2.\n\n3.` renders as one <ol>, not three.
        let j = idx + 1;
        while (j < lines.length && !lines[j].trim()) j += 1;
        const next = j < lines.length ? lines[j].replace(/\t/g, "    ") : "";
        if (!/^\s*([-*+]|\d+\.)\s+/.test(next)) {
          closeAllLists();
        }
      } else {
        closeAllLists();
      }
      continue;
    }

    // Horizontal rule
    if (/^(\*\s*\*\s*\*|-{3,}|_{3,})\s*$/.test(line)) {
      flushParagraph();
      closeAllLists();
      html += "<hr />\n";
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushParagraph();
      closeAllLists();
      const level = Math.min(h[1].length, 6);
      html += `<h${level}>${renderInline(h[2].trim())}</h${level}>\n`;
      continue;
    }

    // GFM tables: header row immediately followed by a separator row.
    if (isTableRow(line) && idx + 1 < lines.length) {
      const sepLine = lines[idx + 1].replace(/\t/g, "    ");
      const aligns = parseTableAlign(sepLine);
      if (aligns && splitTableRow(line).length === aligns.length) {
        flushParagraph();
        closeAllLists();

        const headers = splitTableRow(line).map((c) => c.trim());
        html += "<table>\n<thead>\n<tr>";
        for (let c = 0; c < headers.length; c += 1) {
          const style = aligns[c] ? ` style="text-align:${aligns[c]}"` : "";
          html += `<th${style}>${renderInline(headers[c])}</th>`;
        }
        html += "</tr>\n</thead>\n<tbody>\n";

        // Consume subsequent body rows.
        let j = idx + 2;
        while (j < lines.length) {
          const row = lines[j].replace(/\t/g, "    ");
          if (!row.trim() || !isTableRow(row)) break;
          const cells = splitTableRow(row);
          html += "<tr>";
          for (let c = 0; c < headers.length; c += 1) {
            const style = aligns[c] ? ` style="text-align:${aligns[c]}"` : "";
            const cell = cells[c] ?? "";
            html += `<td${style}>${renderInline(cell.trim())}</td>`;
          }
          html += "</tr>\n";
          j += 1;
        }
        html += "</tbody>\n</table>\n";
        idx = j - 1;
        continue;
      }
    }

    // List items
    const m = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (m) {
      flushParagraph();
      const indent = Math.floor(m[1].replace(/\t/g, "    ").length / 2); // every 2 spaces = one level
      const marker = m[2];
      const content = m[3];

      const type: "ul" | "ol" = /^\d+\.$/.test(marker) ? "ol" : "ul";

      // Task-list detection: `[ ] rest` or `[x] rest`.
      const taskMatch = content.match(/^\[([ xX])\]\s+(.*)$/);
      const renderItem = (c: string) => {
        if (taskMatch) {
          const checked = taskMatch[1].toLowerCase() === "x";
          return `<li class="task"><input type="checkbox" disabled${checked ? " checked" : ""} /> ${renderInline(
            taskMatch[2]
          )}`;
        }
        return `<li>${renderInline(c)}`;
      };

      // Adjust stack
      if (listStack.length === 0) {
        // open top-level list
        html += `<${type}>\n${renderItem(content)}`;
        listStack.push({ type, indent });
      } else {
        const top = listStack[listStack.length - 1];

        if (indent > top.indent) {
          // deeper → new nested list
          html += `\n<${type}>\n${renderItem(content)}`;
          listStack.push({ type, indent });
        } else {
          // climb up if needed
          while (listStack.length && indent < listStack[listStack.length - 1].indent) {
            html += `</li>\n</${listStack.pop()!.type}>\n`;
          }

          // same level but different type → close current, open new
          if (listStack.length && listStack[listStack.length - 1].type !== type) {
            html += `</li>\n</${listStack.pop()!.type}>\n<${type}>\n${renderItem(content)}`;
            listStack.push({ type, indent });
          } else {
            // same level → close previous li, open new
            html += `</li>\n${renderItem(content)}`;
          }
        }
      }
      continue;
    }

    // Otherwise treat as paragraph text
    paragraph.push(line.trim());
  }

  // End of doc flush
  if (inCode) {
    const classAttr = codeLang ? ` class="language-${codeLang}"` : "";
    html += `<pre><code${classAttr}>${escapeHtml(codeBuffer.join("\n"))}</code></pre>\n`;
  }
  if (paragraph.length) {
    html += `<p>${renderInline(paragraph.join(" "))}</p>\n`;
  }
  flushBlockquote();
  closeAllLists();

  return html;
}
