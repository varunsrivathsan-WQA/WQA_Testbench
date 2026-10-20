import { kv } from "./store/kv";
import { files as fileStore } from "./store/files";
import { ENDED_RECORD_DAYS, LIMITS, RESERVED_SLUGS, TEMPLATE_ADMINS, UserError } from "./config";
import { mimeFor, RawFile } from "./package";
import { randomId } from "./crypto";

export type Person = { email: string; name: string };
export type FileEntry = { path: string; ref: string; size: number; type: string };
export type Visibility = "shared" | "own";

export type Drop = {
  id: string;
  slug: string;
  title: string;
  owner: Person;
  updatedBy?: Person;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  status: "live" | "ended";
  endedAt?: number;
  version: number;
  kind: "files" | "template";
  templateId?: string;
  templateName?: string;
  /** For template drops: the JSON the template runs on. */
  data?: unknown;
  files: FileEntry[];
  entry: string;
  passwordHash?: string;
  passwordVersion: number;
  visibility: Visibility;
  views: number;
};

export type Template = {
  id: string;
  name: string;
  description: string;
  owner: Person;
  editors: string[];
  files: FileEntry[];
  entry: string;
  version: number;
  /** Keys the JSON must have, e.g. ["sorts"]. */
  requiredKeys: string[];
  example?: unknown;
  createdAt: number;
  updatedAt: number;
  updatedBy?: Person;
};

export type StoredDoc = {
  data: Record<string, unknown>;
  visitor: string;
  createdAt: number;
  updatedAt: number;
};

const K = {
  drop: (id: string) => `drop:${id}`,
  drops: "drops",
  slug: (s: string) => `slug:${s}`,
  docs: (id: string) => `docs:${id}`,
  template: (id: string) => `template:${id}`,
  templates: "templates",
};

/* ---------- Slugs ---------- */

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.(html?|zip|json)$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

export function checkSlugFormat(slug: string) {
  if (!/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/.test(slug))
    throw new UserError("Links can use lower-case letters, numbers and dashes, 3 to 60 characters.");
  if (RESERVED_SLUGS.has(slug)) throw new UserError(`"${slug}" is reserved. Pick another link.`);
}

export async function slugTaken(slug: string) {
  return !!(await kv.get<string>(K.slug(slug)));
}

/** Suggested link: readable part plus 4 random characters, so links can't be guessed. */
export async function suggestSlug(from: string) {
  const base = slugify(from) || "drop";
  for (let i = 0; i < 5; i++) {
    const s = `${base}-${randomId(4)}`;
    if (!(await slugTaken(s))) return s;
  }
  return `${base}-${randomId(8)}`;
}

/* ---------- Files ---------- */

export async function storeFiles(prefix: string, list: RawFile[]): Promise<FileEntry[]> {
  const out: FileEntry[] = [];
  const queue = [...list];
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const f = queue.shift()!;
      const type = mimeFor(f.path);
      const ref = await fileStore.put(`${prefix}/${f.path}`, f.data, type);
      out.push({ path: f.path, ref, size: f.data.byteLength, type });
    }
  });
  await Promise.all(workers);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export async function copyFiles(prefix: string, src: FileEntry[]) {
  const raw: RawFile[] = [];
  for (const f of src) {
    const data = await fileStore.get(f.ref);
    if (!data) throw new UserError(`The template file "${f.path}" is missing. Ask its owner to re-upload it.`);
    raw.push({ path: f.path, data });
  }
  return storeFiles(prefix, raw);
}

export async function deleteFiles(list: FileEntry[]) {
  await fileStore.del(list.map((f) => f.ref));
}

export async function readFile(f: FileEntry) {
  return fileStore.get(f.ref);
}

/* ---------- Drops ---------- */

export function isLive(d: Drop, now = Date.now()) {
  return d.status === "live" && d.expiresAt > now;
}

export async function getDrop(id: string) {
  return kv.get<Drop>(K.drop(id));
}

export async function getDropBySlug(slug: string) {
  const id = await kv.get<string>(K.slug(slug));
  return id ? getDrop(id) : null;
}

