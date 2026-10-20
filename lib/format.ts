const TZ = "Europe/London";

export function fmtDate(ts: number) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(ts);
}

export function fmtDay(ts: number) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(ts);
}

/** "in 3d 4h", "in 5h", "in 12m", "ended". */
export function fmtLeft(expiresAt: number, now = Date.now()) {
  const ms = expiresAt - now;
  if (ms <= 0) return "ended";
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d >= 1) return `in ${d}d${h ? ` ${h}h` : ""}`;
  if (h >= 1) return `in ${h}h ${m % 60}m`;
  return `in ${Math.max(1, m)}m`;
}

export function fmtAgo(ts: number, now = Date.now()) {
  const m = Math.floor((now - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
