import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { storageMode } from "@/lib/config";
import { fmtBytes, fmtDate } from "@/lib/format";
import { canEditTemplate, getTemplate } from "@/lib/model";
import TemplateForm from "@/components/TemplateForm";
import CopyButton from "@/components/CopyButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: (await getTemplate((await params).id))?.name || "Template" };
}

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTemplate((await params).id);
  if (!t) notFound();
  const me = (await currentUser())!;
  const editable = canEditTemplate(me.email, t);
  const example = t.example !== undefined ? JSON.stringify(t.example, null, 2) : null;

  return (
    <main className="wrap page">
      <div className="stack">
        <Link href="/templates" className="small">← All templates</Link>
        <div className="row between">
          <div className="stack min0">
            <p className="eyebrow">Template · v{t.version}</p>
            <h1 className="h1">{t.name}</h1>
            {t.description && <p className="sub">{t.description}</p>}
          </div>
          <Link href={`/new?template=${t.id}`} className="btn btn-primary">Use this template</Link>
        </div>
      </div>

      <div className="grid-3">
        <div className="stat"><span>Owner</span><p className="h3">{t.owner.name}</p></div>
        <div className="stat"><span>Editors</span><p className="h3">{t.editors.length ? t.editors.join(", ") : "Owner only"}</p></div>
        <div className="stat"><span>Updated</span><p className="h3">{fmtDate(t.updatedAt)}</p></div>
      </div>

      <div className="grid-2">
        <section className="card stack">
          <div className="row between">
            <h2 className="h3">Example JSON</h2>
            {example && <CopyButton text={example} label="Copy" className="btn btn-ghost btn-sm" />}
          </div>
          {t.requiredKeys.length > 0 && <p className="small muted">Must include: {t.requiredKeys.map((k) => <code key={k} style={{ marginRight: 4 }}>{k}</code>)}</p>}
          {example ? <pre className="json">{example}</pre> : <p className="muted">No example yet.</p>}
        </section>
        <section className="card stack">
          <h2 className="h3">Files</h2>
          <div className="table-wrap">
            <table className="t">
              <tbody>
                {t.files.map((f) => (
                  <tr key={f.path}>
                    <td className="mono small">{f.path}{f.path === t.entry ? "  · start page" : ""}</td>
                    <td className="num muted small" style={{ textAlign: "right" }}>{fmtBytes(f.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {editable ? (
        <section className="card stack-lg">
          <div className="stack">
            <h2 className="h3">Edit</h2>
            <p className="muted small">Changes apply to new drops. Live drops keep the version they started with.</p>
          </div>
          <TemplateForm
            mode={storageMode}
            existing={{ id: t.id, name: t.name, description: t.description, editors: t.editors.join(", "), requiredKeys: t.requiredKeys.join(", "), example: example || "" }}
          />
        </section>
      ) : (
        <p className="notice">Only {t.owner.name}{t.editors.length ? " and the editors listed above" : ""} can change this template. You can still use it.</p>
      )}
    </main>
  );
}
