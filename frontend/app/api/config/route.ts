import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

const SEED_KEY = "dagskrarbankinn_workspace_id";

/**
 * Return the default workspace ID for the frontend.
 *
 * Resolution order (mirrors backend read_seed_output()):
 * 1. DEFAULT_WORKSPACE_ID env var (fast path — set in docker-compose or .env)
 * 2. seed_output.json in SEED_OUTPUT_DIR (written by the seed/migrations container,
 *    mounted as a shared Docker volume at /app/seed_data)
 * 3. null — graceful degradation, programs page stays empty
 */
export async function GET() {
  const wsId = await resolveWorkspaceId();
  return NextResponse.json({ default_workspace_id: wsId ?? null });
}

async function resolveWorkspaceId(): Promise<string | null> {
  // Fast path: explicit env var
  const envId = process.env.DEFAULT_WORKSPACE_ID;
  if (envId) return envId;

  // File path: read seed_output.json from the shared Docker volume
  const seedDir = process.env.SEED_OUTPUT_DIR;
  if (!seedDir) return null;

  try {
    const raw = await readFile(join(seedDir, "seed_output.json"), "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    const id = data[SEED_KEY];
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}
