import { purgeAt, type Drop, type Template } from "./model";

/** What the browser and the API get back about a drop. Never includes the password hash or file refs. */
export function publicDrop(d: Drop, origin: string) {
  return {
    id: d.id,
    slug: d.slug,
    url: `${origin}/${d.slug}`,
    title: d.title,
    status: d.status === "live" && d.expiresAt > Date.now() ? "live" : "ended",
    kind: d.kind,
    template: d.templateId ? { id: d.templateId, name: d.templateName } : null,
    owner: d.owner,
    createdAt: new Date(d.createdAt).toISOString(),
    updatedAt: new Date(d.updatedAt).toISOString(),
    expiresAt: new Date(d.expiresAt).toISOString(),
    endedAt: d.endedAt ? new Date(d.endedAt).toISOString() : null,
    responsesDeleteOn: d.status === "ended" && !d.responsesDeletedAt ? new Date(purgeAt(d)).toISOString() : null,
    version: d.version,
    passwordProtected: !!d.passwordHash,
    visibility: d.visibility,
    views: d.views,
    files: d.files.map((f) => ({ path: f.path, size: f.size })),
    entry: d.entry,
  };
}

export function publicTemplate(t: Template) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    owner: t.owner,
    editors: t.editors,
    requiredKeys: t.requiredKeys,
    version: t.version,
    files: t.files.map((f) => ({ path: f.path, size: f.size })),
    example: t.example ?? null,
    updatedAt: new Date(t.updatedAt).toISOString(),
  };
}

export function originOf(req: Request) {
  const env = process.env.NEXTAUTH_URL;
  if (env) return env.replace(/\/$/, "");
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}
