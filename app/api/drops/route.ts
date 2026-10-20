import { apiUser } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";
import { contentFrom, pickFields } from "@/lib/inputs";
import { listDrops } from "@/lib/model";
import { createDrop } from "@/lib/service";
import { originOf, publicDrop } from "@/lib/views";

export const GET = route(async (req: Request) => {
  await apiUser(req);
  const origin = originOf(req);
  return json({ drops: (await listDrops()).map((d) => publicDrop(d, origin)) });
});

export const POST = route(async (req: Request) => {
  const user = await apiUser(req);
  const body = await readJson(req);
  const drop = await createDrop({ user, ...pickFields(body), content: await contentFrom(body) });
  return json({ drop: publicDrop(drop, originOf(req)) }, 201);
});
