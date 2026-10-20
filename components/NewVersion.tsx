"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DropZone from "./DropZone";
import { api, Picked, uploadPicked } from "./upload-client";

export default function NewVersion({ dropId, kind, mode, data }: { dropId: string; kind: "files" | "template"; mode: "cloud" | "local"; data?: string }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked>([]);
  const [json, setJson] = useState(data || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      let body: Record<string, unknown>;
      if (kind === "template") {
        try {
          body = { data: JSON.parse(json) };
        } catch (e) {
          throw new Error(`That JSON isn't valid: ${(e as Error).message}`);
        }
      } else {
        body = { packageRef: await uploadPicked(picked, mode) };
      }
      await api(`/api/drops/${dropId}/content`, { method: "POST", json: body });
      setPicked([]);
      setMsg("New version is live. Visitors get it next time they load the page.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {kind === "template" ? (
        <label className="field">
          <span>JSON</span>
          <textarea id="version-json" className="input" value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
        </label>
      ) : (
        <DropZone picked={picked} onPick={setPicked} title="Drop the updated files" />
      )}
      <div className="row">
        <button className="btn btn-dark" disabled={busy || (kind === "files" ? !picked.length : json === data || !json.trim())} onClick={publish}>
          {busy ? "Publishing…" : "Publish new version"}
        </button>
      </div>
      {msg && <p className="small" role="status">{msg}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
