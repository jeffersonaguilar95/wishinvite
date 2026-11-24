"use client";

import { useEffect, type ReactNode } from "react";

export function DraftGuard({ children, warning, locale }: {
  children: ReactNode;
  warning: string;
  locale: string;
}) {
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!document.querySelector("form[data-dirty='true']")) return;
      event.preventDefault();
      event.returnValue = true;
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  return <main lang={locale} className="mx-auto max-w-5xl space-y-8 p-4 sm:p-8"
    onSubmitCapture={event => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (event.currentTarget.querySelector("form[data-saving='true']")) {
        event.preventDefault();
      } else if (!form.hasAttribute("data-section-editor") &&
        event.currentTarget.querySelector("form[data-dirty='true']") && !window.confirm(warning)) {
        event.preventDefault();
      }
    }}
    onClickCapture={event => {
      if (event.target instanceof Element && event.target.closest("nav a") &&
        event.currentTarget.querySelector("form[data-dirty='true']") && !window.confirm(warning)) {
        event.preventDefault();
      }
    }}>
    {children}
  </main>;
}
