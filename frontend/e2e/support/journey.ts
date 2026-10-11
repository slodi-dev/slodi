/**
 * The journey test API: `journey(...)` declares a test that proves a journey in
 * docs/journeys/, `step(...)` runs one of its numbered steps, and the
 * `signInAs` fixture gives the browser a session for a seeded persona.
 *
 * Traceability (docs/journeys/README.md): a journey test carries the tags
 * `@journey:<slug>` and `@story:<id>` for every story it proves, and every
 * step title starts with the step id from the journey file ("S3 …"). The
 * coverage report (e2e/support/coverage-report.mjs) reads those back from the
 * Playwright JSON results.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test as base, expect, type BrowserContext } from "@playwright/test";
import { generateSessionCookie } from "@auth0/nextjs-auth0/testing";
import { SignJWT, importJWK, type JWK } from "jose";
import type { Persona } from "./fixtures";

/** Must match what the e2e backend is configured with (docker-compose.e2e.yml). */
const ISSUER = `https://${process.env.AUTH0_DOMAIN ?? "e2e.slodi.invalid"}/`;
const AUDIENCE = process.env.AUTH0_AUDIENCE ?? "https://api.e2e.slodi.invalid";

let signingKey: { key: CryptoKey | Uint8Array; kid: string } | undefined;

async function getSigningKey() {
  if (!signingKey) {
    const jwk = JSON.parse(
      readFileSync(join(__dirname, "..", ".auth", "private.jwk.json"), "utf-8")
    ) as JWK & { kid: string };
    signingKey = { key: await importJWK(jwk, "RS256"), kid: jwk.kid };
  }
  return signingKey;
}

/**
 * Give `context` the session a real Auth0 login would leave behind.
 *
 * Two pieces, neither of which needs a code path in the app:
 * - an access token signed with this run's key, which the backend accepts only
 *   because it runs with ENV=e2e and AUTH_TEST_JWKS_FILE (see backend
 *   app/settings.py);
 * - the SDK's own encrypted `__session` cookie holding that token, made with
 *   the SDK's testing helper and the AUTH0_SECRET the frontend was started
 *   with. Without that secret no cookie can be made, which is already true of
 *   production.
 */
export async function signIn(context: BrowserContext, persona: Persona, baseURL: string) {
  const secret = process.env.AUTH0_SECRET;
  if (!secret) throw new Error("AUTH0_SECRET is not set; run the journeys via scripts/e2e.sh");

  const { key, kid } = await getSigningKey();
  const now = Math.floor(Date.now() / 1000);
  const accessToken = await new SignJWT({ email: persona.email, name: persona.name })
    .setProtectedHeader({ alg: "RS256", kid })
    .setSubject(persona.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60)
    .sign(key);

  const cookie = await generateSessionCookie(
    {
      user: { sub: persona.sub, name: persona.name, email: persona.email },
      tokenSet: { accessToken, expiresAt: now + 60 * 60, audience: AUDIENCE },
    },
    { secret }
  );

  await context.addCookies([
    {
      name: "__session",
      value: cookie,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

type JourneyFixtures = {
  /** Sign the page's browser context in as a seeded persona. */
  signInAs: (persona: Persona) => Promise<void>;
};

export const test = base.extend<JourneyFixtures>({
  signInAs: async ({ context, baseURL }, use) => {
    await use((persona) => signIn(context, persona, baseURL!));
  },
});

export { expect };

type StepId = `S${number}${"" | "a" | "b" | "c"}`;

/** Run one numbered step of the journey, e.g. `step("S3", "Changes the title", ...)`. */
export function step<T>(id: StepId, title: string, body: () => Promise<T>): Promise<T> {
  return test.step(`${id} ${title}`, body);
}

/**
 * A step that an open bug is known to break.
 *
 * Only a failure *in this step* turns into `test.fail` (an expected failure);
 * a failure anywhere else in the journey still fails the run. A test-wide
 * `test.fail` would also swallow a broken fixture or a changed label at step 1
 * and report it as the known bug.
 *
 * When the step passes, the bug looks fixed, and the test fails on purpose
 * so the fix PR removes the marker. A known bug can't close silently.
 */
export async function knownBugStep(
  issue: `sc-${number}`,
  id: StepId,
  title: string,
  body: () => Promise<void>
): Promise<void> {
  try {
    await step(id, title, body);
  } catch (error) {
    test.info().annotations.push({ type: "known-bug", description: `${issue} breaks ${id}` });
    test.fail(true, `${issue}: ${id} is expected to fail until it is fixed`);
    throw error;
  }
  throw new Error(
    `${id} passed, so ${issue} looks fixed. Change knownBugStep("${issue}", "${id}", ...) ` +
      `back to step("${id}", ...) in this PR.`
  );
}
