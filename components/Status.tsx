import { fmtLeft } from "@/lib/format";

export default function Status({ status, expiresAt }: { status: "live" | "ended"; expiresAt: number }) {
  if (status === "ended" || expiresAt <= Date.now()) {
    return (
      <span className="chip">
        <span className="dot ended" /> Ended
      </span>
    );
  }
  const soon = expiresAt - Date.now() < 86_400_000;
  return (
    <span className="chip">
      <span className="dot live" /> <span className={soon ? "status-soon" : undefined}>Ends {fmtLeft(expiresAt)}</span>
    </span>
  );
}
