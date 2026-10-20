"use client";

import { useRef, useState } from "react";

type Props = {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  domains: string[];
  placeholder?: string;
};

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** Type an email and press Enter (or comma, space, Tab) to add it as a tag. Only allowed domains are accepted. */
export default function EmailTags({ id, value, onChange, domains, placeholder }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add(raw: string) {
    const parts = raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!parts.length) return true;
    const next = [...value];
    const bad: string[] = [];
    for (const p of parts) {
      const domain = p.split("@")[1];
      if (!EMAIL.test(p) || !domains.includes(domain)) bad.push(p);
      else if (!next.includes(p)) next.push(p);
    }
    onChange(next);
    if (bad.length) {
      setDraft(bad.join(", "));
      setError(
        bad.some((b) => !EMAIL.test(b))
          ? `"${bad[0]}" isn't an email address.`
          : `Only ${domains.map((d) => "@" + d).join(" or ")} addresses can be editors. People outside WQA can't sign in.`
      );
      return false;
    }
    setDraft("");
    setError(null);
    return true;
  }

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="tags" onClick={() => input.current?.focus()}>
        {value.map((e) => (
          <span key={e} className="tag">
            {e}
            <button
              type="button"
              aria-label={`Remove ${e}`}
              onClick={(ev) => {
                ev.stopPropagation();
                onChange(value.filter((x) => x !== e));
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={input}
          id={id}
          className="tags-input"
          value={draft}
          placeholder={value.length ? "" : placeholder}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setError(null);
            const v = e.target.value;
            if (/[,;\s]$/.test(v)) add(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || (e.key === "Tab" && draft.trim())) {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[,;\s]/.test(text.trim())) {
              e.preventDefault();
              add(draft + text);
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
        />
      </div>
      {error && <small className="error">{error}</small>}
    </div>
  );
}
