import { notFound } from "next/navigation";
import { guestMessages, type GuestLocale } from "@/lib/i18n/guest";
import { createServiceClient } from "@/lib/supabase/service";
import { changeReservation, reserveCustomGift, updateRsvp } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

const noticeKeys = ["saved", "deadlinePassed", "taken", "alreadyReserved", "released", "reservedSuccess", "failed"] as const;
type Notice = (typeof noticeKeys)[number];

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { token } = await params;
  if (token.length < 22 || token.length > 256) notFound();
  const db = createServiceClient();
  const { data: guest, error: guestError } = await db.from("guests")
    .select("id, event_id, display_name, rsvp_status").eq("token", token).maybeSingle();
  if (guestError) throw new Error("Unable to load guest");
  if (!guest) notFound();

  const [{ data: event, error: eventError }, { data: gifts, error: giftsError }] = await Promise.all([
    db.from("events").select("title, invitation_content, invitation_image_path, locale, rsvp_deadline")
      .eq("id", guest.event_id).single(),
    db.from("gifts").select("id, name, description, url, reserved_by_guest_id")
      .eq("event_id", guest.event_id).order("created_at").order("id"),
  ]);
  if (eventError || giftsError || !event || !gifts) throw new Error("Unable to load invitation");

  const locale: GuestLocale = event.locale === "en" ? "en" : "es";
  const text = guestMessages[locale];
  const closed = event.rsvp_deadline !== null && new Date(event.rsvp_deadline).getTime() <= Date.now();
  const notice = (await searchParams).notice;
  const message = noticeKeys.includes(notice as Notice) ? text[notice as Notice] : null;
  let imageUrl: string | null = null;
  if (event.invitation_image_path) {
    const { data, error } = await db.storage.from("invitations")
      .createSignedUrl(event.invitation_image_path, 3600);
    if (error || !data) throw new Error("Unable to load invitation image");
    imageUrl = data.signedUrl;
  }
  const rsvpAction = updateRsvp.bind(null, token);
  const giftAction = changeReservation.bind(null, token);
  const customGiftAction = reserveCustomGift.bind(null, token);
  const hasReservation = gifts.some(gift => gift.reserved_by_guest_id === guest.id);

  return (
    <main lang={locale} className="mx-auto min-h-screen max-w-2xl space-y-8 px-4 py-8 text-slate-900">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{text.greeting(guest.display_name)}</h1>
        <p className="text-xl">{event.title}</p>
      </header>
      {imageUrl && (
        // Signed Storage URLs are dynamic and do not need Next.js image optimization.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} referrerPolicy="no-referrer" alt={text.invitation} className="h-auto w-full rounded-lg" />
      )}
      {event.invitation_content && <p className="whitespace-pre-wrap">{event.invitation_content}</p>}
      {message && <p role="status" className="rounded bg-slate-100 p-3">{message}</p>}
      <section className="space-y-3" aria-labelledby="rsvp-heading">
        <h2 id="rsvp-heading" className="text-2xl font-semibold">{text.attendance}</h2>
        {closed && <p>{text.deadlinePassed}</p>}
        <form action={rsvpAction} className="flex flex-wrap gap-3">
          {(["yes", "no", "other"] as const).map((status) => (
            <button key={status} name="status" value={status} disabled={closed}
              aria-pressed={guest.rsvp_status === status}
              className="rounded border border-slate-700 px-4 py-3 aria-pressed:bg-slate-800 aria-pressed:text-white disabled:opacity-50">
              {text[status]}
            </button>
          ))}
        </form>
      </section>
      <section className="space-y-3" aria-labelledby="gifts-heading">
        <h2 id="gifts-heading" className="text-2xl font-semibold">{text.gifts}</h2>
        <ul className="space-y-3">
          {gifts.map((gift) => {
            const mine = gift.reserved_by_guest_id === guest.id;
            const available = gift.reserved_by_guest_id === null;
            let safeUrl: string | null = null;
            if (gift.url) {
              try {
                const parsed = new URL(gift.url);
                if (parsed.protocol === "https:" || parsed.protocol === "http:") safeUrl = parsed.href;
              } catch { /* Ignore invalid links. */ }
            }
            return (
              <li key={gift.id} className="space-y-2 rounded-lg border border-slate-300 p-4">
                <h3 className="text-lg font-semibold">{available ? gift.name : <s>{gift.name}</s>}</h3>
                {gift.description && <p>{gift.description}</p>}
                {safeUrl && <a className="underline" href={safeUrl} target="_blank" rel="noopener noreferrer">{text.link}</a>}
                <p>{available ? text.available : text.reserved}{mine && ` · ${text.mine}`}</p>
                {(mine || available) && (
                  <form action={giftAction}>
                    <input type="hidden" name="giftId" value={gift.id} />
                    <button name="operation" value={mine ? "release" : "reserve"}
                      className="rounded bg-slate-800 px-4 py-3 text-white">
                      {mine ? text.release : text.reserve}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
        {!hasReservation && (
          <form action={customGiftAction} className="space-y-2 rounded-lg border border-slate-300 p-4">
            <label className="block font-semibold">
              {text.otherGift}
              <input name="name" required maxLength={200} placeholder={text.otherGiftName}
                className="mt-1 block w-full rounded border border-slate-400 p-2 font-normal" />
            </label>
            <p className="text-sm">{text.otherGiftVisibility}</p>
            <button className="rounded bg-slate-800 px-4 py-3 text-white">{text.reserve}</button>
          </form>
        )}
      </section>
    </main>
  );
}
