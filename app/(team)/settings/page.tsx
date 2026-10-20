import { headers } from "next/headers";
import { currentUser, listApiTokens } from "@/lib/auth";
import { LIFESPANS } from "@/lib/config";
import Tokens from "@/components/Tokens";

export const dynamic = "force-dynamic";
export const metadata = { title: "API" };

export default async function Settings() {
  const me = (await currentUser())!;
  const tokens = await listApiTokens(me.email);
  const h = await headers();
  const origin = process.env.NEXTAUTH_URL?.replace(/\/$/, "") || `${h.get("x-forwarded-proto") || "http"}://${h.get("host")}`;
  const ls = LIFESPANS.map((l) => `"${l.key}"`).join(" | ");
  return (
    <main className="wrap narrow page">
      <div className="stack">
        <p className="eyebrow">API</p>
        <h1 className="h1">Publish from scripts and agents.</h1>
        <p className="sub">Create a token, then give it to Claude or a script. It publishes as you. Requests are capped at 4 MB; use the dashboard for bigger uploads.</p>
      </div>
      <Tokens initial={tokens.map((t) => ({ id: t.id, label: t.label, createdAt: t.createdAt, lastUsedAt: t.lastUsedAt }))} />
      <section className="stack">
        <h2 className="h2">Examples</h2>
        <p className="muted">Publish one HTML file for a week, with a password:</p>
        <div className="terminal">{`curl -X POST ${origin}/api/v1/drops \\
  -H "Authorization: Bearer $WQA_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Nav readout","lifespan":"7d","password":"blue-heron",
       "html":"<!doctype html><h1>Hello</h1>"}'`}</div>
        <p className="muted">Start a test from a template with new JSON:</p>
        <div className="terminal">{`curl -X POST ${origin}/api/v1/drops \\
  -H "Authorization: Bearer $WQA_TOKEN" -H "Content-Type: application/json" \\
  -d '{"title":"Card sort round 2","templateId":"<id>","data":{"sorts":[...]}}'`}</div>
        <p className="muted">Push a fix to the same link (also accepts <code>zip</code> as base64, or <code>files</code>):</p>
        <div className="terminal">{`curl -X PUT ${origin}/api/v1/drops/<slug> \\
  -H "Authorization: Bearer $WQA_TOKEN" -H "Content-Type: application/json" \\
  -d '{"html":"<!doctype html><h1>Fixed</h1>"}'`}</div>
        <p className="muted">Other calls:</p>
        <div className="terminal">{`GET    /api/v1/drops                  list drops
GET    /api/v1/drops/<slug>           one drop
PATCH  /api/v1/drops/<slug>           {"extend":"7d"} {"password":null} {"end":true}
DELETE /api/v1/drops/<slug>           end and remove
GET    /api/drops/<id>/responses?format=csv
GET    /api/templates                 list templates

Fields for POST: title, slug, lifespan (${ls}), password,
visibility ("shared" | "own"), and one of: html, zip, files, templateId + data`}</div>
      </section>
    </main>
  );
}
