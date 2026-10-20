import { checkAssetToken } from "@/lib/crypto";
import { getDropBySlug, isLive, readFile } from "@/lib/model";
import { isHtml } from "@/lib/package";
import { injectShim } from "@/lib/shim";

export const dynamic = "force-dynamic";

// Served pages run with an opaque origin: they can't read this site's cookies,
// storage or APIs, even if someone opens the file URL directly.
const SANDBOX = "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads";

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; token: string; path: string[] }> }) {
  const { slug, token, path } = await ctx.params;
  const drop = await getDropBySlug(slug);
  if (!drop || !isLive(drop)) return new Response("This link has ended.", { status: 410 });
  if (!checkAssetToken(token, slug, drop.version)) return new Response("This page needs reloading.", { status: 403 });

  const wanted = decodeURIComponent(path.join("/")) || drop.entry;
  let file = drop.files.find((f) => f.path === wanted);
  if (!file && !/\.[a-z0-9]+$/i.test(wanted)) file = drop.files.find((f) => f.path === `${wanted.replace(/\/$/, "")}/index.html`);
  if (!file) return notFound();

  const bytes = await readFile(file);
  if (!bytes) return notFound();

  const headers: Record<string, string> = {
    "Content-Type": file.type,
    "Content-Security-Policy": SANDBOX,
    "Access-Control-Allow-Origin": "*",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": isHtml(file.path) ? "no-store" : "private, max-age=3600",
  };
  if (isHtml(file.path)) {
    const html = injectShim(new TextDecoder().decode(bytes), drop.kind === "template" ? drop.data : null);
    return new Response(html, { headers });
  }
  return new Response(Buffer.from(bytes), { headers });
}
