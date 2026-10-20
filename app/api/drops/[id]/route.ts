import { apiUser } from "@/lib/auth";
import { UserError } from "@/lib/config";
import { json, readJson, route } from "@/lib/http";
import { findDrop } from "@/lib/lookup";
import { deleteResponses, endDrop, removeDrop, Visibility } from "@/lib/model";
import { updateDropSettings } from "@/lib/service";
import { originOf, publicDrop } from "@/lib/views";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, ctx: Ctx) => {
  await apiUser(req);
  return json({ drop: publicDrop(await findDrop((await ctx.params).id), originOf(req)) });
});

/** Change settings: { title?, extend?: "7d", password?: string | null, visibility? }. Or { end: true }, or { deleteResponses: true }. */
export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const user = await apiUser(req);
  const drop = await findDrop((await ctx.params).id);
  const b = await readJson<{ title?: string; extend?: string; password?: string | null; visibility?: Visibility; end?: boolean; deleteResponses?: boolean }>(req, 8192);
  if (b.end || b.deleteResponses) {
    let next = b.end ? await endDrop(drop) : drop;
    if (b.deleteResponses) next = await deleteResponses(next);
    return json({ drop: publicDrop(next, originOf(req)) });
  }
  if (b.password !== undefined && b.password !== null && typeof b.password !== "string") throw new UserError("Password must be text, or null to remove it.");
  const next = await updateDropSettings(drop, user, b);
  return json({ drop: publicDrop(next, originOf(req)) });
});

/** Ends the drop now (if live), deletes its responses and removes it from the list. */
export const DELETE = route(async (req: Request, ctx: Ctx) => {
  await apiUser(req);
  await removeDrop(await findDrop((await ctx.params).id));
  return json({ ok: true });
});
