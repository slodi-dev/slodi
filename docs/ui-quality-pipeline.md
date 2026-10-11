# UI quality pipeline

> Plan · 2026-10-11 · step 1 implemented (sc-582), steps 2–4 in the backlog

**Goal:** the UI works in every form. Every component works in every state,
theme and viewport, and every page works for every user. CI should find a
broken form before a scout does. Four layers do this. Each layer catches a
kind of bug the one before it can't see.

| Layer | Runs | Catches |
|---|---|---|
| 1. Stories as tests | every PR | a component state that crashes, logs an error, fails its `play`, or fails axe |
| 2. Visual regression | every PR | a component that renders but looks wrong (layout, colour, theme) |
| 3. Route crawler + journeys | PR + nightly | a page that breaks for one persona, an API call that 4xx/5xxs, a task that can't be finished |
| 4. Post-deploy smoke | after deploy | production differs from what CI tested (config, env, data) |

## Where things stand

| | Exists on `main` | Missing |
|---|---|---|
| Storybook | Storybook 10 (`@storybook/nextjs-vite`), 86 story files, theme and patrol toolbar through the real `ThemeProvider`, `addon-a11y` (report only, `test: "todo"`) | Nothing runs the stories in CI. Nothing checks dark mode or phone width. |
| Unit tests | Vitest 3 + jsdom, ~600 tests, `npm test` in CI | — |
| Journeys | Playwright, 1 journey, `journeys.yml` (PR gate + nightly 03:17) through `scripts/e2e.sh` | More journeys. No crawl of every route and persona. |
| Design tokens | `frontend/scripts/check-tokens.mjs` | Not run in CI (sc-562) |
| Visual regression | — | Everything |
| Production | `scripts/verify-deploy.sh` (health checks) | No browser check of real pages after deploy |

## Layer 1: stories as tests (every PR)

`@storybook/addon-vitest` turns every story into a Vitest test that renders in
real Chromium (Vitest browser mode, Playwright provider). A story fails on:

- a render crash, or a `play` function that fails;
- any `console.error`. React reports caught errors, key warnings and invalid
  nesting this way, and none of them throw. A story that shows an error state on
  purpose lists exactly what it expects: `parameters.allowedConsoleErrors`;
- an axe violation (WCAG A/AA). A story with a known violation opts out with
  `a11y: { test: "todo" }` and a comment naming the rule.

**Four forms.** Every story runs four times: light and dark, at phone (390px)
and desktop (1280px) width. `vitest.config.ts` defines one Vitest project per
form (`storybook-light-phone` … `storybook-dark-desktop`). Each passes different
`initialGlobals` to the Storybook plugin: `theme` goes through the real
`ThemeProvider` the same way as the toolbar, and `viewport` names one of the two
viewports in `preview.tsx`. The plugin sets the browser size from it.

**a11y.** `error` globally since step 4's first pass (see below): every story
is clean in all four forms except three Heiðursorðla story files, which are
`todo` with the remaining rule named.

**Every component has stories.** `scripts/check-stories.mjs` fails when a
`.tsx` under `components/` or `app/` is not imported by any story. Route files
(`page.tsx`, `layout.tsx`, …) are exempt because layer 3 covers them. A
component that renders nothing a story could show is listed in the script with
the reason.

```bash
cd frontend
npm run test:stories                                   # all stories, 4 forms
npx vitest run --project storybook-dark-phone          # one form
npx vitest run --project "storybook-*" components/Modal  # one component
npm run check:stories
```

## Layer 2: visual regression (every PR)

Playwright screenshots every story in the 4 forms and compares them with
baselines committed to git. It runs inside the official Playwright Docker image
(`mcr.microsoft.com/playwright`), the same image locally and in CI, so font
rendering is deterministic. A visual change is approved by updating its
baseline in the PR, and the diff images are uploaded as a CI artifact.

**Self-hosted, not Chromatic.** Chromatic's free tier is about 5,000 snapshots a
month. The plan assumed about 344 snapshots per run (86 story files × 4), or
about 14 PRs a month. In fact layer 1 counts 378 stories, so a full run is
about 1,500 snapshots: 3 PRs a month. Self-hosting costs only CI minutes and
the baseline PNGs in git.

## Layer 3: route crawler and journeys (PR + nightly)

This layer runs on the journey stack (`docker-compose.e2e.yml`, seeded data,
no Auth0). The crawler visits every route under `app/` × personas (anonymous,
member, editor, admin) × phone/desktop × light/dark. It fails on:

