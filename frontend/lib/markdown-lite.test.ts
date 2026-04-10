import { describe, expect, it } from "vitest";

import { mdToHtmlLite } from "./markdown-lite";

// Small helper: collapse whitespace so tests don't care about exact newline layout.
const squish = (s: string) => s.replace(/\s+/g, " ").trim();

describe("mdToHtmlLite — existing features (regression)", () => {
  it("renders ATX headings", () => {
    expect(mdToHtmlLite("# Hello")).toContain("<h1>Hello</h1>");
    expect(mdToHtmlLite("### Three")).toContain("<h3>Three</h3>");
  });

  it("renders paragraphs joining soft-wrapped lines", () => {
    const out = mdToHtmlLite("foo\nbar\n\nbaz");
    expect(out).toContain("<p>foo bar</p>");
    expect(out).toContain("<p>baz</p>");
  });

  it("renders bold and italic", () => {
    expect(mdToHtmlLite("**bold** and *em*")).toContain("<strong>bold</strong> and <em>em</em>");
  });

  it("renders inline code with escaping", () => {
    expect(mdToHtmlLite("use `<div>` here")).toContain("<code>&lt;div&gt;</code>");
  });

  it("renders unordered lists", () => {
    const out = mdToHtmlLite("- one\n- two");
    expect(out).toContain("<ul>");
    expect(out).toContain("<li>one</li>");
    expect(out).toContain("<li>two</li>");
  });

  it("renders nested ordered inside unordered", () => {
    const out = mdToHtmlLite("- top\n  1. nested");
    expect(squish(out)).toContain("<li>top <ol> <li>nested</li> </ol> </li>");
  });

  it("keeps an ordered list open across blank lines between items", () => {
    // A blank line between items used to close the list, so every item
    // became "1." inside its own <ol>. Guard against that regression.
    const out = mdToHtmlLite("1. one\n\n2. two\n\n3. three");
    expect((out.match(/<ol>/g) ?? []).length).toBe(1);
    expect((out.match(/<\/ol>/g) ?? []).length).toBe(1);
    expect(squish(out)).toContain("<li>one</li> <li>two</li> <li>three</li>");
  });

  it("closes a list when the blank line is followed by non-list content", () => {
    const out = mdToHtmlLite("1. one\n\n2. two\n\nAfter.");
    expect((out.match(/<ol>/g) ?? []).length).toBe(1);
    expect(out).toContain("<p>After.</p>");
  });

  it("renders horizontal rules", () => {
    expect(mdToHtmlLite("---")).toContain("<hr />");
  });

  it("renders links with target and rel", () => {
    const out = mdToHtmlLite("[ok](https://example.com)");
    expect(out).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">ok</a>'
    );
  });

  it("neuters javascript: urls", () => {
    const out = mdToHtmlLite("[x](javascript:alert(1))");
    expect(out).toContain('href="#"');
    expect(out).not.toContain("javascript:");
  });
});

describe("mdToHtmlLite — new features", () => {
  it("emits language class on fenced code blocks", () => {
    const out = mdToHtmlLite("```ts\nconst x = 1;\n```");
    expect(out).toContain('<pre><code class="language-ts">const x = 1;</code></pre>');
  });

  it("omits the language class when the info string is unsafe", () => {
    const out = mdToHtmlLite("```<script>\nhi\n```");
    expect(out).toContain("<pre><code>hi</code></pre>");
    expect(out).not.toContain("language-");
    expect(out).not.toContain("<script>");
  });

  it("merges multi-line blockquotes into a single element", () => {
    const out = mdToHtmlLite("> one\n> two\n>\n> three");
    // One <blockquote> wrapping two paragraphs
    expect((out.match(/<blockquote>/g) ?? []).length).toBe(1);
    expect(squish(out)).toContain("<blockquote> <p>one two</p> <p>three</p> </blockquote>");
  });

  it("renders GFM tables with alignment", () => {
    const md = ["| a | b | c |", "| :-- | :--: | --: |", "| 1 | 2 | 3 |", "| 4 | 5 | 6 |"].join(
      "\n"
    );
    const out = mdToHtmlLite(md);
    expect(out).toContain("<table>");
    expect(out).toContain('<th style="text-align:left">a</th>');
    expect(out).toContain('<th style="text-align:center">b</th>');
    expect(out).toContain('<th style="text-align:right">c</th>');
    expect(out).toContain('<td style="text-align:left">1</td>');
    expect(out).toContain('<td style="text-align:right">6</td>');
  });

  it("renders images with lazy loading", () => {
    const out = mdToHtmlLite("![alt text](https://example.com/pic.png)");
    expect(out).toContain(
      '<img src="https://example.com/pic.png" alt="alt text" loading="lazy" decoding="async" />'
    );
  });

  it("neuters image urls that fail the allowlist", () => {
    const out = mdToHtmlLite("![x](javascript:evil)");
    expect(out).toContain('src="#"');
    expect(out).not.toContain("javascript:");
  });

  it("renders task list items with disabled checkboxes", () => {
    const out = mdToHtmlLite("- [ ] open\n- [x] done");
    expect(out).toContain('<li class="task"><input type="checkbox" disabled /> open');
    expect(out).toContain('<li class="task"><input type="checkbox" disabled checked /> done');
  });

  it("renders strikethrough", () => {
    expect(mdToHtmlLite("~~gone~~")).toContain("<del>gone</del>");
  });

  it("renders autolinks", () => {
    const out = mdToHtmlLite("See <https://example.com> for more");
    expect(out).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>'
    );
  });

  it("renders mailto autolinks", () => {
    const out = mdToHtmlLite("<mailto:hi@example.com>");
    expect(out).toContain('href="mailto:hi@example.com"');
  });

  it("keeps inline HTML-escaped text safe inside a link label", () => {
    const out = mdToHtmlLite("[a & b](https://example.com)");
    expect(out).toContain(">a &amp; b</a>");
  });
});
