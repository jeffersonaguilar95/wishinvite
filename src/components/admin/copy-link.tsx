"use client";
import { useState } from "react";

export function CopyLink({ url, label, copied, failed }: { url: string; label: string; copied: string; failed: string }) {
  const [status, setStatus] = useState("");
  return <span className="inline-flex flex-wrap items-center gap-2">
    <button type="button" className="rounded border px-3 py-2" onClick={async () => {
      try { await navigator.clipboard.writeText(url); setStatus(copied); }
      catch { setStatus(failed); }
    }}>{label}</button>
    {status && <span role="status">{status}</span>}
  </span>;
}
