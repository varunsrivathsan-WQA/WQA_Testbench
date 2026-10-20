import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { fmtAgo, fmtDate, fmtDay } from "@/lib/format";
import { countResponses, listDrops, purgeAt } from "@/lib/model";
import Status from "@/components/Status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Drops" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const sp = await searchParams;
  const me = (await currentUser())!;
  const all = await listDrops();
  const now = Date.now();
  const live = all.filter((d) => d.status === "live");
  const show = sp.show === "ended" ? "ended" : sp.show === "mine" ? "mine" : "live";
  const rows = show === "ended" ? all.filter((d) => d.status === "ended") : show === "mine" ? live.filter((d) => d.owner.email === me.email) : live;
  const counts = new Map<string, number>();
  for (const d of rows) if (!d.responsesDeletedAt) counts.set(d.id, await countResponses(d.id));
  const soon = live.filter((d) => d.expiresAt - now < 86_400_000).length;
  const responses = [...counts.values()].reduce((a, b) => a + b, 0);

  return (
    <main className="wrap page">
      <div className="row between">
        <div className="stack">
          <p className="eyebrow">WQA Testbench</p>
          <h1 className="h1">Drops.</h1>
          <p className="sub">Everything shared with clients right now, who owns it and when it ends. When a drop ends, its link and files go straight away. Its responses stay under Ended for the team to download.</p>
        </div>
        <Link href="/new" className="btn btn-primary">New drop</Link>
      </div>

      <div className="stats">
        <div className="stat"><b>{live.length}</b><span>Live drops</span></div>
        <div className="stat"><b>{soon}</b><span>End in the next 24 hours</span></div>
        <div className="stat"><b>{responses}</b><span>Responses on the drops below</span></div>
      </div>

      <div className="stack-lg">
        <nav className="segmented" aria-label="Filter drops">
          {[
            { k: "live", label: `Live (${live.length})` },
            { k: "mine", label: "Mine" },
            { k: "ended", label: "Ended" },
          ].map((t) => (
            <Link key={t.k} href={`/dashboard${t.k === "live" ? "" : `?show=${t.k}`}`} aria-current={show === t.k ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>

        {rows.length === 0 ? (
          <div className="card empty">
            <p className="h3">{show === "ended" ? "No ended drops with responses still kept." : "Nothing is live."}</p>
            {show !== "ended" && <p>Drop an HTML file, a folder or a ZIP, or start from a template. You get a link that ends on its own.</p>}
            {show !== "ended" && <Link href="/new" className="btn btn-primary">New drop</Link>}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Drop</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th className="num">Responses</th>
                  <th className="num">Views</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td className="title-cell">
                      <div className="stack" style={{ gap: 2 }}>
                        <Link href={`/drops/${d.id}`}>{d.title}</Link>
                        <span className="muted small mono">/{d.slug}{d.passwordHash ? " · password" : ""}{d.templateName ? ` · ${d.templateName}` : ""}</span>
                      </div>
                    </td>
                    <td>
                      <Status status={d.status} expiresAt={d.expiresAt} />
                      <div className="muted small" style={{ marginTop: 4 }}>{d.status === "live" ? fmtDate(d.expiresAt) : d.responsesDeletedAt ? "Responses deleted" : `Responses kept until ${fmtDay(purgeAt(d))}`}</div>
                    </td>
                    <td>{d.owner.name}</td>
                    <td className="num">{d.responsesDeletedAt ? "—" : counts.get(d.id) ?? 0}</td>
                    <td className="num">{d.views || 0}</td>
                    <td className="muted">{fmtAgo(d.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
