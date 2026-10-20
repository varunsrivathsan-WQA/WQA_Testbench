import { zipSync } from "fflate";
import { upload } from "@vercel/blob/client";

export type Picked = { path: string; file: File }[];

type Entry = FileSystemEntry & { isFile: boolean; isDirectory: boolean };

function readEntry(entry: Entry, prefix: string, out: Picked): Promise<void> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file(
        (file) => {
          out.push({ path: prefix + file.name, file });
          resolve();
        },
        () => resolve()
      );
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const all: Entry[] = [];
      const next = () =>
        reader.readEntries(async (batch) => {
          if (!batch.length) {
            for (const e of all) await readEntry(e, `${prefix}${entry.name}/`, out);
            resolve();
          } else {
            all.push(...(batch as Entry[]));
            next();
          }
        }, () => resolve());
      next();
    } else resolve();
  });
}

/** Files from a drag and drop, including whole folders. */
export async function pickedFromDrop(dt: DataTransfer): Promise<Picked> {
  const out: Picked = [];
  const entries = [...dt.items].map((i) => i.webkitGetAsEntry?.() as Entry | null).filter(Boolean) as Entry[];
  if (entries.length) {
    for (const e of entries) await readEntry(e, "", out);
    return out;
  }
  return [...dt.files].map((file) => ({ path: file.name, file }));
}

/** Files from an <input type="file">, keeping folder paths if a folder was picked. */
export function pickedFromInput(list: FileList | null): Picked {
  return [...(list || [])].map((file) => ({ path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name, file }));
}

export function describe(p: Picked) {
  if (!p.length) return "";
  const size = p.reduce((n, f) => n + f.file.size, 0);
  const mb = size > 1048576 ? `${(size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
  if (p.length === 1) return `${p[0].path} · ${mb}`;
  const top = p[0].path.split("/")[0];
  return `${p.every((f) => f.path.startsWith(top + "/")) ? top : `${p.length} files`} · ${p.length} files · ${mb}`;
}

/** Zips what was picked (a single ZIP is sent as it is) and uploads it. Returns the package reference. */
export async function uploadPicked(p: Picked, mode: "cloud" | "local"): Promise<string> {
  let zip: Uint8Array;
  if (p.length === 1 && /\.zip$/i.test(p[0].path)) {
    zip = new Uint8Array(await p[0].file.arrayBuffer());
  } else {
    const entries: Record<string, Uint8Array> = {};
    for (const f of p) entries[f.path] = new Uint8Array(await f.file.arrayBuffer());
    zip = zipSync(entries, { level: 6 });
  }
  const blob = new Blob([zip as BlobPart], { type: "application/zip" });
  if (mode === "cloud") {
    const res = await upload(`packages/${Date.now()}.zip`, blob, { access: "public", handleUploadUrl: "/api/upload", contentType: "application/zip" });
    return res.url;
  }
  const res = await fetch("/api/upload/local", { method: "PUT", body: blob });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Upload failed");
  return body.ref;
}

export async function api<T = Record<string, unknown>>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body as T;
}
