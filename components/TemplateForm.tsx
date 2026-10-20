"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DropZone from "./DropZone";
import EmailTags from "./EmailTags";
import { api, Picked, uploadPicked } from "./upload-client";

type Existing = { id: string; name: string; description: string; editors: string[]; requiredKeys: string; example: string };

export default function TemplateForm({ mode, existing, domains }: { mode: "cloud" | "local"; existing?: Existing; domains: string[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked>([]);
  const [name, setName] = useState(existing?.name || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [requiredKeys, setRequiredKeys] = useState(existing?.requiredKeys || "");
  const [editors, setEditors] = useState<string[]>(existing?.editors || []);
  const [example, setExample] = useState(existing?.example || "");
  const [examplePicked, setExamplePicked] = useState<Picked>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onExample(p: Picked) {
    setExamplePicked(p);
    if (p[0]) setExample(await p[0].file.text());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      if (example.trim()) {
        try {
          JSON.parse(example);
        } catch (err) {
          throw new Error(`The example JSON isn't valid: ${(err as Error).message}`);
        }
      }
      const body: Record<string, unknown> = { name, description, requiredKeys, editors, example };
      if (picked.length) body.packageRef = await uploadPicked(picked, mode);
      if (existing) {
        await api(`/api/templates/${existing.id}`, { method: "PATCH", json: body });
        setPicked([]);
        setMsg("Saved.");
        router.refresh();
      } else {
        const r = await api<{ template: { id: string } }>("/api/templates", { method: "POST", json: body });
        router.push(`/templates/${r.template.id}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    setBusy(true);
    try {
      await api(`/api/templates/${existing.id}`, { method: "DELETE" });
      router.push("/templates");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="stack-lg" onSubmit={submit}>
      <DropZone picked={picked} onPick={setPicked} title={existing ? "Drop new files to replace the template" : "Drop the template page"} hint="An HTML file, a folder or a ZIP" />
      <div className="grid-2">
        <label className="field">
          <span>Name</span>
          <input id="tpl-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Card Testing" required />
        </label>
        <label className="field">
          <span>JSON keys it needs</span>
          <input id="tpl-keys" className="input" value={requiredKeys} onChange={(e) => setRequiredKeys(e.target.value)} placeholder="sorts" />
          <small>Comma separated. Publishing is blocked if any are missing.</small>
        </label>
      </div>
      <label className="field">
        <span>Description</span>
        <input id="tpl-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Open, closed or hybrid card sort, run by a moderator." />
      </label>
      <div className="field">
        <label htmlFor="tpl-editors" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>Editors</label>
        <EmailTags id="tpl-editors" value={editors} onChange={setEditors} domains={domains} placeholder={`name@${domains[0]}, then press Enter`} />
        <small>People besides you who can change or delete this template. Everyone at WQA can use it.</small>
      </div>
      <div className="field">
        <span>Example JSON</span>
        <DropZone picked={examplePicked} onPick={onExample} title="Drop an example JSON file" accept=".json,application/json" folders={false} />
        <textarea id="tpl-example" className="input" value={example} onChange={(e) => setExample(e.target.value)} placeholder='{ "sorts": [ … ] }' spellCheck={false} />
        <small>People start from this when they use the template.</small>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {msg && <p className="small" role="status">{msg}</p>}
      <div className="row between">
        <button className="btn btn-primary" disabled={busy || !name.trim() || (!existing && !picked.length)}>{busy ? "Saving…" : existing ? "Save changes" : "Add template"}</button>
        {existing &&
          (confirmDelete ? (
            <div className="row">
              <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>Delete the template</button>
              <button type="button" className="btn btn-link" onClick={() => setConfirmDelete(false)}>Keep it</button>
            </div>
          ) : (
            <button type="button" className="btn btn-link" onClick={() => setConfirmDelete(true)}>Delete…</button>
          ))}
      </div>
    </form>
  );
}
