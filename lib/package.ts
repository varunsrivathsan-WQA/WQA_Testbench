import { unzipSync } from "fflate";
import { LIMITS, UserError } from "./config";

export type RawFile = { path: string; data: Uint8Array };

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8", txt: "text/plain; charset=utf-8", md: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8", xml: "application/xml", svg: "image/svg+xml",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", ico: "image/x-icon",
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
  mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav",
  pdf: "application/pdf", wasm: "application/wasm",
};

export function mimeFor(p: string) {
  const ext = p.split(".").pop()?.toLowerCase() || "";
  return MIME[ext] || "application/octet-stream";
}

export function isHtml(p: string) {
  return /\.html?$/i.test(p);
}

/** Clean a path from an upload: forward slashes, no leading slash, no "..". */
export function cleanPath(p: string) {
  const parts = p.replace(/\\/g, "/").split("/").filter((s) => s && s !== ".");
  if (parts.some((s) => s === "..")) throw new UserError(`File path "${p}" isn't allowed.`);
  return parts.join("/");
}

const JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|\.git)(\/|$)/;

/**
 * Turns an upload into a list of files plus the entry page.
 * Accepts a ZIP, or loose files (a single HTML file or a folder's contents).
 */
export function normalise(input: { zip?: Uint8Array; files?: RawFile[] }): { files: RawFile[]; entry: string } {
  let list: RawFile[] = [];
  if (input.zip) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(input.zip);
    } catch {
      throw new UserError("That ZIP couldn't be opened. Re-export it and try again.");
    }
    list = Object.entries(entries)
      .filter(([p]) => !p.endsWith("/"))
      .map(([p, data]) => ({ path: p, data }));
  } else {
    list = input.files || [];
  }
  list = list.filter((f) => !JUNK.test(f.path)).map((f) => ({ path: cleanPath(f.path), data: f.data }));
  list = list.filter((f) => f.path);

  // A ZIP of a folder puts everything under one top folder. Drop it.
  const tops = new Set(list.map((f) => f.path.split("/")[0]));
  if (tops.size === 1 && list.every((f) => f.path.includes("/"))) {
    list = list.map((f) => ({ ...f, path: f.path.split("/").slice(1).join("/") }));
  }

  if (!list.length) throw new UserError("There are no files in that upload.");
  if (list.length > LIMITS.files) throw new UserError(`That's ${list.length} files. The limit is ${LIMITS.files}.`);
  const total = list.reduce((n, f) => n + f.data.byteLength, 0);
  if (total > LIMITS.packageBytes) throw new UserError(`That's ${(total / 1048576).toFixed(1)} MB. The limit is ${LIMITS.packageBytes / 1048576} MB.`);

  const htmls = list.filter((f) => isHtml(f.path));
  let entry = list.find((f) => f.path.toLowerCase() === "index.html")?.path;
  if (!entry && htmls.length === 1) entry = htmls[0].path;
  if (!entry) {
    throw new UserError(
      htmls.length ? "There's more than one HTML file and no index.html. Rename the start page to index.html." : "Add an HTML file. The upload needs a page to open."
    );
  }
  return { files: list, entry };
}
