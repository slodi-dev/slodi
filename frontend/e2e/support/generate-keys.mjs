#!/usr/bin/env node
/**
 * Generate this run's token-signing key pair.
 *
 * Writes, into e2e/.auth/ (gitignored):
 *   private.jwk.json  read by the tests to sign access tokens
 *   jwks.json         the public half, mounted into the backend container
 *                     and named by AUTH_TEST_JWKS_FILE
 *
 * A fresh pair every run means no signing key is ever committed or stored as a
 * secret, and a key leaked from one CI log is worthless to the next.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exportJWK, generateKeyPair } from "jose";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", ".auth");
mkdirSync(outDir, { recursive: true });

const kid = `e2e-${Date.now()}`;
const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
const pub = { ...(await exportJWK(publicKey)), kid, use: "sig", alg: "RS256" };
const priv = { ...(await exportJWK(privateKey)), kid, alg: "RS256" };

writeFileSync(join(outDir, "jwks.json"), JSON.stringify({ keys: [pub] }, null, 2));
writeFileSync(join(outDir, "private.jwk.json"), JSON.stringify(priv), { mode: 0o600 });
console.log(`e2e signing key ${kid} written to ${outDir}`);
