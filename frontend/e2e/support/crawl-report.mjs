#!/usr/bin/env node
/**
 * Route crawler summary, as Markdown (the crawler: e2e/crawl/pages.crawl.ts).
 *
 *   node e2e/support/crawl-report.mjs [e2e-results/results.json]
 *
 * Reads the annotations each crawl test leaves in Playwright's JSON report:
 *   finding    a check that failed the test
 *   known-bug  a finding tolerated by an entry in e2e/crawl/expectations.ts
 *   axe        an axe violation (report only, fails nothing yet)
 *
 * Prints nothing when the run had no crawl tests. Never fails the build
 * itself: the gate is the Playwright exit code.
 */
import { existsSync, readFileSync } from "node:fs";

const resultsPath = process.argv[2] ?? "e2e-results/results.json";
if (!existsSync(resultsPath)) process.exit(0);

/** @type {{form: string, title: string, status: string, notes: {type: string, description?: string}[]}[]} */
const tests = [];

function walk(suite) {
  for (const spec of suite.specs ?? []) {
    if (!(spec.tags ?? []).includes("@crawl") && !(spec.tags ?? []).includes("crawl")) continue;
    for (const test of spec.tests ?? []) {
      const last = test.results?.[test.results.length - 1];
      const notes = [...(test.annotations ?? []), ...(last?.annotations ?? [])];
      const seen = new Set();
      tests.push({
        form: test.projectName.replace(/^crawl-/, ""),
        title: spec.title,
        status: test.status,
        notes: notes.filter((n) => {
          const key = `${n.type}\u0000${n.description}`;
          return seen.has(key) ? false : seen.add(key);
        }),
      });
    }
  }
  for (const child of suite.suites ?? []) walk(child);
}
for (const suite of JSON.parse(readFileSync(resultsPath, "utf-8")).suites ?? []) walk(suite);
if (!tests.length) process.exit(0);

const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const lines = ["## Route crawl", ""];

// ── Per form ───────────────────────────────────────────────────────────────
const forms = [...new Set(tests.map((t) => t.form))].sort();
lines.push(
  "| Form | Pages × personas | Passed | Failed | Flaky | Skipped |",
  "|---|---|---|---|---|---|"
);
for (const form of forms) {
  const mine = tests.filter((t) => t.form === form);
  const count = (s) => mine.filter((t) => t.status === s).length;
  lines.push(
    `| ${form} | ${mine.length} | ${count("expected")} | ${count("unexpected")} | ${count("flaky")} | ${count("skipped")} |`
  );
}

// ── Findings ───────────────────────────────────────────────────────────────
const findings = tests.flatMap((t) =>
  t.notes.filter((n) => n.type === "finding").map((n) => ({ ...t, message: n.description }))
);
lines.push("", `### Findings (${findings.length})`, "");
if (findings.length) {
  lines.push("| Form | Page as persona | Finding |", "|---|---|---|");
  for (const f of findings) lines.push(`| ${f.form} | ${cell(f.title)} | ${cell(f.message)} |`);
} else {
  lines.push("None.");
}

// ── Known bugs ─────────────────────────────────────────────────────────────
const known = new Map();
for (const t of tests) {
  for (const n of t.notes.filter((n) => n.type === "known-bug")) {
    known.set(n.description, (known.get(n.description) ?? 0) + 1);
  }
}
if (known.size) {
  lines.push("", "### Known bugs, tolerated (e2e/crawl/expectations.ts)", "");
  lines.push("| Seen | Bug and message |", "|---|---|");
  for (const [d, n] of [...known].sort((a, b) => b[1] - a[1])) lines.push(`| ${n}× | ${cell(d)} |`);
}

// ── axe ────────────────────────────────────────────────────────────────────
const axe = new Map();
for (const t of tests) {
  for (const n of t.notes.filter((n) => n.type === "axe")) {
    const m = n.description.match(/^(\S+) \((\w+|\?)\): (\d+) node\(s\) — (.*)$/);
    if (!m) continue;
    const [, rule, impact, nodes, help] = m;
    const entry = axe.get(rule) ?? { impact, help, tests: 0, nodes: 0, pages: new Set() };
    entry.tests += 1;
    entry.nodes += Number(nodes);
    entry.pages.add(t.title.replace(/ as \w+$/, ""));
    axe.set(rule, entry);
  }
}
const IMPACT = ["critical", "serious", "moderate", "minor", "?"];
lines.push("", `### axe, report only (${axe.size} rules)`, "");
if (axe.size) {
  lines.push("| Rule | Impact | Pages | Tests | Nodes | Help |", "|---|---|---|---|---|---|");
  for (const [rule, e] of [...axe].sort(
    (a, b) => IMPACT.indexOf(a[1].impact) - IMPACT.indexOf(b[1].impact) || b[1].tests - a[1].tests
  )) {
    lines.push(
      `| ${rule} | ${e.impact} | ${e.pages.size} | ${e.tests} | ${e.nodes} | ${cell(e.help)} |`
    );
  }
  lines.push("", "Every test with a violation carries `axe-violations.json` in the HTML report.");
} else {
  lines.push("None.");
}

console.log(lines.join("\n"));
