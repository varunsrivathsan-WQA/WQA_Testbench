const env = process.env;

export const isProd = env.NODE_ENV === "production";

export const SECRET =
  env.NEXTAUTH_SECRET || (isProd ? "" : "dev-only-secret-change-me-dev-only-secret");

export const ALLOWED_DOMAINS = (env.ALLOWED_DOMAINS || "wearewqa.com")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export const TEMPLATE_ADMINS = (env.TEMPLATE_ADMINS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const hasGoogle = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
/** Email-only sign in, for running locally without Google set up. Never in production. */
export const devLogin = !isProd && !hasGoogle;

export const storageMode: "cloud" | "local" =
  env.BLOB_READ_WRITE_TOKEN && (env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL) ? "cloud" : "local";

export type Lifespan = { key: string; label: string; ms: number };

function parseLifespan(key: string): Lifespan | null {
  const m = /^(\d+)([hd])$/.exec(key.trim());
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2];
  const ms = n * (unit === "h" ? 3600_000 : 86_400_000);
  const label =
    unit === "h" ? `${n} hour${n === 1 ? "" : "s"}` : n === 7 ? "1 week" : n === 30 ? "30 days" : `${n} day${n === 1 ? "" : "s"}`;
  return { key: key.trim(), label, ms };
}

export const LIFESPANS: Lifespan[] = (env.LIFESPANS || "1d,2d,7d,30d")
  .split(",")
  .map(parseLifespan)
  .filter((l): l is Lifespan => !!l);

export const DEFAULT_LIFESPAN = LIFESPANS.find((l) => l.key === (env.DEFAULT_LIFESPAN || "7d"))?.key || LIFESPANS[0].key;

export function lifespanMs(key: string | undefined): number {
  const found = LIFESPANS.find((l) => l.key === (key || DEFAULT_LIFESPAN));
  if (!found) throw new UserError(`Lifespan must be one of: ${LIFESPANS.map((l) => l.key).join(", ")}`);
  return found.ms;
}

/** Paths at the site root that a drop can't take. */
export const RESERVED_SLUGS = new Set([
  "api", "x", "dashboard", "new", "drops", "templates", "settings", "signin", "signout",
  "_next", "favicon.ico", "robots.txt", "ended", "admin", "login",
]);

export const LIMITS = {
  packageBytes: 50 * 1024 * 1024,
  files: 1000,
  apiBodyBytes: 4 * 1024 * 1024, // Vercel functions cap request bodies at 4.5 MB
  docBytes: 256 * 1024,
  docsPerDrop: 5000,
  dataBytes: 1024 * 1024,
};

/** Ended drops keep a small record (no files, no responses) this long, for the inventory. */
export const ENDED_RECORD_DAYS = 30;

/** An error whose message is safe to show the user. */
export class UserError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
