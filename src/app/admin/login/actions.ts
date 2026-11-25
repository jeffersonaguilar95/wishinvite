"use server";
import { redirectWithNotice } from "@/lib/flash-notice";
import { createClient } from "@/lib/supabase/server";

export async function requestMagicLink(formData: FormData) {
  const email = formData.get("email");
  const expected = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (typeof email !== "string" || !expected || email.trim().toLowerCase() !== expected || !appUrl) {
    return redirectWithNotice("login", "/admin/login", "sent");
  }
  let callback: URL;
  try {
    callback = new URL("/admin/auth/callback", appUrl);
    if (!["http:", "https:"].includes(callback.protocol)) throw new Error();
  } catch { return redirectWithNotice("login", "/admin/login", "error"); }
  const client = await createClient();
  const { error } = await client.auth.signInWithOtp({ email: expected, options: { emailRedirectTo: callback.toString() } });
  return redirectWithNotice("login", "/admin/login", error ? "error" : "sent");
}
