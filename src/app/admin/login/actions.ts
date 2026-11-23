"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestMagicLink(formData: FormData) {
  const email = formData.get("email");
  const expected = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (typeof email !== "string" || !expected || email.trim().toLowerCase() !== expected || !appUrl) {
    redirect("/admin/login?notice=sent");
  }
  let callback: URL;
  try {
    callback = new URL("/admin/auth/callback", appUrl);
    if (!["http:", "https:"].includes(callback.protocol)) throw new Error();
  } catch { redirect("/admin/login?notice=error"); }
  const client = await createClient();
  const { error } = await client.auth.signInWithOtp({ email: expected, options: { emailRedirectTo: callback.toString() } });
  redirect(error ? "/admin/login?notice=error" : "/admin/login?notice=sent");
}
