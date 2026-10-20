import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { assetToken } from "@/lib/crypto";
import { fmtDay } from "@/lib/format";
import { endDrop, getDropBySlug, isLive, saveDrop } from "@/lib/model";
import { isUnlocked } from "@/lib/visitor";
import { RESERVED_SLUGS } from "@/lib/config";
import Player from "@/components/Player";
import PasswordGate from "@/components/PasswordGate";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const drop = await getDropBySlug((await params).slug);
  // Don't leak titles of password-protected or ended drops in link previews.
  const title = drop && isLive(drop) && !drop.passwordHash ? drop.title : "WQA";
  return { title: { absolute: title }, robots: { index: false, follow: false } };
}

function Ended() {
  return (
    <main className="center-page">
      <div className="center-card">
        <p className="eyebrow">WQA</p>
        <h1 className="h1">This link has ended.</h1>
        <p className="sub">The page was shared for a set time and has now been removed. If you still need it, ask the person who sent you the link.</p>
      </div>
    </main>
  );
}

export default async function DropPage({ params }: Props) {
  const { slug } = await params;
  if (RESERVED_SLUGS.has(slug)) notFound();
  let drop = await getDropBySlug(slug);
  if (!drop) notFound();
  if (!isLive(drop)) {
    if (drop.status === "live") await endDrop(drop);
    return <Ended />;
  }
  if (!(await isUnlocked(drop))) return <PasswordGate slug={slug} />;

  drop = { ...drop, views: (drop.views || 0) + 1 };
  await saveDrop(drop);

  const src = `/x/${slug}/${assetToken(slug, drop.version)}/${drop.entry.split("/").map(encodeURIComponent).join("/")}`;
  return <Player slug={slug} src={src} title={drop.title} until={fmtDay(drop.expiresAt)} />;
}
