"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className,
  disabled,
  loading = false,
  name,
  value,
  ...props
}: Omit<ComponentPropsWithoutRef<"button">, "type"> & { loading?: boolean }) {
  const { pending, data } = useFormStatus();
  const busy = loading || (pending && (name === undefined || data?.get(name) === value));

  return (
    <button
      {...props}
      type="submit"
      name={name}
      value={value}
      disabled={disabled || pending || loading}
      aria-busy={busy}
      className={`relative ${className ?? ""}`}
    >
      <span className={busy ? "opacity-0" : undefined}>{children}</span>
      {busy && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="size-4 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" />
        </span>
      )}
    </button>
  );
}
