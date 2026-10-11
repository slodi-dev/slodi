/**
 * The route crawler: every page under app/ × persona × form.
 *
 * One test per route path × persona; Playwright projects supply the form
 * (desktop/phone × light/dark, see playwright.config.ts). Each test opens the
 * page, waits for it to settle, and fails on:
 *
 * - an uncaught page error, or a `console.error`;
 * - an API response with status ≥ 400, unless declared for this route and
 *   persona in expectations.ts;
 * - horizontal overflow at phone width;
 * - leftover English UI text (english.ts).
 *
 * axe runs on every page too, but is report-only for now: violations are
 * attached to the test and summarised by crawl-report.mjs, and fail nothing.
 *
 * A signed-out visit to a private route (lib/route-access.ts) asserts the
 * redirect to login instead, and checks nothing else.
 *
 * Run: scripts/e2e.sh --project crawl-desktop-light   (see docs/journey-testing-in-ci.md)
 */
import AxeBuilder from "@axe-core/playwright";
import { routeAccess } from "../../lib/route-access";
import { signIn, test as base, expect } from "../support/journey";
import { PERSONAS } from "../support/fixtures";
import { crawlTargets } from "./routes";
import { findEnglish } from "./english";
import { expectationsFor, PERSONA_NAMES, type Entry, type PersonaName } from "./expectations";

export type Theme = "light" | "dark";

const test = base.extend<{ theme: Theme }>({
  theme: ["light", { option: true }],
});

const API_ORIGIN = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:18000").origin;

const SIGNED_IN: Record<
  Exclude<PersonaName, "anonymous">,
  (typeof PERSONAS)[keyof typeof PERSONAS]
> = {
  member: PERSONAS.communityMember,
  editor: PERSONAS.editor,
  admin: PERSONAS.admin,
};

/** The page has settled: no requests in flight, and no skeleton left. */
async function settle(page: import("@playwright/test").Page) {
  // Some pages poll or stream (games, countdowns); networkidle may never come.
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 10_000 });
}

