"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";
import { api } from "./upload-client";

type T = { id: string; label: string; createdAt: number; lastUsedAt?: number };

const day = (ts: number) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(ts);

export default function Tokens({ initial }: { initial: T[] }) {
  const [tokens, setTokens] = useState(initial);
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await api<{ token: T; secret: string }>("/api/tokens", { method: "POST", json: { label } });
      setTokens([r.token, ...tokens]);
      setSecret(r.secret);
      setLabel("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function revoke(id: string) {
    try {
      await api(`/api/tokens?id=${id}`, { method: "DELETE" });
      setTokens(tokens.filter((t) => t.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="card stack-lg">
      <h2 className="h3">Your tokens</h2>
      <form className="row" onSubmit={create}>
        <input id="token-label" className="input" style={{ flex: 1, minWidth: 0 }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What it's for, e.g. Claude on my laptop" />
        <button className="btn btn-primary btn-sm">Create token</button>
      </form>
      {secret && (
        <div className="notice stack">
          <b>Copy this token now. It won&apos;t be shown again.</b>
          <code style={{ wordBreak: "break-all" }}>{secret}</code>
          <CopyButton text={secret} label="Copy token" className="btn btn-ghost btn-sm" />
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {tokens.length === 0 ? (
        <p className="muted">No tokens yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Label</th><th>Created</th><th>Last used</th><th /></tr></thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id}>
                  <td>{t.label}</td>
                  <td className="muted">{day(t.createdAt)}</td>
                  <td className="muted">{t.lastUsedAt ? day(t.lastUsedAt) : "Never"}</td>
                  <td style={{ textAlign: "right" }}><button className="btn btn-link small" onClick={() => revoke(t.id)}>Revoke</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
