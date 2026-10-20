import { Redis } from "@upstash/redis";
import fs from "node:fs";
import path from "node:path";
import { storageMode } from "../config";

/** The few key-value operations the app needs. Values are JSON. */
export interface KV {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  del(...keys: string[]): Promise<void>;
  sadd(key: string, member: string): Promise<void>;
  srem(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
  hset(key: string, field: string, value: unknown): Promise<void>;
  hget<T>(key: string, field: string): Promise<T | null>;
  hdel(key: string, field: string): Promise<void>;
  hgetall<T>(key: string): Promise<Record<string, T>>;
  hlen(key: string): Promise<number>;
  /** Increment a counter that resets after ttlSeconds. */
  incrTtl(key: string, ttlSeconds: number): Promise<number>;
}

function upstash(): KV {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN!;
  const r = new Redis({ url, token });
  return {
    get: (k) => r.get(k),
    set: async (k, v) => void (await r.set(k, v)),
    del: async (...k) => void (k.length && (await r.del(...k))),
    sadd: async (k, m) => void (await r.sadd(k, m)),
    srem: async (k, m) => void (await r.srem(k, m)),
    smembers: (k) => r.smembers(k),
    hset: async (k, f, v) => void (await r.hset(k, { [f]: v })),
    hget: (k, f) => r.hget(k, f),
    hdel: async (k, f) => void (await r.hdel(k, f)),
    hgetall: async <T,>(k: string) => ((await r.hgetall(k)) as Record<string, T>) || {},
    hlen: (k) => r.hlen(k),
    incrTtl: async (k, ttl) => {
      const n = await r.incr(k);
      if (n === 1) await r.expire(k, ttl);
      return n;
    },
  };
}

/** Single JSON file under .data/ for running locally with no cloud services. */
function local(): KV {
  const dir = path.join(process.cwd(), ".data");
  const file = path.join(dir, "kv.json");
  type Db = Record<string, unknown>;
  const load = (): Db => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return {};
    }
  };
  const save = (db: Db) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file + ".tmp", JSON.stringify(db));
    fs.renameSync(file + ".tmp", file);
  };
  const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const mutate = async (fn: (db: Db) => void) => {
    const db = load();
    fn(db);
    save(db);
  };
  return {
    get: async <T,>(k: string) => (clone(load()[k]) as T) ?? null,
    set: (k, v) => mutate((db) => void (db[k] = clone(v))),
    del: (...ks) => mutate((db) => ks.forEach((k) => delete db[k])),
    sadd: (k, m) =>
      mutate((db) => {
        const s = new Set((db[k] as string[]) || []);
        s.add(m);
        db[k] = [...s];
      }),
    srem: (k, m) => mutate((db) => void (db[k] = ((db[k] as string[]) || []).filter((x) => x !== m))),
    smembers: async (k) => (load()[k] as string[]) || [],
    hset: (k, f, v) =>
      mutate((db) => {
        const h = (db[k] as Record<string, unknown>) || {};
        h[f] = clone(v);
        db[k] = h;
      }),
    hget: async <T,>(k: string, f: string) => (((load()[k] as Record<string, T>) || {})[f] ?? null) as T | null,
    hdel: (k, f) =>
      mutate((db) => {
        const h = (db[k] as Record<string, unknown>) || {};
        delete h[f];
        db[k] = h;
      }),
    hgetall: async <T,>(k: string) => (load()[k] as Record<string, T>) || {},
    hlen: async (k) => Object.keys((load()[k] as object) || {}).length,
    incrTtl: async (k, ttl) => {
      let n = 0;
      await mutate((db) => {
        const cur = db[k] as { n: number; exp: number } | undefined;
        const fresh = !cur || cur.exp < Date.now();
        n = fresh ? 1 : cur!.n + 1;
        db[k] = { n, exp: fresh ? Date.now() + ttl * 1000 : cur!.exp };
      });
      return n;
    },
  };
}

const g = globalThis as unknown as { __kv?: KV };
export const kv: KV = g.__kv || (g.__kv = storageMode === "cloud" ? upstash() : local());
