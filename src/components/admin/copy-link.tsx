"use client";

import { useState, type ReactNode } from "react";

type CopyAction = { text: string; label: string; copied: string; failed: string };

function CopyButton({ text, label, copied, failed, children }: CopyAction & { children: ReactNode }) {
  const [status, setStatus] = useState("");

  return (
    <div className="group relative">
      <button type="button" aria-label={label} className="grid size-10 place-items-center border border-slate-600 bg-transparent enabled:hover:bg-slate-200"
        onBlur={() => setStatus("")} onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setStatus(copied);
          } catch {
            setStatus(failed);
          }
        }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
          {children}
        </svg>
      </button>
      <span aria-hidden="true" className="pointer-events-none invisible absolute bottom-full right-0 z-10 mb-2 w-max max-w-48 rounded bg-slate-900 px-2 py-1 text-sm text-white group-hover:visible group-focus-within:visible">
        {status || label}
      </span>
      <span role="status" className="sr-only">{status}</span>
    </div>
  );
}

export function CopyLink({ url, fieldLabel, label, copied, failed, invitation, endAction }: {
  url: string;
  fieldLabel: string;
  label: string;
  copied: string;
  failed: string;
  invitation: CopyAction;
  endAction: ReactNode;
}) {
  return (
    <div className="flex min-w-[min(100%,16rem)] flex-1 items-end gap-2">
      <label className="min-w-0 flex-1">
        {fieldLabel}
        <input readOnly value={url} className="mt-1 block w-full rounded border border-slate-400 p-2" />
      </label>
      <CopyButton text={url} label={label} copied={copied} failed={failed}>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 4H6a2 2 0 0 0-2 2v10" />
      </CopyButton>
      <CopyButton {...invitation}>
        <path d="M4 6h16v12H4zM4 6l8 7 8-7" />
      </CopyButton>
      {endAction}
    </div>
  );
}
