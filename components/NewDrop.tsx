"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DropZone from "./DropZone";
import Segmented from "./Segmented";
import { api, Picked, uploadPicked } from "./upload-client";

type Tpl = { id: string; name: string; description: string; requiredKeys: string[]; hasExample: boolean };
type Opt = { value: string; label: string };

export default function NewDrop({ templates, lifespans, defaultLifespan, mode, initialTemplate }: { templates: Tpl[]; lifespans: Opt[]; defaultLifespan: string; mode: "cloud" | "local"; initialTemplate?: string }) {
  const router = useRouter();
  const [source, setSource] = useState<"files" | "template">(initialTemplate && templates.some((t) => t.id === initialTemplate) ? "template" : "files");
  const [picked, setPicked] = useState<Picked>([]);
  const [templateId, setTemplateId] = useState(initialTemplate && templates.some((t) => t.id === initialTemplate) ? initialTemplate : templates[0]?.id || "");
  const [jsonText, setJsonText] = useState("");
  const [jsonPicked, setJsonPicked] = useState<Picked>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [lifespan, setLifespan] = useState(defaultLifespan);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [visibility, setVisibility] = useState<"shared" | "own">("shared");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tpl = templates.find((t) => t.id === templateId);

  // Title from the first file's name.
  useEffect(() => {
    if (source !== "files" || !picked.length || title) return;
    const first = picked[0].path.split("/")[0];
    setTitle(first.replace(/\.(html?|zip)$/i, "").replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase()));
  }, [picked, source, title]);

  // Suggested link from the title, until the user edits it.
  useEffect(() => {
    if (slugEdited) return;
    const from = title || (source === "template" ? tpl?.name : "") || "";
    if (!from) return;
    const t = setTimeout(() => api<{ slug: string }>(`/api/slug?from=${encodeURIComponent(from)}`).then((r) => setSlug(r.slug)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [title, slugEdited, source, tpl?.name]);

  // A dropped JSON file fills the text box.
  useEffect(() => {
    if (!jsonPicked.length) return;
    jsonPicked[0].file.text().then((t) => {
      setJsonText(t);
      if (!title) setTitle(jsonPicked[0].path.replace(/\.json$/i, "").replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase()));
    });
  }, [jsonPicked, title]);

  async function checkSlug() {
    if (!slug) return;
    const r = await api<{ ok: boolean; error?: string }>(`/api/slug?check=${encodeURIComponent(slug)}`).catch(() => ({ ok: true }) as { ok: boolean; error?: string });
    setSlugError(r.ok ? null : r.error || "That link isn't available.");
  }

  async function loadExample() {
    if (!tpl) return;
    const r = await api<{ template: { example: unknown } }>(`/api/templates/${tpl.id}`);
    setJsonText(JSON.stringify(r.template.example, null, 2));
  }

  const ready =
    !!slug && !slugError && (!usePassword || password.length >= 4) && (source === "files" ? picked.length > 0 : !!tpl && jsonText.trim().length > 1);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const fields = { title, slug, lifespan, visibility, password: usePassword ? password : undefined };
      let body: Record<string, unknown>;
      if (source === "files") {
        setBusy("Uploading…");
        body = { ...fields, packageRef: await uploadPicked(picked, mode) };
      } else {
        let data: unknown;
        try {
          data = JSON.parse(jsonText);
        } catch (err) {
          throw new Error(`That JSON isn't valid: ${(err as Error).message}`);
        }
        body = { ...fields, templateId, data };
      }
      setBusy("Publishing…");
      const r = await api<{ drop: { id: string } }>("/api/drops", { method: "POST", json: body });
      router.push(`/drops/${r.drop.id}?published=1`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <form className="stack-lg" onSubmit={submit}>
      <Segmented
        label="What are you sharing?"
        value={source}
        onChange={setSource}
        options={[
          { value: "files", label: "Upload files" },
          { value: "template", label: `From a template${templates.length ? "" : " (none yet)"}` },
        ]}
      />

      {source === "files" ? (
        <DropZone picked={picked} onPick={setPicked} hint="A single page, a built site with its own CSS and JS, or a ZIP. Up to 50 MB." />
      ) : templates.length === 0 ? (
        <div className="card stack">
          <p className="h3">No templates yet.</p>
          <p className="muted">A template is a study page that reads its content from JSON, like the card sort. Anyone can add one.</p>
          <a className="btn btn-ghost" href="/templates/new" style={{ alignSelf: "flex-start" }}>Add a template</a>
        </div>
      ) : (
        <div className="stack-lg">
          <label className="field">
            <span>Template</span>
            <select id="template" className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {tpl?.description && <small>{tpl.description}</small>}
          </label>
          <DropZone picked={jsonPicked} onPick={setJsonPicked} title="Drop the JSON for this test" accept=".json,application/json" folders={false} />
          <label className="field">
            <span>JSON</span>
            <textarea id="json" className="input" value={jsonText} onChange={(e) => setJsonText(e.target.value)} placeholder={tpl?.requiredKeys.length ? `{ "${tpl.requiredKeys[0]}": … }` : "{ … }"} spellCheck={false} />
            <small>
              {tpl?.requiredKeys.length ? <>Needs: {tpl.requiredKeys.map((k) => <code key={k}>{k}</code>)} </> : null}
              {tpl?.hasExample && (
                <button type="button" className="btn btn-link small" onClick={loadExample}>Start from the example</button>
              )}
            </small>
          </label>
        </div>
      )}

      <hr className="divider" />

      <div className="grid-2">
        <label className="field">
          <span>Title</span>
          <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nav card sort, round 2" />
          <small>Shown to you on the dashboard and to visitors at the top of the page.</small>
        </label>
        <label className="field">
          <span>Link</span>
          <div className="prefix">
            <span>/</span>
            <input
              id="slug"
              className="input"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                setSlugEdited(true);
                setSlugError(null);
              }}
              onBlur={checkSlug}
              spellCheck={false}
            />
          </div>
          {slugError ? <small className="error">{slugError}</small> : <small>The random ending makes the link hard to guess. Keep it unless you need a tidy link.</small>}
        </label>
      </div>

      <div className="field">
        <span>Ends after</span>
        <Segmented label="Ends after" value={lifespan} onChange={setLifespan} options={lifespans} />
        <small>The link stops working and the files and responses are deleted. You can extend it before then.</small>
      </div>

      <div className="field">
        <span>Who sees saved responses inside the page</span>
        <Segmented
          label="Response visibility"
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: "shared", label: "Everyone with the link" },
            { value: "own", label: "Each visitor sees only their own" },
          ]}
        />
        <small>
          {visibility === "shared"
            ? "For moderated sessions, where the moderator's screen lists every session."
            : "For unmoderated tests sent to many people. The team still sees everything here."}
        </small>
      </div>

      <div className="field">
        <label className="row" style={{ gap: 8 }}>
          <input id="use-password" type="checkbox" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Ask for a password</span>
        </label>
        {usePassword && (
          <input id="password" className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 4 characters" autoComplete="off" />
        )}
        <small>Send the password separately from the link.</small>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button className="btn btn-primary" disabled={!ready || !!busy}>{busy || "Publish"}</button>
        <span className="muted small">Publishing makes the page visible to anyone with the link{usePassword ? " and the password" : ""}.</span>
      </div>
    </form>
  );
}
