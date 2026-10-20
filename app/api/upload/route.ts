import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { currentUser } from "@/lib/auth";
import { LIMITS, UserError } from "@/lib/config";
import { json, route } from "@/lib/http";

/** Issues short-lived tokens so the browser can upload ZIPs straight to Vercel Blob (no 4.5 MB limit). */
export const POST = route(async (req: Request) => {
  const body = (await req.json()) as HandleUploadBody;
  const result = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async (pathname) => {
      if (!(await currentUser())) throw new UserError("Sign in to upload.", 401);
      if (!pathname.startsWith("packages/")) throw new UserError("Bad upload path.");
      return { allowedContentTypes: ["application/zip"], maximumSizeInBytes: LIMITS.packageBytes, addRandomSuffix: true };
    },
    onUploadCompleted: async () => {},
  });
  return json(result);
});
