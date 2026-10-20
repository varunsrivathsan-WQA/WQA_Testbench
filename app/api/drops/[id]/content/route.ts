import { apiUser } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";
import { contentFrom } from "@/lib/inputs";
import { findDrop } from "@/lib/lookup";
import { updateDropContent } from "@/lib/service";
import { originOf, publicDrop } from "@/lib/views";

/** Publish a new version to the same link. Body: same content fields as creating a drop. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser(req);
  const drop = await findDrop((await ctx.params).id);
  const body = await readJson(req);
  if (drop.kind === "template" && body.data !== undefined && !body.templateId) body.templateId = drop.templateId;
  const next = await updateDropContent(drop, user, await contentFrom(body));
  return json({ drop: publicDrop(next, originOf(req)) });
});
