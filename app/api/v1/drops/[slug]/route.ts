import { apiUser } from "@/lib/auth";
import { UserError } from "@/lib/config";
import { json, readJson, route } from "@/lib/http";
import { contentFrom, pickFields } from "@/lib/inputs";
import { findDrop } from "@/lib/lookup";
import { deleteResponses, endDrop, removeDrop, Visibility } from "@/lib/model";
import { updateDropContent, updateDropSettings } from "@/lib/service";
import { originOf, publicDrop } from "@/lib/views";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = route(async (req: Request, ctx: Ctx) => {
  await apiUser(req);
  return json({ drop: publicDrop(await findDrop((await ctx.params).slug), originOf(req)) });
});

/** Push a new version to the same link. Content fields as for POST; optional `extend`, `title`. */
export const PUT = route(async (req: Request, ctx: Ctx) => {
  const user = await apiUser(req);
  let drop = await findDrop((await ctx.params).slug);
  const body = await readJson(req);
  if (drop.kind === "template" && body.data !== undefined && !body.templateId) body.templateId = drop.templateId;
  drop = await updateDropContent(drop, user, await contentFrom(body));
  const f = pickFields(body);
  const extend = typeof body.extend === "string" ? body.extend : undefined;
  if (extend || f.title) drop = await updateDropSettings(drop, user, { extend, title: f.title });
  return json({ drop: publicDrop(drop, originOf(req)) });
});

/** Settings only: { title?, extend?, password?: string | null, visibility? }, { end: true } or { deleteResponses: true }. */
export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const user = await apiUser(req);
  const drop = await findDrop((await ctx.params).slug);
  const b = await readJson<{ title?: string; extend?: string; password?: string | null; visibility?: Visibility; end?: boolean; deleteResponses?: boolean }>(req, 8192);
  if (b.end || b.deleteResponses) {
    let next = b.end ? await endDrop(drop) : drop;
    if (b.deleteResponses) next = await deleteResponses(next);
    return json({ drop: publicDrop(next, originOf(req)) });
  }
  if (b.password !== undefined && b.password !== null && typeof b.password !== "string") throw new UserError("Password must be text, or null to remove it.");
  return json({ drop: publicDrop(await updateDropSettings(drop, user, b), originOf(req)) });
});

export const DELETE = route(async (req: Request, ctx: Ctx) => {
  await apiUser(req);
  await removeDrop(await findDrop((await ctx.params).slug));
  return json({ ok: true });
});
