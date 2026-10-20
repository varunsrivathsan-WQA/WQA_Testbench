import { UserError } from "./config";
import { randomId } from "./crypto";
import { deleteFiles, getTemplate, Person, saveTemplate, storeFiles, Template } from "./model";
import { normalise } from "./package";
import { takePackage } from "./upload";

export type TemplateInput = {
  name?: string;
  description?: string;
  editors?: string[] | string;
  requiredKeys?: string[] | string;
  example?: unknown;
  packageRef?: string;
};

function list(v: string[] | string | undefined) {
  const arr = Array.isArray(v) ? v : (v || "").split(/[\s,]+/);
  return arr.map((s) => String(s).trim()).filter(Boolean);
}

function parseExample(v: unknown) {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch (e) {
    throw new UserError(`The example JSON isn't valid: ${(e as Error).message}`);
  }
}

export async function createTemplate(user: Person, input: TemplateInput) {
  const name = (input.name || "").trim().slice(0, 80);
  if (!name) throw new UserError("Give the template a name.");
  if (!input.packageRef) throw new UserError("Add the template's HTML file, folder or ZIP.");
  const id = randomId(10);
  const pkg = normalise({ zip: await takePackage(input.packageRef) });
  const files = await storeFiles(`templates/${id}/v1`, pkg.files);
  const now = Date.now();
  const t: Template = {
    id, name,
    description: (input.description || "").trim().slice(0, 600),
    owner: user,
    editors: list(input.editors).map((e) => e.toLowerCase()),
    files, entry: pkg.entry, version: 1,
    requiredKeys: list(input.requiredKeys),
    example: parseExample(input.example),
    createdAt: now, updatedAt: now,
  };
  await saveTemplate(t);
  return t;
}

export async function updateTemplate(t: Template, user: Person, input: TemplateInput) {
  const next: Template = { ...t, updatedAt: Date.now(), updatedBy: user };
  if (input.name !== undefined) next.name = input.name.trim().slice(0, 80) || t.name;
  if (input.description !== undefined) next.description = input.description.trim().slice(0, 600);
  if (input.editors !== undefined) next.editors = list(input.editors).map((e) => e.toLowerCase());
  if (input.requiredKeys !== undefined) next.requiredKeys = list(input.requiredKeys);
  if (input.example !== undefined) next.example = parseExample(input.example);
  if (input.packageRef) {
    const pkg = normalise({ zip: await takePackage(input.packageRef) });
    next.version = t.version + 1;
    next.files = await storeFiles(`templates/${t.id}/v${next.version}`, pkg.files);
    next.entry = pkg.entry;
    // Live drops keep their own copies, so the old files can go.
    await deleteFiles(t.files);
  }
  await saveTemplate(next);
  return next;
}

export async function findTemplate(id: string) {
  const t = await getTemplate(id);
  if (!t) throw new UserError("That template doesn't exist.", 404);
  return t;
}
