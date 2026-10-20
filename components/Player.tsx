"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { wqa: 1; id: number; op: string; args?: Record<string, unknown> };

function visitorId() {
  try {
    let v = localStorage.getItem("wqa-visitor");
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem("wqa-visitor", v);
    }
    return v;
  } catch {
    // Storage blocked: one id for this page view.
    const w = window as unknown as { __wqaVisitor?: string };
    return (w.__wqaVisitor ||= crypto.randomUUID());
  }
}

function download(filename: string, data: string, mime: string) {
  const type = mime || (filename.endsWith(".json") ? "application/json" : filename.endsWith(".csv") ? "text/csv" : "text/plain");
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[\\/:*?"<>|]+/g, "-");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function Player({ slug, src, title, until }: { slug: string; src: string; title: string; until: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [bar, setBar] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  // The page only loads once the bridge below is listening, so its first save is never lost.
  const [listening, setListening] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(`wqa-bar-${slug}`) === "hidden") setBar(false);
    } catch {}
  }, [slug]);

  useEffect(() => {
    const visitor = visitorId();
    let toastTimer: ReturnType<typeof setTimeout> | undefined;
    const flash = (t: string) => {
      setToast(t);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => setToast(null), 4000);
    };

    async function onMessage(e: MessageEvent) {
      const win = frame.current?.contentWindow;
      if (!win || e.source !== win) return;
      const m = e.data as Msg;
      if (!m || m.wqa !== 1 || typeof m.op !== "string") return;
      if (m.op === "download") {
        const a = m.args || {};
        download(String(a.filename || "download.txt"), String(a.data ?? ""), String(a.mime || ""));
        return;
      }
      let reply: { result?: unknown; error?: string };
      try {
        const res = await fetch(`/api/d/${slug}/db`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-visitor": visitor },
          body: JSON.stringify({ op: m.op, args: m.args }),
        });
        const body = await res.json().catch(() => ({}));
        reply = res.ok ? { result: body.result } : { error: body.error || "Couldn't save" };
        if (!res.ok && m.op !== "list" && m.op !== "get") flash(reply.error!);
        if (res.status === 401 || res.status === 410) flash(body.error);
      } catch {
        reply = { error: "You're offline. Your last change wasn't saved." };
        flash(reply.error!);
      }
      win.postMessage({ wqaReply: 1, id: m.id, ...reply }, "*");
    }
    window.addEventListener("message", onMessage);
    setListening(true);
    return () => window.removeEventListener("message", onMessage);
  }, [slug]);

  const hideBar = () => {
    setBar(false);
    try {
      sessionStorage.setItem(`wqa-bar-${slug}`, "hidden");
    } catch {}
  };

  return (
    <div className="player">
      {bar && (
        <div className="player-bar">
          <b>WQA</b>
          <span className="t">{title}</span>
          <span>Open until {until}</span>
          <button onClick={hideBar} aria-label="Hide this bar">✕</button>
        </div>
      )}
      <iframe
        ref={frame}
        src={listening ? src : undefined}
        title={title}
        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
        allow="clipboard-write"
      />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
