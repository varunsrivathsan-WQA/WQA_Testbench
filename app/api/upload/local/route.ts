import { currentUser } from "@/lib/auth";
import { UserError } from "@/lib/config";
import { json, route } from "@/lib/http";
import { saveLocalPackage } from "@/lib/upload";

/** Used instead of Vercel Blob when running locally without cloud storage. */
export const PUT = route(async (req: Request) => {
  if (!(await currentUser())) throw new UserError("Sign in to upload.", 401);
  const data = new Uint8Array(await req.arrayBuffer());
  return json({ ref: saveLocalPackage(data) });
});
