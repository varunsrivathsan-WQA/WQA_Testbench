import { ALLOWED_DOMAINS, storageMode } from "@/lib/config";
import TemplateForm from "@/components/TemplateForm";

export const metadata = { title: "Add a template" };

export default function NewTemplate() {
  return (
    <main className="wrap narrow page">
      <div className="stack">
        <p className="eyebrow">Templates</p>
        <h1 className="h1">Add a template.</h1>
        <p className="sub">
          The page gets the JSON in two places: <code>window.testbench.data</code>, and the <code>config/content</code> document for pages that use
          <code>window.claude.use(&quot;db&quot;)</code>, like the WQA card sort and tree test.
        </p>
      </div>
      <TemplateForm mode={storageMode} domains={ALLOWED_DOMAINS} />
    </main>
  );
}
