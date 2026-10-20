import { apiUser } from "@/lib/auth";
import { UserError } from "@/lib/config";
import { json, readJson, route } from "@/lib/http";
import { canEditTemplate, removeTemplate } from "@/lib/model";
import { findTemplate, TemplateInput, updateTemplate } from "@/lib/templates";
import { publicTemplate } from "@/lib/views";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, ctx: Ctx) => {
  await apiUser(req);
  return json({ template: publicTemplate(await findTemplate((await ctx.params).id)) });
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const user = await apiUser(req);
  const t = await findTemplate((await ctx.params).id);
  if (!canEditTemplate(user.email, t)) throw new UserError(`Only ${t.owner.name} and the template's editors can change it.`, 403);
  return json({ template: publicTemplate(await updateTemplate(t, user, await readJson<TemplateInput>(req))) });
});

export const DELETE = route(async (req: Request, ctx: Ctx) => {
  const user = await apiUser(req);
  const t = await findTemplate((await ctx.params).id);
  if (!canEditTemplate(user.email, t)) throw new UserError(`Only ${t.owner.name} and the template's editors can delete it.`, 403);
  await removeTemplate(t);
  return json({ ok: true });
});
