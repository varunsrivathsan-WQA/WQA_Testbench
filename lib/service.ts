import { DEFAULT_LIFESPAN, lifespanMs, UserError } from "./config";
import { hashPassword, randomId } from "./crypto";
import {
  checkSlugFormat, checkTemplateData, copyFiles, deleteFiles, Drop, getTemplate, insertDrop, isLive,
  Person, saveDrop, slugTaken, storeFiles, suggestSlug, Visibility,
} from "./model";
import { normalise, RawFile } from "./package";

export type ContentInput =
  | { type: "zip"; zip: Uint8Array }
  | { type: "files"; files: RawFile[] }
  | { type: "template"; templateId: string; data: unknown };

export type CreateInput = {
  user: Person;
  title?: string;
  slug?: string;
  lifespan?: string;
  password?: string;
  visibility?: Visibility;
  content: ContentInput;
};

function cleanTitle(t: string | undefined, fallback: string) {
  const s = (t || "").trim().slice(0, 120);
  return s || fallback;
}

async function buildContent(dropId: string, version: number, content: ContentInput) {
  const prefix = `drops/${dropId}/v${version}`;
  if (content.type === "template") {
    const t = await getTemplate(content.templateId);
    if (!t) throw new UserError("That template no longer exists.", 404);
    checkTemplateData(t, content.data);
    // Each drop gets its own copy, so later template edits never change a live test.
    const files = await copyFiles(prefix, t.files);
    return { files, entry: t.entry, kind: "template" as const, templateId: t.id, templateName: t.name, data: content.data };
  }
  const n = normalise(content.type === "zip" ? { zip: content.zip } : { files: content.files });
  const files = await storeFiles(prefix, n.files);
  return { files, entry: n.entry, kind: "files" as const, templateId: undefined, templateName: undefined, data: undefined };
}

export async function createDrop(input: CreateInput) {
  const id = randomId(12);
  const fallbackName =
    input.content.type === "template" ? "Test" : input.content.type === "files" ? input.content.files[0]?.path || "Drop" : "Drop";
  const title = cleanTitle(input.title, fallbackName.replace(/\.(html?|zip)$/i, ""));
  let slug = (input.slug || "").trim().toLowerCase();
  if (slug) {
    checkSlugFormat(slug);
    if (await slugTaken(slug)) throw new UserError(`The link /${slug} is already in use.`);
  } else slug = await suggestSlug(title);

  const ms = lifespanMs(input.lifespan || DEFAULT_LIFESPAN);
  const built = await buildContent(id, 1, input.content);
  const now = Date.now();
  const drop: Drop = {
    id, slug, title,
    owner: input.user,
    createdAt: now, updatedAt: now, expiresAt: now + ms,
    status: "live", version: 1,
    ...built,
    passwordHash: input.password ? hashPassword(input.password) : undefined,
    passwordVersion: 1,
    visibility: input.visibility === "own" ? "own" : "shared",
    views: 0,
  };
  try {
    await insertDrop(drop);
  } catch (e) {
    await deleteFiles(built.files);
    throw e;
  }
  return drop;
}

/** Replace a live drop's content. Same link, new version. Responses are kept. */
export async function updateDropContent(drop: Drop, user: Person, content: ContentInput) {
  if (!isLive(drop)) throw new UserError("This drop has ended. Publish a new one instead.", 409);
  if (drop.kind === "template" && content.type === "template" && !content.templateId) content.templateId = drop.templateId!;
  const version = drop.version + 1;
  let built;
  if (drop.kind === "template" && content.type === "template" && content.templateId === drop.templateId) {
    // Same template, new JSON: keep the copied files, swap the data.
    const t = await getTemplate(drop.templateId!);
    if (t) checkTemplateData(t, content.data);
    built = { files: drop.files, entry: drop.entry, kind: drop.kind, templateId: drop.templateId, templateName: drop.templateName, data: content.data };
  } else {
    built = await buildContent(drop.id, version, content);
    await deleteFiles(drop.files);
  }
  const next: Drop = { ...drop, ...built, version, updatedAt: Date.now(), updatedBy: user };
  await saveDrop(next);
  return next;
}

export type SettingsInput = {
  title?: string;
  extend?: string;
  password?: string | null;
  visibility?: Visibility;
};

export async function updateDropSettings(drop: Drop, user: Person, s: SettingsInput) {
  if (!isLive(drop)) throw new UserError("This drop has ended.", 409);
  const next: Drop = { ...drop, updatedAt: Date.now(), updatedBy: user };
  if (s.title !== undefined) next.title = cleanTitle(s.title, drop.title);
  if (s.extend) next.expiresAt = Date.now() + lifespanMs(s.extend);
  if (s.password !== undefined) {
    next.passwordHash = s.password ? hashPassword(s.password) : undefined;
    next.passwordVersion = drop.passwordVersion + 1; // signs everyone out of the old password
  }
  if (s.visibility) next.visibility = s.visibility === "own" ? "own" : "shared";
  await saveDrop(next);
  return next;
}