for (const { route, path } of crawlTargets()) {
  for (const persona of PERSONA_NAMES) {
    const title = `${path} as ${persona}`;
    test(
      title,
      { tag: ["@crawl", `@route:${route}`, `@persona:${persona}`, "@pr"] },
      async ({ page, context, baseURL, theme }, testInfo) => {
        const expected = expectationsFor(route, path, persona);

        const form = testInfo.project.name.replace(/^crawl-/, "");
        const phone = (page.viewportSize()?.width ?? 1280) < 600;
        const findings: string[] = [];
        /** Record a finding, unless an entry in expectations.ts expects it. */
        const check = (kind: string, message: string, entry: Entry | undefined) => {
          if (!entry) findings.push(`[${kind}] ${message}`);
          else if (entry.bug) {
            // Tolerated, but visible: the report lists every known bug it saw.
            const description = `${entry.bug}: [${kind}] ${message}`;
            if (!testInfo.annotations.some((a) => a.description === description)) {
              testInfo.annotations.push({ type: "known-bug", description });
            }
          }
        };

        if (persona !== "anonymous") await signIn(context, SIGNED_IN[persona], baseURL!);
        // The same switch the app's ThemeProvider reads on mount.
        await context.addInitScript((t) => {
          window.localStorage.setItem("slodi-theme", t);
        }, theme);
        await page.emulateMedia({ colorScheme: theme });
        // /auth/login goes on to Auth0, which this stack never contacts, so here
        // it answers 500. Stand in for Auth0's login page where a route can, and
        // ignore its status below where one can't: a redirect the browser
        // follows by itself (a prefetched private link, a script the middleware
        // turns away) is never routed.
        await page.route("**/auth/login**", (r) =>
          r.fulfill({ status: 200, contentType: "text/html", body: "<title>Auth0</title>" })
        );
        const atLogin = () => new URL(page.url()).pathname === "/auth/login";

        // ── Signed out on a private route: only the redirect matters ──────────
        if (persona === "anonymous" && routeAccess(path) === "private") {
          await page.goto(path);
          const url = new URL(page.url());
          expect(
            url.pathname,
            `${title}: a private page must send a signed-out visitor to log in`
          ).toBe("/auth/login");
          expect(url.searchParams.get("returnTo")).toBe(path);
          return;
        }

        // ── Listeners ─────────────────────────────────────────────────────────
        page.on("pageerror", (err) => {
          check("pageerror", err.message, expected.console(err.message));
        });
        page.on("console", (msg) => {
          if (msg.type() !== "error") return;
          const text = msg.text();
          // The browser logs every failed request this way. Those are judged
          // by the response check below, against the declared statuses.
          if (text.startsWith("Failed to load resource")) return;
          check("console.error", text, expected.console(text));
        });
        page.on("response", (res) => {
          const status = res.status();
          if (status < 400) return;
          const url = new URL(res.url());
          if (url.pathname === "/auth/login") return; // Auth0's job; see above.
          const where = `${res.request().method()} ${url.pathname}${url.search}`;
          if (url.origin === API_ORIGIN) {
            check("api", `${status} ${where}`, expected.api(status, url.pathname));
          } else if (url.origin === new URL(baseURL!).origin) {
            // The page itself, its assets and its own route handlers (app/api).
            check("http", `${status} ${where}`, expected.api(status, url.pathname));
          }
        });

        // ── Visit ─────────────────────────────────────────────────────────────
        await page.goto(path);
        await settle(page);
        // The page's own status is judged by the response listener above.

        // A public page that needs an account for what it shows sends the
        // visitor to log in once it finds out; nothing else on it to check.
        if (expected.redirectsToLogin) {
          await expect
            .poll(atLogin, `${title}: should send a signed-out visitor to log in`)
            .toBe(true);
          expect(findings, `${path} as ${persona} (${form})`).toEqual([]);
          return;
        }
        if (atLogin()) check("redirect", `sent to log in (${page.url()})`, undefined);

        // ── Overflow at phone width ───────────────────────────────────────────
        if (phone) {
          const overflow = await page.evaluate(() => {
            const root = document.documentElement;
            if (root.scrollWidth <= root.clientWidth) return null;
            const limit = root.clientWidth;
            const inFixed = (el: Element | null): boolean => {
              for (; el; el = el.parentElement)
                if (getComputedStyle(el).position === "fixed") return true;
              return false;
            };
            // The outermost elements that stick out, so the message points at a cause.
            const culprits: string[] = [];
            for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
              const r = el.getBoundingClientRect();
              if (r.right <= limit + 1 || r.width === 0) continue;
              // Fixed layers (an off-canvas drawer) stick out but don't scroll.
              if (inFixed(el)) continue;
              const parent = el.parentElement?.getBoundingClientRect();
              if (parent && parent.right > limit + 1) continue;
              const cls = typeof el.className === "string" ? el.className.split(/\s+/)[0] : "";
              culprits.push(
                `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""} (right ${Math.round(r.right)}px)`
              );
              if (culprits.length >= 3) break;
            }
            return `scrollWidth ${root.scrollWidth}px > ${limit}px; ${culprits.join(", ")}`;
          });
          if (overflow) check("overflow", overflow, expected.overflow());
        }

        // ── Leftover English ──────────────────────────────────────────────────
        for (const hit of await findEnglish(page)) check("english", hit, expected.english(hit));

        // ── axe (report only) ─────────────────────────────────────────────────
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        for (const v of axe.violations) {
          testInfo.annotations.push({
            type: "axe",
            description: `${v.id} (${v.impact ?? "?"}): ${v.nodes.length} node(s) — ${v.help}`,
          });
        }
        if (axe.violations.length) {
          await testInfo.attach("axe-violations.json", {
            body: JSON.stringify(axe.violations, null, 2),
            contentType: "application/json",
          });
        }

        // ── Verdict ───────────────────────────────────────────────────────────
        for (const finding of findings) {
          testInfo.annotations.push({ type: "finding", description: finding });
        }
        expect(findings, `${path} as ${persona} (${form})`).toEqual([]);
      }
    );
  }
}
