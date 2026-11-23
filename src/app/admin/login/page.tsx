import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { requestMagicLink } from "./actions";
import { adminMessages } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function Login({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  if (await isAdmin()) redirect("/admin");
  const { notice } = await searchParams;
  const t = adminMessages.es;
  return <main className="mx-auto max-w-md space-y-6 p-6">
    <h1 className="text-3xl font-bold">{t.title}</h1>
    <p>{t.loginInfo}</p>
    {notice === "sent" && <p role="status">{t.loginSent}</p>}
    {notice === "error" && <p role="alert">{t.loginError}</p>}
    <form action={requestMagicLink} className="space-y-3">
      <label className="block">{t.loginEmail} <input className="mt-1 block w-full rounded border p-2" type="email" name="email" required autoComplete="email" /></label>
      <button className="rounded bg-slate-800 px-4 py-2 text-white">{t.sendLink}</button>
    </form>
  </main>;
}
