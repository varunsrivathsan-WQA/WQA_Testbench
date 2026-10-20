import { UserError } from "./config";
import type { ContentInput } from "./service";
import { takePackage } from "./upload";
import type { Visibility } from "./model";

export type DropFields = {
  title?: string;
  slug?: string;
  lifespan?: string;
  password?: string;
  visibility?: Visibility;
};

type Body = DropFields & {
  packageRef?: string;
  templateId?: string;
  data?: unknown;
  // Agent API only (bodies up to 4 MB):
  html?: string;
  zip?: string;
  files?: { path: string; content: string; encoding?: "utf8" | "base64" }[];
};

export function pickFields(b: Body): DropFields {
  return {
    title: typeof b.title === "string" ? b.title : undefined,
    slug: typeof b.slug === "string" ? b.slug : undefined,
    lifespan: typeof b.lifespan === "string" ? b.lifespan : undefined,
    password: typeof b.password === "string" && b.password ? b.password : undefined,
    visibility: b.visibility === "own" ? "own" : b.visibility === "shared" ? "shared" : undefined,
  };
}

/** Works out what content a request is publishing. Exactly one source must be given. */
export async function contentFrom(b: Body): Promise<ContentInput> {
  const sources = [b.packageRef, b.templateId, b.html, b.zip, b.files].filter((x) => x !== undefined && x !== null && x !== "");
  if (sources.length !== 1) throw new UserError("Send one of: packageRef, templateId with data, html, zip (base64) or files.");
  if (b.packageRef) return { type: "zip", zip: await takePackage(b.packageRef) };
  if (b.templateId) {
    let data = b.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (e) {
        throw new UserError(`That JSON isn't valid: ${(e as Error).message}`);
      }
    }
    return { type: "template", templateId: b.templateId, data };
  }
  if (typeof b.html === "string") return { type: "files", files: [{ path: "index.html", data: new TextEncoder().encode(b.html) }] };
  if (typeof b.zip === "string") return { type: "zip", zip: new Uint8Array(Buffer.from(b.zip, "base64")) };
  if (Array.isArray(b.files)) {
    return {
      type: "files",
      files: b.files.map((f) => {
        if (!f || typeof f.path !== "string" || typeof f.content !== "string") throw new UserError("Each file needs a path and content.");
        return { path: f.path, data: f.encoding === "base64" ? new Uint8Array(Buffer.from(f.content, "base64")) : new TextEncoder().encode(f.content) };
      }),
    };
  }
  throw new UserError("No content in the request.");
}
