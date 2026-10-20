import { apiUser } from "@/lib/auth";
import { rowsFrom, toCsv } from "@/lib/export";
import { json, route } from "@/lib/http";
import { findDrop } from "@/lib/lookup";
import { listDocs } from "@/lib/model";

/** ?format=json (default) or ?format=csv */
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await apiUser(req);
  const drop = await findDrop((await ctx.params).id);
  const rows = rowsFrom(await listDocs(drop.id));
  const format = new URL(req.url).searchParams.get("format");
  const name = `${drop.slug}-responses-${new Date().toISOString().slice(0, 10)}`;
  if (format === "csv") {
    return new Response("﻿" + toCsv(rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"`, "Cache-Control": "no-store" },
    });
  }
  const disposition = new URL(req.url).searchParams.get("download") ? { "Content-Disposition": `attachment; filename="${name}.json"` } : undefined;
  return json({ drop: { slug: drop.slug, title: drop.title }, responses: rows }, 200, disposition);
});
