"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Segmented from "./Segmented";
import { api } from "./upload-client";

type Opt = { value: string; label: string };

export default function DropActions({ dropId, title, hasPassword, visibility, lifespans, live, keepDays = 30, responses = 0 }: { dropId: string; title: string; hasPassword: boolean; visibility: "shared" | "own"; lifespans: Opt[]; live: boolean; keepDays?: number; responses?: number }) {
  const router = useRouter();
  const [name, setName] = useState(title);
  const [extend, setExtend] = useState(lifespans[0]?.value || "");
  const [pw, setPw] = useState("");
  const [vis, setVis] = useState(visibility);
  const [confirm, setConfirm] = useState<null | "end" | "delete">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await api(`/api/drops/${dropId}`, { method: "PATCH", json: body });
      setMsg(done);
      setPw("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/api/drops/${dropId}`, { method: "DELETE" });
      router.push("/dashboard");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!live) {
    return (
      <div className="row">
        {confirm === "delete" ? (
          <>
            <button className="btn btn-danger" onClick={remove} disabled={busy}>Remove it and its responses</button>
            <button className="btn btn-link" onClick={() => setConfirm(null)}>Keep it</button>
          </>
        ) : (
          <button className="btn btn-ghost" onClick={() => setConfirm("delete")}>Remove from the list</button>
        )}
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <div className="field">
        <span>Title</span>
        <div className="row">
          <input id="drop-title" className="input" style={{ flex: 1, minWidth: 0 }} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-ghost btn-sm" disabled={busy || !name.trim() || name === title} onClick={() => patch({ title: name }, "Title saved.")}>Save</button>
        </div>
      </div>

      <div className="field">
        <span>Change when it ends</span>
        <div className="row">
          <Segmented label="Ends after" value={extend} onChange={setExtend} options={lifespans} />
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => patch({ extend }, "End date changed.")}>Set</button>
        </div>
        <small>Counts from now. Pick a longer time to extend it.</small>
      </div>

      <div className="field">
        <span>Password</span>
        <div className="row">
          <input id="drop-password" className="input" style={{ flex: 1, minWidth: 0 }} value={pw} onChange={(e) => setPw(e.target.value)} placeholder={hasPassword ? "New password" : "Add a password"} autoComplete="off" />
          <button className="btn btn-ghost btn-sm" disabled={busy || pw.length < 4} onClick={() => patch({ password: pw }, hasPassword ? "Password changed. Visitors need the new one." : "Password added.")}>
            {hasPassword ? "Change" : "Add"}
          </button>
          {hasPassword && (
            <button className="btn btn-link small" disabled={busy} onClick={() => patch({ password: null }, "Password removed.")}>Remove</button>
          )}
        </div>
      </div>

      <div className="field">
        <span>Responses inside the page</span>
        <div className="row">
          <Segmented label="Response visibility" value={vis} onChange={setVis} options={[{ value: "shared", label: "Shared" }, { value: "own", label: "Own only" }]} />
          <button className="btn btn-ghost btn-sm" disabled={busy || vis === visibility} onClick={() => patch({ visibility: vis }, "Saved.")}>Save</button>
        </div>
      </div>

      <hr className="divider" />
      {confirm === "end" ? (
        <div className="stack">
          <p className="h3">End this drop now?</p>
          <p className="muted small">
            The link stops working and the files are deleted straight away. What should happen to the {responses === 1 ? "1 saved response" : `${responses} saved responses`}?
          </p>
          <div className="stack">
            <button className="btn btn-dark" disabled={busy} onClick={() => patch({ end: true }, "Ended. Responses are kept for " + keepDays + " days.")}>
              End and keep responses for {keepDays} days
            </button>
            <button className="btn btn-danger" disabled={busy} onClick={() => patch({ end: true, deleteResponses: true }, "Ended. All data deleted.")}>
              End and delete all data now
            </button>
            <button className="btn btn-link" onClick={() => setConfirm(null)}>Cancel, keep it live</button>
          </div>
        </div>
      ) : (
        <div className="stack">
          <button className="btn btn-danger" style={{ alignSelf: "flex-start" }} onClick={() => setConfirm("end")}>End this drop now…</button>
          <small className="muted">You&apos;ll choose whether to keep the responses for {keepDays} days or delete them.</small>
        </div>
      )}

      {msg && <p className="small" role="status">{msg}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
