import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { LIFESPANS, storageMode } from "@/lib/config";
import { rowsFrom } from "@/lib/export";
import { fmtBytes, fmtDate } from "@/lib/format";
import { getDrop, listDocs, purgeAt } from "@/lib/model";
import { RESPONSE_RETENTION_DAYS } from "@/lib/config";
import DeleteResponses from "@/components/DeleteResponses";
import CopyButton from "@/components/CopyButton";
import DropActions from "@/components/DropActions";
import NewVersion from "@/components/NewVersion";
import Status from "@/components/Status";

export const dynamic = "force-dynamic";

async function origin() {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") || "http"}://${h.get("host")}`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const d = await getDrop((await params).id);
  return { title: d?.title || "Drop" };
}

export default async function DropPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ published?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const d = await getDrop(id);
  if (!d) notFound();
  const live = d.status === "live" && d.expiresAt > Date.now();
  const url = `${await origin()}/${d.slug}`;
  const rows = d.responsesDeletedAt ? [] : rowsFrom(await listDocs(d.id)).reverse();
  const keepUntil = purgeAt(d);
  const soon = live && d.expiresAt - Date.now() < 86_400_000;

  return (
    <main className="wrap page">
      <div className="stack">
        <Link href="/dashboard" className="small">← All drops</Link>
        <div className="row between">
          <div className="stack min0">
            <p className="eyebrow">{d.kind === "template" ? `Template · ${d.templateName}` : "Files"}</p>
            <h1 className="h1">{d.title}</h1>
          </div>
          <Status status={live ? "live" : "ended"} expiresAt={d.expiresAt} />
        </div>
      </div>

      {sp.published && live && <p className="notice">Published. Copy the link and send it{d.passwordHash ? ", with the password in a separate message" : ""}.</p>}
      {soon && <p className="notice"><b>This drop ends {fmtDate(d.expiresAt)}.</b> The link stops working then. Responses stay here for {RESPONSE_RETENTION_DAYS} days after that.</p>}

      {live ? (
        <div className="card stack-lg">
          <div className="stack">
            <span className="label">Link</span>
            <p className="h2 mono" style={{ wordBreak: "break-all", fontSize: 20 }}>{url}</p>
          </div>
          <div className="row">
            <CopyButton text={url} />
            <a className="btn btn-ghost" href={`/${d.slug}`} target="_blank" rel="noreferrer">Open</a>
          </div>
          <div className="grid-3">
            <div><span className="label">Ends</span><p>{fmtDate(d.expiresAt)}</p></div>
            <div><span className="label">Access</span><p>{d.passwordHash ? "Password" : "Anyone with the link"}</p></div>
            <div><span className="label">Responses in page</span><p>{d.visibility === "own" ? "Own only" : "Shared"}</p></div>
            <div><span className="label">Owner</span><p>{d.owner.name}</p></div>
            <div><span className="label">Version</span><p>{d.version}{d.updatedBy ? ` · by ${d.updatedBy.name}` : ""}</p></div>
            <div><span className="label">Views</span><p className="num">{d.views || 0}</p></div>
          </div>
        </div>
      ) : (
        <div className="card stack">
          <p className="h3">This drop ended {d.endedAt ? fmtDate(d.endedAt) : ""}.</p>
          <p className="muted">
            The link no longer works and its files have been deleted.{" "}
            {d.responsesDeletedAt
              ? `Its responses were deleted ${fmtDate(d.responsesDeletedAt)}.`
              : `Its responses are below until ${fmtDate(keepUntil)}, then they're deleted with this record. Download what you need before then.`}
          </p>
        </div>
      )}

      {!d.responsesDeletedAt && (
        <section className="stack-lg">
          <div className="row between">
            <h2 className="h2">Responses <span className="muted num">{rows.length}</span></h2>
            {rows.length > 0 && (
              <div className="row">
                <a className="btn btn-ghost btn-sm" href={`/api/drops/${d.id}/responses?format=csv`}>Download CSV</a>
                <a className="btn btn-ghost btn-sm" href={`/api/drops/${d.id}/responses?download=1`}>Download JSON</a>
              </div>
            )}
          </div>
          {rows.length === 0 ? (
            <div className="card empty">
              <p>{live ? "Nothing saved yet. Responses appear here when the page saves them, for example when a participant finishes a card sort." : "This drop ended without any saved responses."}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="t">
                <thead>
                  <tr><th>Saved</th><th>Kind</th><th>Summary</th><th>Visitor</th></tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((r) => {
                    const data = r.data as Record<string, unknown>;
                    const who = data.participant || data.name || data.email || "";
                    const status = data.status ? String(data.status) : "";
                    return (
                      <tr key={r.collection + r.id}>
                        <td className="num" style={{ whiteSpace: "nowrap" }}>{fmtDate(Date.parse(r.updatedAt))}</td>
                        <td className="mono small">{r.collection}</td>
                        <td className="min0">
                          <details>
                            <summary>{[who, status].filter(Boolean).join(" · ") || `${Object.keys(data).length} fields`}</summary>
                            <pre className="json">{JSON.stringify(data, null, 2)}</pre>
                          </details>
                        </td>
                        <td className="mono small muted">{r.visitor}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > 100 && <p className="muted small">Showing the latest 100. The downloads include all {rows.length}.</p>}
          {rows.length > 0 && (
            <div className="row between">
              <p className="muted small">{live ? `Kept for ${RESPONSE_RETENTION_DAYS} days after the drop ends.` : `Deleted automatically ${fmtDate(keepUntil)}.`}</p>
              <DeleteResponses dropId={d.id} count={rows.length} />
            </div>
          )}
        </section>
      )}

      {live && (
        <div className="grid-2">
          <section className="card stack-lg">
            <div className="stack">
              <h2 className="h3">Update the content</h2>
              <p className="muted small">Same link, new version. Saved responses are kept.</p>
            </div>
            <NewVersion dropId={d.id} kind={d.kind} mode={storageMode} data={d.kind === "template" ? JSON.stringify(d.data, null, 2) : undefined} />
          </section>
          <section className="card stack-lg">
            <h2 className="h3">Settings</h2>
            <DropActions
              dropId={d.id}
              title={d.title}
              hasPassword={!!d.passwordHash}
              visibility={d.visibility}
              lifespans={LIFESPANS.map((l) => ({ value: l.key, label: l.label }))}
              live={live}
              keepDays={RESPONSE_RETENTION_DAYS}
              responses={rows.length}
            />
          </section>
        </div>
      )}

      {!live && <DropActions dropId={d.id} title={d.title} hasPassword={false} visibility={d.visibility} lifespans={[]} live={false} />}

      {live && d.files.length > 0 && (
        <details className="card-plain">
          <summary className="h3">Files ({d.files.length})</summary>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="t">
              <tbody>
                {d.files.map((f) => (
                  <tr key={f.path}>
                    <td className="mono small">{f.path}{f.path === d.entry ? "  · start page" : ""}</td>
                    <td className="num muted small" style={{ textAlign: "right" }}>{fmtBytes(f.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </main>
  );
}
