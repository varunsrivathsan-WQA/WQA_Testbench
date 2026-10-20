"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./upload-client";

/** Deletes a drop's responses now, e.g. when a client asks for their data to be removed. */
export default function DeleteResponses({ dropId, count }: { dropId: string; count: number }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/drops/${dropId}`, { method: "PATCH", json: { deleteResponses: true } });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="row">
      {confirm ? (
        <>
          <button className="btn btn-danger btn-sm" onClick={run} disabled={busy}>
            Delete {count} response{count === 1 ? "" : "s"} permanently
          </button>
          <button className="btn btn-link small" onClick={() => setConfirm(false)}>Keep them</button>
        </>
      ) : (
        <button className="btn btn-link small" onClick={() => setConfirm(true)}>Delete responses now…</button>
      )}
      {error && <span className="error small">{error}</span>}
    </div>
  );
}
