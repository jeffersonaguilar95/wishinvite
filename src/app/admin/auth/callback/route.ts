import { NextResponse } from "next/server";
import { noticeCookie } from "@/lib/flash-notice";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) return new Response("Missing app URL", { status: 500 });
  const origin = new URL(configured).origin;
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    const client = await createClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (!userError && user?.email_confirmed_at && process.env.ADMIN_EMAIL &&
          user.email?.toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase()) {
        return NextResponse.redirect(new URL("/admin", origin));
      }
      await client.auth.signOut();
    }
  }
  const response = NextResponse.redirect(new URL("/admin/login", origin));
  response.cookies.set(noticeCookie("login", "/admin/login", "error"));
  return response;
}
