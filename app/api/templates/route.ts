import { apiUser } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";
import { listTemplates } from "@/lib/model";
import { createTemplate, TemplateInput } from "@/lib/templates";
import { publicTemplate } from "@/lib/views";

export const GET = route(async (req: Request) => {
  await apiUser(req);
  return json({ templates: (await listTemplates()).map(publicTemplate) });
});

export const POST = route(async (req: Request) => {
  const user = await apiUser(req);
  const t = await createTemplate(user, await readJson<TemplateInput>(req));
  return json({ template: publicTemplate(t) }, 201);
});
