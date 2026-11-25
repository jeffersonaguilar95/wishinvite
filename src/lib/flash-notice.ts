import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type Scope = "invitation" | "admin" | "login";

function cookieName(scope: Scope) {
  return `wishvite-notice-${scope}`;
}

export function noticeCookie(scope: Scope, path: string, code: string) {
  return {
    name: cookieName(scope),
    value: `${randomUUID()}:${code}`,
    path,
    maxAge: 30,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function redirectWithNotice(scope: Scope, url: string, code: string): Promise<never> {
  const [path] = url.split("?");
  (await cookies()).set(noticeCookie(scope, path, code));
  redirect(url);
}

export async function readNotice(scope: Scope) {
  const name = cookieName(scope);
  const value = (await cookies()).get(name)?.value;
  if (!value) return null;
  const separator = value.indexOf(":");
  if (separator < 0) return null;
  return { name, value, code: value.slice(separator + 1) };
}
