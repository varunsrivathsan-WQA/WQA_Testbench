import { put, del, get } from "@vercel/blob";
import fs from "node:fs";
import path from "node:path";
import { BLOB_ACCESS, storageMode, UserError } from "../config";

/** Stores file bytes. `ref` is what you keep to read the file back. */
export interface FileStore {
  put(key: string, data: Uint8Array, contentType: string): Promise<string>;
  get(ref: string): Promise<Uint8Array | null>;
  del(refs: string[]): Promise<void>;
}

const BLOB_HOST = /^https:\/\/[a-z0-9-]+\.(public|private)\.blob\.vercel-storage\.com\//;

function blob(): FileStore {
  return {
    async put(key, data, contentType) {
      const res = await put(key, Buffer.from(data), {
        access: BLOB_ACCESS,
        contentType,
        addRandomSuffix: true,
      });
      return res.url;
    },
    async get(ref) {
      if (!BLOB_HOST.test(ref)) return null;
      if (BLOB_ACCESS === "public") {
        const res = await fetch(ref, { cache: "no-store" });
        if (!res.ok) return null;
        return new Uint8Array(await res.arrayBuffer());
      }
      // Private store: the SDK reads with the store's token.
      const res = await get(ref, { access: "private", useCache: false });
      if (!res || res.statusCode !== 200) return null;
      return new Uint8Array(await new Response(res.stream).arrayBuffer());
    },
    async del(refs) {
      const urls = refs.filter((r) => BLOB_HOST.test(r));
      for (let i = 0; i < urls.length; i += 100) await del(urls.slice(i, i + 100));
    },
  };
}

function local(): FileStore {
  const root = path.join(process.cwd(), ".data", "files");
  const resolve = (ref: string) => {
    const p = path.join(root, ref.replace(/^local:/, ""));
    if (!p.startsWith(root + path.sep)) throw new UserError("Bad file reference");
    return p;
  };
  return {
    async put(key, data) {
      const ref = `local:${key}`;
      const p = resolve(ref);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, data);
      return ref;
    },
    async get(ref) {
      if (!ref.startsWith("local:")) return null;
      try {
        return new Uint8Array(fs.readFileSync(resolve(ref)));
      } catch {
        return null;
      }
    },
    async del(refs) {
      for (const r of refs) {
        if (!r.startsWith("local:")) continue;
        try {
          fs.unlinkSync(resolve(r));
        } catch {}
      }
    },
  };
}

export const files: FileStore = storageMode === "cloud" ? blob() : local();
