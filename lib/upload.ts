import fs from "node:fs";
import path from "node:path";
import { LIMITS, storageMode, UserError } from "./config";
import { files } from "./store/files";
import { randomId } from "./crypto";

const localDir = () => path.join(process.cwd(), ".data", "uploads");

/** Local mode only: keep an uploaded ZIP until the drop is created. */
export function saveLocalPackage(data: Uint8Array) {
  if (storageMode !== "local") throw new UserError("Local uploads are off on this site.", 404);
  if (data.byteLength > LIMITS.packageBytes) throw new UserError("That upload is too large.", 413);
  fs.mkdirSync(localDir(), { recursive: true });
  const name = `${Date.now()}-${randomId(10)}.zip`;
  fs.writeFileSync(path.join(localDir(), name), data);
  return `upload:${name}`;
}

/** Reads an uploaded ZIP by the reference the browser got back, then deletes it. */
export async function takePackage(ref: string): Promise<Uint8Array> {
  if (ref.startsWith("upload:")) {
    const name = ref.slice(7);
    if (!/^[\w.-]+\.zip$/.test(name)) throw new UserError("Bad upload reference.");
    const p = path.join(localDir(), name);
    try {
      const data = new Uint8Array(fs.readFileSync(p));
      fs.unlinkSync(p);
      return data;
    } catch {
      throw new UserError("That upload has gone. Drop the files again.", 410);
    }
  }
  if (!/\/packages\//.test(ref)) throw new UserError("Bad upload reference.");
  const data = await files.get(ref);
  if (!data) throw new UserError("That upload has gone. Drop the files again.", 410);
  await files.del([ref]);
  return data;
}
