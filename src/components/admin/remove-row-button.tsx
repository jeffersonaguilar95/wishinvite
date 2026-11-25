"use client";

import { SubmitButton } from "@/components/submit-button";

export function RemoveRowButton({ label, disabled, onClick }: {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const className = "grid size-10 place-items-center border border-red-600 text-red-700 enabled:hover:border-red-700 enabled:hover:bg-red-50 enabled:hover:text-red-800 disabled:opacity-50";
  const icon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
      <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6" />
    </svg>
  );

  return (
    <span className="group relative inline-flex">
      {onClick ? (
        <button type="button" className={className} aria-label={label} disabled={disabled} onClick={onClick}>
          {icon}
        </button>
      ) : (
        <SubmitButton className={className} aria-label={label}>{icon}</SubmitButton>
      )}
      <span aria-hidden="true" className="pointer-events-none invisible absolute bottom-full right-0 z-10 mb-2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-sm text-white group-hover:visible group-focus-within:visible">
        {label}
      </span>
    </span>
  );
}