export async function saveDrop(d: Drop) {
  await kv.set(K.drop(d.id), d);
}

export async function insertDrop(d: Drop) {
  checkSlugFormat(d.slug);
  if (await slugTaken(d.slug)) throw new UserError(`The link /${d.slug} is already in use.`);
  await kv.set(K.slug(d.slug), d.id);
  await kv.set(K.drop(d.id), d);
  await kv.sadd(K.drops, d.id);
}

/** Ends a drop: deletes its files and responses, keeps a small record for the inventory. */
export async function endDrop(d: Drop) {
  if (d.status === "ended") return d;
  await deleteFiles(d.files);
  await kv.del(K.docs(d.id));
  const ended: Drop = { ...d, status: "ended", endedAt: Date.now(), files: [], data: undefined, passwordHash: undefined };
  await saveDrop(ended);
  return ended;
}

export async function removeDrop(d: Drop) {
  if (d.status !== "ended") await endDrop(d);
  await kv.del(K.drop(d.id), K.slug(d.slug));
  await kv.srem(K.drops, d.id);
}

/** All drops, newest first. Ends any that have expired and removes old ended records. */
export async function listDrops() {
  const ids = await kv.smembers(K.drops);
  const now = Date.now();
  const out: Drop[] = [];
  for (const id of ids) {
    let d = await getDrop(id);
    if (!d) {
      await kv.srem(K.drops, id);
      continue;
    }
    if (d.status === "live" && d.expiresAt <= now) d = await endDrop(d);
    if (d.status === "ended" && (d.endedAt || 0) < now - ENDED_RECORD_DAYS * 86_400_000) {
      await removeDrop(d);
      continue;
    }
    out.push(d);
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

/* ---------- Responses ---------- */

export async function listDocs(dropId: string) {
  return kv.hgetall<StoredDoc>(K.docs(dropId));
}

export async function getDoc(dropId: string, path: string) {
  return kv.hget<StoredDoc>(K.docs(dropId), path);
}

export async function putDoc(dropId: string, path: string, doc: StoredDoc) {
  if (JSON.stringify(doc.data).length > LIMITS.docBytes) throw new UserError("That response is too large to save.", 413);
  const existing = await getDoc(dropId, path);
  if (!existing && (await kv.hlen(K.docs(dropId))) >= LIMITS.docsPerDrop)
    throw new UserError("This test has reached its response limit.", 409);
  await kv.hset(K.docs(dropId), path, doc);
}

export async function deleteDoc(dropId: string, path: string) {
  await kv.hdel(K.docs(dropId), path);
}

export async function countResponses(dropId: string) {
  const all = await listDocs(dropId);
  return Object.keys(all).filter((p) => !p.startsWith("config/")).length;
}

/* ---------- Templates ---------- */

export async function getTemplate(id: string) {
  return kv.get<Template>(K.template(id));
}

export async function listTemplates() {
  const ids = await kv.smembers(K.templates);
  const out: Template[] = [];
  for (const id of ids) {
    const t = await getTemplate(id);
    if (t) out.push(t);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveTemplate(t: Template) {
  await kv.set(K.template(t.id), t);
  await kv.sadd(K.templates, t.id);
}

export async function removeTemplate(t: Template) {
  await deleteFiles(t.files);
  await kv.del(K.template(t.id));
  await kv.srem(K.templates, t.id);
}

/** Anyone on the team can create or use a template; only its owner, its editors and admins can change it. */
export function canEditTemplate(email: string, t: Template) {
  const e = email.toLowerCase();
  return t.owner.email.toLowerCase() === e || t.editors.map((x) => x.toLowerCase()).includes(e) || TEMPLATE_ADMINS.includes(e);
}

export function checkTemplateData(t: Template, data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new UserError("The JSON must be an object, starting with {.");
  if (JSON.stringify(data).length > LIMITS.dataBytes) throw new UserError("That JSON is over 1 MB.");
  const missing = t.requiredKeys.filter((k) => !(k in (data as object)));
  if (missing.length) throw new UserError(`The JSON for "${t.name}" needs: ${missing.join(", ")}.`);
}
