import Link from "next/link";
import { fmtAgo } from "@/lib/format";
import { listTemplates } from "@/lib/model";

export const dynamic = "force-dynamic";
export const metadata = { title: "Templates" };

export default async function Templates() {
  const templates = await listTemplates();
  return (
    <main className="wrap page">
      <div className="row between">
        <div className="stack">
          <p className="eyebrow">Templates</p>
          <h1 className="h1">Reuse a test with new data.</h1>
          <p className="sub">A template is a page that reads its content from JSON. Anyone on the team can add one or use one. Only its owner and named editors can change it.</p>
        </div>
        <Link href="/templates/new" className="btn btn-primary">Add a template</Link>
      </div>
      {templates.length === 0 ? (
        <div className="card empty">
          <p className="h3">No templates yet.</p>
          <p>Upload a study page such as the card sort, list the JSON keys it needs and add an example. Then anyone can start a test by dropping in a JSON file.</p>
          <Link href="/templates/new" className="btn btn-primary">Add a template</Link>
        </div>
      ) : (
        <div className="grid-2">
          {templates.map((t) => (
            <Link key={t.id} href={`/templates/${t.id}`} className="card stack" style={{ color: "inherit", textDecoration: "none" }}>
              <p className="h3">{t.name}</p>
              <p className="muted">{t.description || "No description."}</p>
              <div className="row small muted">
                {t.requiredKeys.length > 0 && <span>Needs {t.requiredKeys.map((k) => <code key={k} style={{ marginRight: 4 }}>{k}</code>)}</span>}
                <span>v{t.version} · {t.owner.name} · {fmtAgo(t.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
