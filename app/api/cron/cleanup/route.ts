import { isProd } from "@/lib/config";
import { json } from "@/lib/http";
import { listDrops } from "@/lib/model";

export const dynamic = "force-dynamic";

/** Nightly (vercel.json). listDrops() ends expired drops and clears old ended records as it goes. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (isProd && (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)) return json({ error: "Unauthorised" }, 401);
  const drops = await listDrops();
  return json({ ok: true, live: drops.filter((d) => d.status === "live").length, ended: drops.filter((d) => d.status === "ended").length });
}
