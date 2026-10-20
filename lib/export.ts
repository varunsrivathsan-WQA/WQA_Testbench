import type { StoredDoc } from "./model";

export type ExportRow = { id: string; collection: string; createdAt: string; updatedAt: string; visitor: string; data: Record<string, unknown> };

export function rowsFrom(docs: Record<string, StoredDoc>): ExportRow[] {
  return Object.entries(docs)
    .filter(([p]) => !p.startsWith("config/"))
    .map(([p, d]) => {
      const [collection, id] = p.split("/");
      return {
        id, collection,
        createdAt: new Date(d.createdAt).toISOString(),
        updatedAt: new Date(d.updatedAt).toISOString(),
        visitor: d.visitor.slice(0, 8),
        data: d.data,
      };
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function cell(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per response. Top-level fields become columns; nested values are JSON in the cell. */
export function toCsv(rows: ExportRow[]) {
  const keys: string[] = [];
  for (const r of rows) for (const k of Object.keys(r.data)) if (!keys.includes(k)) keys.push(k);
  const head = ["id", "collection", "createdAt", "updatedAt", "visitor", ...keys];
  const lines = [head.map(cell).join(",")];
  for (const r of rows) lines.push([r.id, r.collection, r.createdAt, r.updatedAt, r.visitor, ...keys.map((k) => r.data[k])].map(cell).join(","));
  return lines.join("\r\n");
}
