"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";

type Message = { text: string; error?: boolean };

let currentMessage: Message | null = null;
let timeout: number | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function setMessage(message: Message | null) {
  currentMessage = message;
  listeners.forEach(listener => listener());
}

export function showToast(message: Message) {
  window.clearTimeout(timeout);
  setMessage(message);
  timeout = window.setTimeout(() => setMessage(null), 5000);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const message = useSyncExternalStore(subscribe, () => currentMessage, () => null);

  return <>
    {children}
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 sm:left-auto sm:right-4 sm:top-4 sm:max-w-sm">
      <div role="status">
        {message && !message.error && <p className="rounded-b-lg bg-slate-900 px-4 py-3 text-white shadow-lg sm:rounded-lg">{message.text}</p>}
      </div>
      <div role="alert">
        {message?.error && <p className="rounded-b-lg bg-red-900 px-4 py-3 text-white shadow-lg sm:rounded-lg">{message.text}</p>}
      </div>
    </div>
  </>;
}

export function FlashToast({ notice, path, text, error }: {
  notice: { name: string; value: string };
  path: string;
  text: string;
  error?: boolean;
}) {
  const { name, value } = notice;

  useEffect(() => {
    const entry = `${name}=${encodeURIComponent(value)}`;
    if (!document.cookie.split(/;\s*/).includes(entry)) return;
    document.cookie = `${name}=; Max-Age=0; Path=${path}; SameSite=Lax`;
    showToast({ text, error });
  }, [name, value, path, text, error]);

  return null;
}
