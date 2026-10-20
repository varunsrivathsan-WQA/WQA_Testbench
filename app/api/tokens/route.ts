import { createApiToken, currentUser, listApiTokens, revokeApiToken } from "@/lib/auth";
import { UserError } from "@/lib/config";
import { json, readJson, route } from "@/lib/http";

async function me() {
  const u = await currentUser();
  if (!u) throw new UserError("Sign in first.", 401);
  return u;
}

export const GET = route(async () => json({ tokens: await listApiTokens((await me()).email) }));

export const POST = route(async (req: Request) => {
  const { label } = await readJson<{ label?: string }>(req, 2048);
  const { token, secret } = await createApiToken(await me(), label || "");
  return json({ token, secret }, 201);
});

export const DELETE = route(async (req: Request) => {
  const id = new URL(req.url).searchParams.get("id") || "";
  await revokeApiToken((await me()).email, id);
  return json({ ok: true });
});
