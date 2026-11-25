import { FlashToast } from "@/components/toast";
import { readNotice } from "@/lib/flash-notice";
import { RemoveRowButton } from "@/components/admin/remove-row-button";
import { SubmitButton } from "@/components/submit-button";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { adminMessages } from "@/lib/i18n/admin";
import { DraftGuard } from "@/components/admin/draft-guard";
import { SectionEditor } from "@/components/admin/section-editor";
import { CopyLink } from "@/components/admin/copy-link";
import { assignGift, createEvent, deleteGift, deleteGuest, saveEvent, sendInvitations, signOut } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };
const input = "mt-1 block w-full rounded border border-slate-400 p-2";
const button = "rounded bg-slate-800 enabled:hover:bg-slate-700 px-4 py-2 text-white";
const outline = "rounded border border-slate-600 px-3 py-2";
const successNotices = ["eventCreated", "eventSaved", "guestDeleted", "giftAssigned", "giftDeleted"] as const;
const notices = [...successNotices, "invalid", "error", "imageInvalid", "guestReserved", "familyAlreadyReserved", "giftUnavailable", "emailNotConfigured", "emailNoImage", "emailImageError", "emailNone"] as const;
type Notice = (typeof notices)[number];

export default async function Admin({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  await requireAdmin();
  const db = createServiceClient();
  const query = await searchParams;
  const { data: events, error: eventsError } = await db.from("events")
    .select("id, title, locale, invitation_content, invitation_image_path, rsvp_deadline, gift_list_description, invitation_share_message")
    .order("created_at").order("id");
  if (eventsError || !events) throw new Error("Unable to load events");
  const event = events.find(item => item.id === query.event) ?? events[0];
  const locale = event?.locale === "en" ? "en" : "es";
  const t = adminMessages[locale];
  const count = (value?: string) => /^\d{1,6}$/.test(value ?? "") ? Number(value) : 0;
  const notice = await readNotice("admin");
  const [code, sent, failed, unrecorded] = notice?.code.split(":") ?? [];
  const message = code === "emailResult"
    ? t.emailResult(count(sent), count(failed), count(unrecorded))
    : notices.includes(code as Notice) ? t[code as Notice] : null;
  const emailEnabled = Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("App URL is missing");
  const [{ data: guests, error: guestsError }, { data: gifts, error: giftsError }] = event ? await Promise.all([
    db.from("guests").select("id, display_name, email, token, rsvp_status, invited_at").eq("event_id", event.id).order("created_at").order("id"),
    db.from("gifts").select("id, name, description, url, reserved_by_guest_id").eq("event_id", event.id).order("created_at").order("id"),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (guestsError || giftsError || !guests || !gifts) throw new Error("Unable to load event details");
  let imageUrl: string | null = null;
  if (event?.invitation_image_path) {
    const { data, error } = await db.storage.from("invitations").createSignedUrl(event.invitation_image_path, 3600);
    if (error || !data) throw new Error("Unable to load invitation image");
    imageUrl = data.signedUrl;
  }
  const reservations = new Map(gifts.filter(gift => gift.reserved_by_guest_id !== null)
    .map(gift => [gift.reserved_by_guest_id, gift.name]));
  const availableFamilies = guests.filter(guest => !reservations.has(guest.id));
  const counts = { yes: 0, no: 0, other: 0, pending: 0 };
  for (const guest of guests) {
    if (guest.rsvp_status === "yes") counts.yes++;
    else if (guest.rsvp_status === "no") counts.no++;
    else if (guest.rsvp_status === "other") counts.other++;
    else counts.pending++;
  }
  return <DraftGuard locale={locale} warning={t.unsaved}>
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">{t.title}</h1><form action={signOut}><SubmitButton className={outline}>{t.signOut}</SubmitButton></form></header>
    {notice && message && <FlashToast notice={notice} path="/admin" text={message}
      error={code !== "emailResult" && !successNotices.some(success => success === code)} />}
    {events.length > 1 && <nav aria-label={t.selectEvent} className="flex flex-wrap gap-3">{events.map(item => <a key={item.id} href={`/admin?event=${item.id}`} className="underline" aria-current={item.id === event?.id ? "page" : undefined}>{item.title}</a>)}</nav>}
    <details className="rounded border p-4" open={!event}><summary className="cursor-pointer font-semibold">{t.newEvent}</summary>
      {!event && <p>{t.noEvent}</p>}
      <form action={createEvent} className="mt-3 flex flex-wrap items-end gap-3"><label>{t.eventTitle}<input className={input} name="title" required maxLength={200} /></label><label>{t.locale}<select className={input} name="locale" defaultValue="es"><option value="es">{t.spanish}</option><option value="en">{t.english}</option></select></label><SubmitButton className={button}>{t.createEvent}</SubmitButton></form>
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
          <label className="block">
            {t.shareMessage}
            <textarea className={input} name="shareMessage" defaultValue={event.invitation_share_message ?? ""}
              placeholder={t.defaultShareMessage} rows={4} maxLength={2000} aria-describedby="share-message-hint" />
          </label>
          <p id="share-message-hint" className="text-sm text-slate-700">{t.shareMessageHint}</p>
          <label className="block">{t.deadline}<input className={input} type="datetime-local" name="deadline" defaultValue={event.rsvp_deadline ? new Date(event.rsvp_deadline).toISOString().slice(0, 16) : ""} /></label>
          <label className="block">{t.image}<input className={input} type="file" name="image" accept="image/jpeg,image/png,image/webp" /></label><SubmitButton className={button}>{t.save}</SubmitButton>
        </form>
      </section>
      <hr className="border-slate-200" />
      <section className="space-y-4"><h2 className="text-2xl font-semibold">{t.guests}</h2>
        {!emailEnabled && <p>{t.emailDisabled}</p>}
        <form action={sendInvitations}><input type="hidden" name="eventId" value={event.id} /><SubmitButton className={button} disabled={!emailEnabled} style={{ opacity: emailEnabled ? 1 : 0.5 }}>{t.sendInvitations}</SubmitButton></form>
        {guests.length === 0 && <p>{t.noGuests}</p>}
        <SectionEditor key={`guests-${event.id}`} section="guests" eventId={event.id} locale={locale}
          rows={guests.map(guest => {
            const link = new URL(`/i/${encodeURIComponent(guest.token)}`, appUrl).toString();
            const template = event.invitation_share_message ?? t.defaultShareMessage;
            const message = template.includes("{nombre}")
              ? template.replaceAll("{nombre}", () => guest.display_name)
              : `${t.shareGreeting(guest.display_name)}\n\n${template}`;
            return {
              id: guest.id,
              values: { name: guest.display_name, email: guest.email ?? "" },
              inlineField: <CopyLink url={link} fieldLabel={t.invitationLink} label={t.copy}
                copied={t.copied} failed={t.copyFailed}
                invitation={{ text: `${message}\n\n${link}`, label: t.copyInvitation,
                  copied: t.invitationCopied, failed: t.invitationCopyFailed }}
                endAction={<form action={deleteGuest} className="flex">
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="guestId" value={guest.id} />
                  <RemoveRowButton label={t.removeGuest} />
                </form>} />,
              actions: <>
                {guest.invited_at && <p>{t.invitationSentAt}: <time dateTime={guest.invited_at}>{new Date(guest.invited_at).toLocaleString(locale === "es" ? "es-ES" : "en-GB", { timeZone: "UTC" })} UTC</time></p>}
                {guest.email && <form action={sendInvitations}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="guestId" value={guest.id} />
                  <SubmitButton className={outline} disabled={!emailEnabled} style={{ opacity: emailEnabled ? 1 : 0.5 }}>{t.resend}</SubmitButton>
                </form>}
              </>,
            };
          })} />
      </section>
      <hr className="border-slate-200" />
      <section className="space-y-4"><h2 className="text-2xl font-semibold">{t.gifts}</h2>
        {gifts.length === 0 && <p>{t.noGifts}</p>}
        <SectionEditor key={`gifts-${event.id}`} section="gifts" eventId={event.id} locale={locale}
          giftListDescription={event.gift_list_description ?? ""}
          rows={gifts.map(gift => ({
            id: gift.id,
            values: { name: gift.name, description: gift.description ?? "", url: gift.url ?? "" },
            actions: <>
              {gift.reserved_by_guest_id === null && availableFamilies.length > 0 && (
                <form action={assignGift} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="giftId" value={gift.id} />
                  <label>{t.family}
                    <select name="guestId" className={input} required defaultValue="">
                      <option value="" disabled>{t.selectFamily}</option>
                      {availableFamilies.map(guest => <option key={guest.id} value={guest.id}>{guest.display_name}</option>)}
                    </select>
                  </label>
                  <SubmitButton className={outline}>{t.assignGift}</SubmitButton>
                </form>
              )}
            </>,
            endAction: <form action={deleteGift}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="giftId" value={gift.id} />
              <RemoveRowButton label={t.removeGift} />
            </form>,
          }))} />
      </section>
      <hr className="border-slate-200" />
      <section className="space-y-4"><h2 className="text-2xl font-semibold">{t.responses}</h2>
        <div className="flex flex-wrap gap-4"><p>{t.confirmed}: {counts.yes}</p><p>{t.declined}: {counts.no}</p><p>{t.other}: {counts.other}</p><p>{t.pending}: {counts.pending}</p></div>
        <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="p-2">{t.family}</th><th className="p-2">{t.response}</th><th className="p-2">{t.gift}</th></tr></thead><tbody>
          {guests.map(guest => <tr key={guest.id} className="border-t"><td className="p-2">{guest.display_name}</td><td className="p-2">{guest.rsvp_status === "yes" ? t.confirmed : guest.rsvp_status === "no" ? t.declined : guest.rsvp_status === "other" ? t.other : t.pending}</td><td className="p-2">{reservations.get(guest.id) ?? t.none}</td></tr>)}
        </tbody></table></div>
      </section>
    </>}
  </DraftGuard>;
}
