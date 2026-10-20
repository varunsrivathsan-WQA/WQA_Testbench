import { DEFAULT_LIFESPAN, LIFESPANS, storageMode } from "@/lib/config";
import { listTemplates } from "@/lib/model";
import NewDrop from "@/components/NewDrop";

export const dynamic = "force-dynamic";
export const metadata = { title: "New drop" };

export default async function NewPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const sp = await searchParams;
  const templates = (await listTemplates()).map((t) => ({ id: t.id, name: t.name, description: t.description, requiredKeys: t.requiredKeys, hasExample: t.example !== undefined }));
  return (
    <main className="wrap narrow page">
      <div className="stack">
        <p className="eyebrow">New drop</p>
        <h1 className="h1">Share something.</h1>
        <p className="sub">Drop a file or start from a template. You get a link that works without an account and ends on its own.</p>
      </div>
      <NewDrop
        templates={templates}
        lifespans={LIFESPANS.map((l) => ({ value: l.key, label: l.label }))}
        defaultLifespan={DEFAULT_LIFESPAN}
        mode={storageMode}
        initialTemplate={sp.template}
      />
    </main>
  );
}