- uncaught page errors or `console.error`;
- a 4xx/5xx API response;
- axe violations;
- horizontal overflow at phone width;
- leftover English UI strings.

The PR gate crawls each persona once (desktop, light). Nightly crawls every form.

More journeys, in this order:

1. "Like, then open the shared link" (`community-member-likes-and-shares`).
2. "Edit from the card keeps leiðbeiningar" (`program-owner-edits-from-bank`).
3. Yfirferð (`reviewer-sweeps-yfirferd`).

`check-tokens.mjs` runs in CI from step 1 onwards.

## Layer 4: post-deploy smoke (after deploy)

A read-only Playwright run against https://slodi.is public pages (`/`, `/about`,
the bank, one program page, `/leikir`). It runs in the deploy workflow next to
`scripts/verify-deploy.sh` and notifies Discord. No login and no writes.

## Rollout

| Step | What | Effort | Story | Status |
|---|---|---|---|---|
| 1 | `check-tokens` in CI; stories as tests in 4 forms; every component has stories; a11y `error` for clean primitives | ½ day | sc-582 | Done, see below |
| 2 | Route crawler + 2 journeys | 1–2 days | sc-583 | Backlog |
| 3 | Visual regression | 1 day | sc-584 | Backlog |
| 4 | a11y `error` group by group; post-deploy smoke | ongoing | sc-585 | a11y done but Heiðursorðla, see below; smoke to do |

### Step 1, as built

- **CI.** "Lint & Build" now also runs `npm run check:tokens` and
  `npm run check:stories`. A new job, "Storybook tests", installs Chromium
  (cached as in `journeys.yml`) and runs `npm run test:stories`. Deploys wait on
  the whole Frontend CI workflow, so a failing story also blocks a deploy, the
  same as a failing unit test.
- **check-tokens.** `main` had 4 errors, all in the Storybook token-docs page
  and its test. They are fixed, so the check fails on any new error with no
  baseline file. The 100 warnings (literal `rgba()`, legacy shadcn tokens) are
  printed but don't fail the check. They are tracked in sc-553, sc-554, sc-555
  and sc-561.
- **Stories.** 378 stories × 4 forms = 1,512 tests, all passing, none skipped.
  The run takes about 1½ minutes locally. Nine error-state stories list the
  failed request their component logs (`allowedConsoleErrors`). One new story,
  for `HiddenMark`, was the only component without one.
- **a11y.** `error` for ActiveChip, Alert, Modal, RangeInput, SkeletonCard and
  TypeBadge. Modal got an `ariaLabel` prop so the untitled dialog has a name.
  Button and CollapsibleSection fail AA contrast (white on the brand green is
  3.27:1), which is a design decision: sc-586. A survey run with `error`
  everywhere failed 404 of 1,504 tests. Most are `color-contrast`, plus form labels and
  list/ARIA structure in TagPicker and ContentCreateModal. That is step 4's
  backlog.

### Step 4, a11y pass

- **Contrast (sc-586).** Decided: darker tokens, same hues. `green-500` 42% →
  32% (white on it 3.27 → 5.29:1), `error-500` 58% → 44% (3.84 → 5.8:1),
  `info-500` 45% → 30% (2.76 → 5.63:1); the dark theme keeps the lighter red
  and teal as `error-400`/`info-400` and lifts `secondary` to `forest-300`.
  The legacy tokens Button still reads (`globals.css`) follow. A handful of
  components that hard-coded white or a grey on a token now use the token.
- **Structure.** `<dl>` grouping in ItemFacts, listbox/option structure in
  TagPicker, labels (file input, palette samples), focusable scroll regions
  (admin tables, game leaderboard), no `aria-label` on plain divs, underlined
  in-text links.
- **Drawers.** The header drawer is `inert` when closed and a modal dialog
  when open; the dashboard drawer is `visibility: hidden` when closed on a
  phone. `hooks/useDrawerFocus.ts` moves focus in, traps Tab, closes on Escape
  and returns focus. Both have a `MobileDrawerKeyboard` story.
- **Ratchet.** Stories: `error` globally (survey: 400 failing tests → 0
  outside Heiðursorðla). Crawler: rules in `ENFORCED_AXE_RULES`
  (`e2e/crawl/pages.crawl.ts`) fail the crawl; the rest stay report-only.

## Open questions

- Visual baselines: commit PNGs to the repo (simple), or keep them in Git LFS?
  1,500 PNGs is roughly 50–100 MB per full refresh.
