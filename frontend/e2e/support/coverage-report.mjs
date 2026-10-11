#!/usr/bin/env node
/**
 * Story -> journey -> test coverage, as Markdown.
 *
 *   node e2e/support/coverage-report.mjs [e2e-results/results.json]
 *
 * Reads three things and joins them (scheme: docs/journeys/README.md):
 *   - docs/tharfagreining2/user-stories.md   every story id ("### B4 — ...")
 *   - docs/journeys/*.md                      front matter: which stories a
 *                                             journey proves, and its test
 *   - Playwright's JSON report                which journey tests passed, and
 *                                             the step a failing one stopped at
 *
 * With no results file it still prints the static map (useful in review).
 * Never fails the build itself: the gate is the Playwright exit code.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const STORIES_FILE = join(ROOT, "docs/tharfagreining2/user-stories.md");
const JOURNEYS_DIR = join(ROOT, "docs/journeys");
const resultsPath = process.argv[2];

// ── Stories ────────────────────────────────────────────────────────────────
const stories = new Map();
for (const line of readFileSync(STORIES_FILE, "utf-8").split("\n")) {
  const m = line.match(/^###\s+([A-Z]\d+)\s+—\s+(.*?)\s*⭐*\s*$/);
  if (m) stories.set(m[1], m[2]);
}

// ── Journeys ───────────────────────────────────────────────────────────────
function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, raw] = kv;
    out[key] = raw.startsWith("[")
      ? raw
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : raw.trim();
  }
  return out;
}

const journeys = readdirSync(JOURNEYS_DIR)
  .filter((f) => f.endsWith(".md") && f !== "README.md")
  .map((f) => ({ file: f, ...frontMatter(readFileSync(join(JOURNEYS_DIR, f), "utf-8")) }))
  .filter((j) => j.id);

// ── Results ────────────────────────────────────────────────────────────────
/** journey id -> { status, step, issue, tags } */
const results = new Map();

function firstFailingStep(steps = []) {
  for (const s of steps) {
    const inner = firstFailingStep(s.steps);
    if (inner) return inner;
    if (s.error && /^S\d+\b/.test(s.title)) return s.title;
  }
  return null;
}

function walk(suite) {
  for (const spec of suite.specs ?? []) {
    const tags = (spec.tags ?? []).map((t) => t.replace(/^@/, ""));
    const journeyTag = tags.find((t) => t.startsWith("journey:"));
    if (!journeyTag) continue;
    for (const test of spec.tests ?? []) {
      const last = test.results?.[test.results.length - 1];
      const knownBug = test.expectedStatus === "failed";
      let status;
      if (test.status === "skipped") status = "skipped";
      else if (test.status === "flaky") status = "flaky";
      else if (test.status === "unexpected") status = "failing";
      else status = knownBug ? "known-bug" : "passing";
      results.set(journeyTag.slice("journey:".length), {
        status,
        step: firstFailingStep(last?.steps),
        issue: test.annotations?.find((a) => a.type === "issue")?.description,
        stories: tags.filter((t) => t.startsWith("story:")).map((t) => t.slice(6)),
      });
    }
  }
  for (const child of suite.suites ?? []) walk(child);
}

if (resultsPath && existsSync(resultsPath)) {
  for (const suite of JSON.parse(readFileSync(resultsPath, "utf-8")).suites ?? []) walk(suite);
}

// ── Report ─────────────────────────────────────────────────────────────────
const ICON = {
  passing: "✅ passing",
  "known-bug": "🟠 known bug",
  failing: "❌ failing",
  flaky: "🟡 flaky",
  skipped: "⏭️ skipped",
  "not-run": "⚪ not run",
  "not-automated": "📝 not automated",
};

function journeyStatus(j) {
  if (!j.test || j.test === "none") return "not-automated";
  return results.get(j.id)?.status ?? "not-run";
}

const lines = [];
lines.push("## Journey coverage", "");
lines.push("| Journey | Gate | Result | Stopped at | Known issue | Stories |");
lines.push("|---|---|---|---|---|---|");
for (const j of journeys) {
  const r = results.get(j.id);
  const status = journeyStatus(j);
  lines.push(
    `| [${j.id}](docs/journeys/${j.file}) | ${j.gate ?? "—"} | ${ICON[status]} | ${
      r?.step && status !== "passing" ? r.step : "—"
    } | ${r?.issue ?? "—"} | ${(j.stories ?? []).join(", ") || "—"} |`
  );
}

// Worst status wins, so a story is only "proven" if every journey proving it passes.
const RANK = ["failing", "flaky", "known-bug", "not-run", "skipped", "not-automated", "passing"];
const byStory = new Map();
for (const j of journeys) {
  for (const id of j.stories ?? []) {
    const status = journeyStatus(j);
    const prev = byStory.get(id);
    if (!prev || RANK.indexOf(status) < RANK.indexOf(prev.status)) {
      byStory.set(id, { status, journeys: [...(prev?.journeys ?? []), j.id] });
    } else {
      prev.journeys.push(j.id);
    }
  }
}

lines.push("", "## Story coverage", "");
lines.push("| Story | Title | Status | Journeys |", "|---|---|---|---|");
for (const [id, { status, journeys: js }] of [...byStory].sort()) {
  lines.push(
    `| ${id} | ${stories.get(id) ?? "**not in user-stories.md**"} | ${ICON[status]} | ${js.join(", ")} |`
  );
}

const uncovered = [...stories.keys()].filter((id) => !byStory.has(id));
const proven = [...byStory.values()].filter((s) => s.status === "passing").length;
lines.push(
  "",
  `**${proven}** of ${stories.size} stories proven by a passing journey · ` +
    `**${byStory.size - proven}** covered but not proven · **${uncovered.length}** uncovered`,
  "",
  `<details><summary>Uncovered stories (${uncovered.length})</summary>`,
  "",
  uncovered.map((id) => `${id} ${stories.get(id)}`).join(" · "),
  "",
  "</details>"
);

// Drift between the journey file and the test's tags is a traceability bug.
const drift = [];
for (const j of journeys) {
  const r = results.get(j.id);
  if (!r) continue;
  const declared = new Set(j.stories ?? []);
  const tagged = new Set(r.stories);
  const missing = [...declared].filter((s) => !tagged.has(s));
  const extra = [...tagged].filter((s) => !declared.has(s));
  if (missing.length || extra.length) {
    drift.push(
      `- ${j.id}: test is missing tags for [${missing.join(", ")}], has extra tags [${extra.join(", ")}]`
    );
  }
}
const noStory = journeys
  .filter((j) => !(j.stories ?? []).length)
  .map((j) => `- ${j.id}: proves no user story`);
if (drift.length || noStory.length)
  lines.push("", "### Traceability warnings", "", ...drift, ...noStory);

console.log(lines.join("\n"));
