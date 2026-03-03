// lib/markdown-lite.ts
// Minimal, dependency-free Markdown → HTML for devlogs.
// Goals: simplicity, safety, readability. Not a full spec implementation.

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

// Inline formatting: runs on a text chunk that is NOT inside code spans.
function renderInline(md: string): string {
  // Protect inline code by splitting on backticks
  const parts = md.split(/(`+)([\s\S]*?)(\1)/g); // delimiter, content, delimiter
  for (let i = 0; i < parts.length; i += 1) {
    // parts pattern: [text, delim, content, delim, text, delim, content, ...]
    if (i % 4 === 0) {
      // normal text segment → escape + apply bold/italic/links
      let t = escapeHtml(parts[i]);

      // Links: [label](url)
      t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
        const safe = sanitizeUrl(String(url));
        return `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
          String(label)
        )}</a>`;
      });

      // Bold: **text**
      t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

      // Italic: *text*  (simple version, avoids conflict with bold we already handled)
      t = t.replace(/(^|[^\*])\*([^*]+)\*/g, (_m, pre, body) => `${pre}<em>${body}</em>`);

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

export function mdToHtmlLite(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");

  let html = "";
  let inCode = false;
  let codeBuffer: string[] = [];

  let paragraph: string[] = [];

  type ListCtx = { type: "ul" | "ol"; indent: number };
  const listStack: ListCtx[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      const text = paragraph.join(" ").trim();
      if (text) html += `<p>${renderInline(text)}</p>\n`;
      paragraph = [];
    }
  };

  const closeListsTo = (level: number) => {
    while (listStack.length > level) {
      html += `</li>\n</${listStack.pop()!.type}>\n`;
    }
  };

  const closeAllLists = () => closeListsTo(0);

  for (const raw of lines) {
    const line = raw.replace(/\t/g, "    ");

    // Fenced code
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      if (!inCode) {
        flushParagraph();
        closeAllLists();
        inCode = true;
        codeBuffer = [];
      } else {
        html += `<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>\n`;
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(raw);
      continue;
    }

    // Blank line
    if (!line.trim()) {
      flushParagraph();
      closeAllLists();
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

    // Blockquote
    const bq = line.match(/^>\s?(.*)$/);
    if (bq) {
      flushParagraph();
      closeAllLists();
      html += `<blockquote><p>${renderInline(bq[1])}</p></blockquote>\n`;
      continue;
    }

    // List items
    const m = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (m) {
      flushParagraph();
      const indent = Math.floor(m[1].replace(/\t/g, "    ").length / 2); // every 2 spaces = one level
      const marker = m[2];
      const content = m[3];

      const type: "ul" | "ol" = /^\d+\.$/.test(marker) ? "ol" : "ul";

      // Adjust stack
      if (listStack.length === 0) {
        // open top-level list
        html += `<${type}>\n<li>${renderInline(content)}`;
        listStack.push({ type, indent });
      } else {
        const top = listStack[listStack.length - 1];

        if (indent > top.indent) {
          // deeper → new nested list
          html += `\n<${type}>\n<li>${renderInline(content)}`;
          listStack.push({ type, indent });
        } else {
          // climb up if needed
          while (listStack.length && indent < listStack[listStack.length - 1].indent) {
            html += `</li>\n</${listStack.pop()!.type}>\n`;
          }

          // same level but different type → close current, open new
          if (listStack.length && listStack[listStack.length - 1].type !== type) {
            html += `</li>\n</${listStack.pop()!.type}>\n<${type}>\n<li>${renderInline(content)}`;
            listStack.push({ type, indent });
          } else {
            // same level → close previous li, open new
            html += `</li>\n<li>${renderInline(content)}`;
          }
        }
      }
      continue;
    }

    // Otherwise treat as paragraph text
    paragraph.push(line.trim());
  }

  // End of doc flush
  if (inCode) html += `<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>\n`;
  if (paragraph.length) {
    html += `<p>${renderInline(paragraph.join(" "))}</p>\n`;
  }
  closeAllLists();

  return html;
}
