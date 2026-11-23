import { requireAdmin } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { adminMessages } from "@/lib/i18n/admin";
import { CopyLink } from "@/components/admin/copy-link";
import { createEvent, deleteGift, deleteGuest, saveEvent, saveGift, saveGuest, sendInvitations, signOut } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };
const input = "mt-1 block w-full rounded border border-slate-400 p-2";
const button = "rounded bg-slate-800 px-4 py-2 text-white";
const outline = "rounded border border-slate-600 px-3 py-2";
const notices = ["saved", "invalid", "error", "imageInvalid", "guestReserved", "emailNotConfigured", "emailNoImage", "emailImageError", "emailNone"] as const;
type Notice = (typeof notices)[number];

export default async function Admin({ searchParams }: { searchParams: Promise<{ event?: string; notice?: string; sent?: string; failed?: string; unrecorded?: string }> }) {
  await requireAdmin();
  const db = createServiceClient();
  const query = await searchParams;
  const { data: events, error: eventsError } = await db.from("events")
    .select("id, title, locale, invitation_content, invitation_image_path, rsvp_deadline")
    .order("created_at").order("id");
  if (eventsError || !events) throw new Error("Unable to load events");
  const event = events.find(item => item.id === query.event) ?? events[0];
  const locale = event?.locale === "en" ? "en" : "es";
  const t = adminMessages[locale];
  const count = (value?: string) => /^\d{1,6}$/.test(value ?? "") ? Number(value) : 0;
  const notice = query.notice === "emailResult"
    ? t.emailResult(count(query.sent), count(query.failed), count(query.unrecorded))
    : notices.includes(query.notice as Notice) ? t[query.notice as Notice] : null;
  const emailEnabled = Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("App URL is missing");
  const [{ data: guests, error: guestsError }, { data: gifts, error: giftsError }] = event ? await Promise.all([
    db.from("guests").select("id, display_name, email, token, rsvp_status, invited_at").eq("event_id", event.id).order("display_name").order("id"),
    db.from("gifts").select("id, name, description, url, reserved_by_guest_id").eq("event_id", event.id).order("name").order("id"),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (guestsError || giftsError || !guests || !gifts) throw new Error("Unable to load event details");
  let imageUrl: string | null = null;
  if (event?.invitation_image_path) {
    const { data, error } = await db.storage.from("invitations").createSignedUrl(event.invitation_image_path, 3600);
    if (error || !data) throw new Error("Unable to load invitation image");
    imageUrl = data.signedUrl;
  }
  const counts = { yes: 0, no: 0, pending: 0 };
  for (const guest of guests) {
    if (guest.rsvp_status === "yes") counts.yes++;
    else if (guest.rsvp_status === "no") counts.no++;
    else counts.pending++;
  }
  return <main lang={locale} className="mx-auto max-w-5xl space-y-8 p-4 sm:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">{t.title}</h1><form action={signOut}><button className={outline}>{t.signOut}</button></form></header>
    {notice && <p role="status" className="rounded bg-slate-100 p-3">{notice}</p>}
    {events.length > 1 && <nav aria-label={t.selectEvent} className="flex flex-wrap gap-3">{events.map(item => <a key={item.id} href={`/admin?event=${item.id}`} className="underline" aria-current={item.id === event?.id ? "page" : undefined}>{item.title}</a>)}</nav>}
    <details className="rounded border p-4" open={!event}><summary className="cursor-pointer font-semibold">{t.newEvent}</summary>
      {!event && <p>{t.noEvent}</p>}
      <form action={createEvent} className="mt-3 flex flex-wrap items-end gap-3"><label>{t.eventTitle}<input className={input} name="title" required maxLength={200} /></label><label>{t.locale}<select className={input} name="locale" defaultValue="es"><option value="es">{t.spanish}</option><option value="en">{t.english}</option></select></label><button className={button}>{t.createEvent}</button></form>
    </details>
    {event && <>
      <section className="space-y-4"><h2 className="text-2xl font-semibold">{t.event}</h2>
        {imageUrl && (
          // Signed Storage URLs are dynamic and do not need Next.js image optimization.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={t.currentImage} referrerPolicy="no-referrer" className="h-auto w-full max-w-xl rounded" />
        )}
        <form action={saveEvent} className="space-y-3"><input type="hidden" name="eventId" value={event.id} />
          <label className="block">{t.eventTitle}<input className={input} name="title" defaultValue={event.title} required maxLength={200} /></label>
          <label className="block">{t.locale}<select className={input} name="locale" defaultValue={locale}><option value="es">{t.spanish}</option><option value="en">{t.english}</option></select></label>
          <label className="block">{t.content}<textarea className={input} name="content" defaultValue={event.invitation_content ?? ""} maxLength={10000} /></label>
          <label className="block">{t.deadline}<input className={input} type="datetime-local" name="deadline" defaultValue={event.rsvp_deadline ? new Date(event.rsvp_deadline).toISOString().slice(0, 16) : ""} /></label>
          <label className="block">{t.image}<input className={input} type="file" name="image" accept="image/jpeg,image/png,image/webp" /></label><button className={button}>{t.save}</button>
        </form>
      </section>
      <section className="space-y-4"><h2 className="text-2xl font-semibold">{t.guests}</h2>
        {!emailEnabled && <p>{t.emailDisabled}</p>}
        <form action={sendInvitations}><input type="hidden" name="eventId" value={event.id} /><button className={button} disabled={!emailEnabled} style={{ opacity: emailEnabled ? 1 : 0.5 }}>{t.sendInvitations}</button></form>
        {guests.length === 0 && <p>{t.noGuests}</p>}
        <ul className="space-y-4">{guests.map(guest => { const link = new URL(`/i/${encodeURIComponent(guest.token)}`, appUrl).toString(); return <li key={guest.id} className="space-y-3 rounded border p-4">
          <form action={saveGuest} className="flex flex-wrap items-end gap-3"><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="guestId" value={guest.id} />
            <label>{t.family}<input className={input} name="name" defaultValue={guest.display_name} maxLength={200} required /></label><label>{t.email}<input className={input} type="email" name="email" defaultValue={guest.email ?? ""} maxLength={254} /></label><button className={button}>{t.save}</button>
          </form><div className="flex flex-wrap gap-2"><input aria-label={t.copy} readOnly value={link} className="min-w-0 flex-1 rounded border p-2" /><CopyLink url={link} label={t.copy} copied={t.copied} failed={t.copyFailed} /></div>
          {guest.invited_at && <p>{t.invitationSentAt}: <time dateTime={guest.invited_at}>{new Date(guest.invited_at).toLocaleString(locale === "es" ? "es-ES" : "en-GB", { timeZone: "UTC" })} UTC</time></p>}
          {guest.email && <form action={sendInvitations}><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="guestId" value={guest.id} /><button className={outline} disabled={!emailEnabled} style={{ opacity: emailEnabled ? 1 : 0.5 }}>{t.resend}</button></form>}
          <form action={deleteGuest}><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="guestId" value={guest.id} /><button className={outline}>{t.remove}</button></form>
        </li>; })}</ul>
        <form action={saveGuest} className="flex flex-wrap items-end gap-3"><input type="hidden" name="eventId" value={event.id} /><label>{t.family}<input className={input} name="name" required maxLength={200} /></label><label>{t.email}<input className={input} type="email" name="email" maxLength={254} /></label><button className={button}>{t.add}</button></form>
      </section>
      <section className="space-y-4"><h2 className="text-2xl font-semibold">{t.gifts}</h2>
        {gifts.length === 0 && <p>{t.noGifts}</p>}
        <ul className="space-y-4">{gifts.map(gift => <li key={gift.id} className="space-y-3 rounded border p-4">
          <form action={saveGift} className="flex flex-wrap items-end gap-3"><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="giftId" value={gift.id} />
            <label>{t.giftName}<input className={input} name="name" defaultValue={gift.name} required maxLength={200} /></label><label>{t.description}<input className={input} name="description" defaultValue={gift.description ?? ""} maxLength={2000} /></label><label>{t.giftUrl}<input className={input} type="url" name="url" defaultValue={gift.url ?? ""} maxLength={2000} /></label><button className={button}>{t.save}</button>
          </form><form action={deleteGift}><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="giftId" value={gift.id} /><button className={outline}>{t.remove}</button></form>
        </li>)}</ul>
        <form action={saveGift} className="flex flex-wrap items-end gap-3"><input type="hidden" name="eventId" value={event.id} /><label>{t.giftName}<input className={input} name="name" required maxLength={200} /></label><label>{t.description}<input className={input} name="description" maxLength={2000} /></label><label>{t.giftUrl}<input className={input} type="url" name="url" maxLength={2000} /></label><button className={button}>{t.add}</button></form>
      </section>
      <section className="space-y-4"><h2 className="text-2xl font-semibold">{t.responses}</h2>
        <div className="flex flex-wrap gap-4"><p>{t.confirmed}: {counts.yes}</p><p>{t.declined}: {counts.no}</p><p>{t.pending}: {counts.pending}</p></div>
        <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="p-2">{t.family}</th><th className="p-2">{t.response}</th><th className="p-2">{t.gift}</th></tr></thead><tbody>
          {guests.map(guest => <tr key={guest.id} className="border-t"><td className="p-2">{guest.display_name}</td><td className="p-2">{guest.rsvp_status === "yes" ? t.confirmed : guest.rsvp_status === "no" ? t.declined : t.pending}</td><td className="p-2">{gifts.find(gift => gift.reserved_by_guest_id === guest.id)?.name ?? t.none}</td></tr>)}
        </tbody></table></div>
      </section>
    </>}
  </main>;
}
