import { apiUser } from "@/lib/auth";
import { UserError } from "@/lib/config";
import { json, route } from "@/lib/http";
import { checkSlugFormat, slugTaken, suggestSlug } from "@/lib/model";

/** ?check=my-link → { ok, error? }   ?from=Some title → { slug } */
export const GET = route(async (req: Request) => {
  await apiUser(req);
  const q = new URL(req.url).searchParams;
  const from = q.get("from");
  if (from !== null) return json({ slug: await suggestSlug(from) });
  const s = (q.get("check") || "").toLowerCase();
  try {
    checkSlugFormat(s);
    if (await slugTaken(s)) throw new UserError(`/${s} is already in use.`);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof UserError) return json({ ok: false, error: e.message });
    throw e;
  }
});
