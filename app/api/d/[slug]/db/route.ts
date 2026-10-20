import { headers } from "next/headers";
import { LIMITS, UserError } from "@/lib/config";
import { json, readJson, route } from "@/lib/http";
import { deleteDoc, getDoc, getDropBySlug, isLive, listDocs, putDoc, StoredDoc } from "@/lib/model";
import { randomId } from "@/lib/crypto";
import { kv } from "@/lib/store/kv";
import { isUnlocked } from "@/lib/visitor";

type Body = { op: string; args?: { collection?: string; path?: string; data?: unknown } };

const SEG = /^[A-Za-z0-9_.-]{1,100}$/;
const CONFIG_PATH = "config/content";

function checkPath(p: unknown): string {
  if (typeof p !== "string") throw new UserError("Missing document path.");
  const parts = p.split("/");
  if (parts.length !== 2 || !parts.every((s) => SEG.test(s))) throw new UserError(`"${p}" isn't a valid document path.`);
  return p;
}

function checkData(d: unknown): Record<string, unknown> {
  if (!d || typeof d !== "object" || Array.isArray(d)) throw new UserError("Documents must be objects.");
  return JSON.parse(JSON.stringify(d));
}

/** Storage for a hosted page. Called by the player on behalf of the page's sandboxed iframe. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const drop = await getDropBySlug(slug);
  if (!drop || !isLive(drop)) throw new UserError("This link has ended, so nothing more can be saved.", 410);
  if (!(await isUnlocked(drop))) throw new UserError("Enter the password again to keep saving.", 401);

  const visitor = (await headers()).get("x-visitor") || "";
  if (!/^[a-z0-9-]{8,64}$/.test(visitor)) throw new UserError("Reload the page to keep saving.");

  const { op, args = {} } = await readJson<Body>(req, LIMITS.docBytes + 4096);
  const own = drop.visibility === "own";
  const canSee = (d: StoredDoc) => !own || d.visitor === visitor;

  if (op === "list") {
    const coll = String(args.collection || "");
    if (!SEG.test(coll)) throw new UserError("Missing collection name.");
    const all = await listDocs(drop.id);
    const rows = Object.entries(all)
      .filter(([p, d]) => p.startsWith(coll + "/") && canSee(d))
      .map(([path, d]) => ({ path, data: d.data }));
    return json({ result: rows });
  }

  if (op === "get") {
    const path = checkPath(args.path);
    if (path === CONFIG_PATH && drop.kind === "template") return json({ result: drop.data ?? null });
    const d = await getDoc(drop.id, path);
    if (!d) return json({ result: null });
    if (!canSee(d) && !path.startsWith("config/")) return json({ result: null });
    return json({ result: d.data });
  }

  const writes = await kv.incrTtl(`rl:db:${slug}:${visitor}`, 600);
  if (writes > 600) throw new UserError("Too many saves in a short time. Wait a few minutes.", 429);

  if (op === "add") {
    const coll = String(args.collection || "");
    if (!SEG.test(coll) || coll === "config") throw new UserError("That collection name isn't allowed.");
    const id = `${Date.now().toString(36)}-${randomId(6)}`;
    const now = Date.now();
    await putDoc(drop.id, `${coll}/${id}`, { data: checkData(args.data), visitor, createdAt: now, updatedAt: now });
    return json({ result: { id } });
  }

  if (op === "set" || op === "update" || op === "delete") {
    const path = checkPath(args.path);
    if (path.startsWith("config/")) {
      if (drop.kind === "template") throw new UserError("This test's content comes from its JSON. Change it from the WQA dashboard.", 403);
      if (own) throw new UserError("Content can't be changed from this link.", 403);
    }
    const existing = await getDoc(drop.id, path);
    if (existing && own && existing.visitor !== visitor && !path.startsWith("config/")) throw new UserError("You can only change your own responses.", 403);
    if (op === "delete") {
      if (existing) await deleteDoc(drop.id, path);
      return json({ result: true });
    }
    const data = op === "update" && existing ? { ...existing.data, ...checkData(args.data) } : checkData(args.data);
    const now = Date.now();
    await putDoc(drop.id, path, { data, visitor: existing?.visitor || visitor, createdAt: existing?.createdAt || now, updatedAt: now });
    return json({ result: true });
  }

  throw new UserError(`Unknown operation "${op}".`);
});
