type T_JS_Type =
  | "bigint"
  | "boolean"
  | "function"
  | "number"
  | "object"
  | "string"
  | "symbol"
  | "undefined";

const REQUIRED_ENV_VARS: [string, T_JS_Type?][] = [
  ["AUTH0_DOMAIN", "string"],
  ["AUTH0_CLIENT_ID", "string"],
  ["APP_BASE_URL", "string"],
  ["AUTH0_SECRET", "string"],
  ["AUTH0_CLIENT_SECRET", "string"],
];

export async function register() {
  console.log("⌛ Checking environment before startup...");

  const missing: typeof REQUIRED_ENV_VARS = [];
  for (const [name, type] of REQUIRED_ENV_VARS) {
    if (typeof process.env[name] === "undefined") {
      missing.push([name]);
      continue;
    }

    if (type && typeof process.env[name] !== type) {
      missing.push([name, type]);
      continue;
    }
  }

  if (missing.length > 0) {
    for (const [name, type] of missing) {
      if (type) {
        console.warn(
          `⚠️ WARN: Missing required environment variable \`${name}\` of type \`${type}\`.`
        );
        continue;
      }

      console.warn(`⚠️ WARN: Missing required environment variable \`${name}\`.`);
    }
  }

  console.log("🙌 all tests complete.");
}
