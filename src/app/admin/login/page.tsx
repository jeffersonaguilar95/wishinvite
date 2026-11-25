import { FlashToast } from "@/components/toast";
import { readNotice } from "@/lib/flash-notice";
import { SubmitButton } from "@/components/submit-button";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { requestMagicLink } from "./actions";
import { adminMessages } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function Login() {
  if (await isAdmin()) redirect("/admin");
  const notice = await readNotice("login");
  const t = adminMessages.es;
  return <main className="mx-auto max-w-md space-y-6 p-6">
    <h1 className="text-3xl font-bold">{t.title}</h1>
    <p>{t.loginInfo}</p>
    {notice && (notice.code === "sent" || notice.code === "error") && (
      <FlashToast notice={notice} path="/admin/login" text={notice.code === "sent" ? t.loginSent : t.loginError}
        error={notice.code === "error"} />
    )}
    <form action={requestMagicLink} className="space-y-3">
      <label className="block">{t.loginEmail} <input className="mt-1 block w-full rounded border p-2" type="email" name="email" required autoComplete="email" /></label>
      <SubmitButton className="rounded bg-slate-800 enabled:hover:bg-slate-700 px-4 py-2 text-white">{t.sendLink}</SubmitButton>
    </form>
  </main>;
}
