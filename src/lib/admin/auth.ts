import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function isAdmin() {
  const expected = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!expected) return false;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return !error && !!user?.email_confirmed_at && user.email?.toLowerCase() === expected;
}

export async function requireAdmin() {
  if (!await isAdmin()) redirect("/admin/login");
}
