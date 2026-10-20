"use client";

import { useRef, useState } from "react";
import { describe, Picked, pickedFromDrop, pickedFromInput } from "./upload-client";

type Props = {
  picked: Picked;
  onPick: (p: Picked) => void;
  title?: string;
  hint?: string;
  accept?: string;
  folders?: boolean;
};

export default function DropZone({ picked, onPick, title = "Drop an HTML file, a folder or a ZIP", hint, accept = ".html,.htm,.zip,text/html,application/zip", folders = true }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div
      className={`dropzone${over ? " over" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => fileInput.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), fileInput.current?.click())}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setOver(false);
        onPick(await pickedFromDrop(e.dataTransfer));
      }}
    >
      {picked.length ? (
        <>
          <span className="big">{describe(picked)}</span>
          <span className="muted small">Drop again or click to replace</span>
        </>
      ) : (
        <>
          <span className="big">{title}</span>
          <span className="muted small">{hint || "or click to choose a file"}</span>
        </>
      )}
      {folders && (
        <button
          type="button"
          className="btn btn-link small"
          onClick={(e) => {
            e.stopPropagation();
            folderInput.current?.click();
          }}
        >
          Choose a folder instead
        </button>
      )}
      <input ref={fileInput} type="file" hidden accept={accept} onChange={(e) => onPick(pickedFromInput(e.target.files))} />
      {folders && (
        <input
          ref={folderInput}
          type="file"
          hidden
          // @ts-expect-error non-standard but supported by all current browsers
          webkitdirectory=""
          onChange={(e) => onPick(pickedFromInput(e.target.files))}
        />
      )}
    </div>
  );
}
