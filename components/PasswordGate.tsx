"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PasswordGate({ slug }: { slug: string }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/d/${slug}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) return router.refresh();
    const body = await res.json().catch(() => ({}));
    setError(body.error || "That didn't work. Try again.");
    setBusy(false);
  }

  return (
    <main className="center-page">
      <div className="center-card">
        <p className="eyebrow">WQA</p>
        <h1 className="h2">Enter the password</h1>
        <p className="muted">The person who sent you this link will have given you a password with it.</p>
        <form onSubmit={submit}>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            aria-label="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
            required
          />
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn-primary" disabled={busy || !pw}>{busy ? "Checking…" : "Open"}</button>
        </form>
      </div>
    </main>
  );
}
