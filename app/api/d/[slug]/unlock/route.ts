import { cookies, headers } from "next/headers";
import { UserError, isProd } from "@/lib/config";
import { unlockValue, verifyPassword } from "@/lib/crypto";
import { json, readJson, route } from "@/lib/http";
import { getDropBySlug, isLive } from "@/lib/model";
import { kv } from "@/lib/store/kv";
import { unlockCookie } from "@/lib/visitor";

export const POST = route(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const drop = await getDropBySlug(slug);
  if (!drop || !isLive(drop)) throw new UserError("This link has ended.", 410);
  if (!drop.passwordHash) return json({ ok: true });

  const ip = ((await headers()).get("x-forwarded-for") || "local").split(",")[0].trim();
  const tries = await kv.incrTtl(`rl:unlock:${slug}:${ip}`, 900);
  if (tries > 10) throw new UserError("Too many tries. Wait 15 minutes and try again.", 429);

  const { password } = await readJson<{ password?: string }>(req, 4096);
  if (!password || !verifyPassword(password, drop.passwordHash)) throw new UserError("That password isn't right.", 401);

  (await cookies()).set(unlockCookie(slug), unlockValue(slug, drop.passwordVersion), {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: new Date(drop.expiresAt),
  });
  return json({ ok: true });
});
