import { FlashToast } from "@/components/toast";
import { readNotice } from "@/lib/flash-notice";
import { SubmitButton } from "@/components/submit-button";
import { notFound } from "next/navigation";
import { guestMessages, type GuestLocale } from "@/lib/i18n/guest";
import { createServiceClient } from "@/lib/supabase/service";
import { changeReservation, reserveCustomGift, updateRsvp } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

const noticeKeys = ["saved", "deadlinePassed", "taken", "alreadyReserved", "released", "reservedSuccess", "failed"] as const;
type Notice = (typeof noticeKeys)[number];

const rsvpColors = {
  yes: "border-green-700 bg-green-200 enabled:hover:bg-green-300 text-green-950",
  no: "border-red-700 bg-red-200 enabled:hover:bg-red-300 text-red-950",
  other: "border-yellow-700 bg-yellow-200 enabled:hover:bg-yellow-300 text-yellow-950",
};

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (token.length < 22 || token.length > 256) notFound();
  const db = createServiceClient();
  const { data: guest, error: guestError } = await db.from("guests")
    .select("id, event_id, display_name, rsvp_status").eq("token", token).maybeSingle();
  if (guestError) throw new Error("Unable to load guest");
  if (!guest) notFound();

  const [{ data: event, error: eventError }, { data: gifts, error: giftsError }] = await Promise.all([
    db.from("events").select("title, invitation_content, invitation_image_path, locale, rsvp_deadline, gift_list_description")
      .eq("id", guest.event_id).single(),
    db.from("gifts").select("id, name, description, url, reserved_by_guest_id")
      .eq("event_id", guest.event_id).order("created_at").order("id"),
  ]);
  if (eventError || giftsError || !event || !gifts) throw new Error("Unable to load invitation");

  const locale: GuestLocale = event.locale === "en" ? "en" : "es";
  const text = guestMessages[locale];
  const closed = event.rsvp_deadline !== null && new Date(event.rsvp_deadline).getTime() <= Date.now();
  const notice = await readNotice("invitation");
  const message = notice && noticeKeys.includes(notice.code as Notice) ? text[notice.code as Notice] : null;
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
  const orderedGifts = gifts.toSorted((first, second) =>
    Number(first.reserved_by_guest_id !== null) - Number(second.reserved_by_guest_id !== null),
  );

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
      {notice && message && <FlashToast notice={notice} path={`/i/${encodeURIComponent(token)}`} text={message}
        error={["failed", "taken", "alreadyReserved", "deadlinePassed"].includes(notice.code)} />}
      <section className="space-y-3" aria-labelledby="rsvp-heading">
        <h2 id="rsvp-heading" className="text-2xl font-semibold">{text.attendance}</h2>
        {closed && <p>{text.deadlinePassed}</p>}
        <form action={rsvpAction} className="flex flex-wrap gap-3">
          {(["yes", "no", "other"] as const).map((status) => (
            <SubmitButton key={status} name="status" value={status} disabled={closed}
              aria-pressed={guest.rsvp_status === status}
              className={`border px-4 py-3 ring-current ring-offset-2 aria-pressed:ring-2 disabled:opacity-60 ${rsvpColors[status]}`}>
              {text[status]}
            </SubmitButton>
          ))}
        </form>
      </section>
      <section className="space-y-3" aria-labelledby="gifts-heading">
        <h2 id="gifts-heading" className="text-2xl font-semibold">{text.gifts}</h2>
        {event.gift_list_description && <p className="whitespace-pre-wrap wrap-break-word">{event.gift_list_description}</p>}
        <ul className="space-y-3">
          {orderedGifts.map((gift) => {
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
                <div className="flex items-start gap-2">
                  <h3 className="line-clamp-2 min-w-0 flex-1 wrap-break-word text-lg font-semibold">
                    {available ? gift.name : <s>{gift.name}</s>}
                  </h3>
                  <div className="flex shrink-0 items-center gap-2">
                    {safeUrl && (
                      <span className="group relative inline-flex">
                        <a href={safeUrl} target="_blank" rel="noopener noreferrer" aria-label={text.link}
                          className="grid size-6 place-items-center rounded-full border border-slate-600 text-slate-700 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
                            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5">
                            <path d="M10 13a4.5 4.5 0 0 0 6.36 0l3.18-3.18a4.5 4.5 0 0 0-6.36-6.36l-1.59 1.59m2.41 5.95a4.5 4.5 0 0 0-6.36 0l-3.18 3.18a4.5 4.5 0 0 0 6.36 6.36l1.59-1.59" />
                          </svg>
                        </a>
                        <span aria-hidden="true" className="pointer-events-none invisible absolute bottom-full right-0 z-10 mb-1 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white group-hover:visible group-focus-within:visible">
                          {text.link}
                        </span>
                      </span>
                    )}
                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {available ? text.available : text.reserved}{mine && ` · ${text.mine}`}
                    </span>
                  </div>
                </div>
                {gift.description && <p>{gift.description}</p>}
                {(mine || (available && !hasReservation)) && (
                  <form action={giftAction}>
                    <input type="hidden" name="giftId" value={gift.id} />
                    <SubmitButton name="operation" value={mine ? "release" : "reserve"}
                      className="rounded bg-slate-800 enabled:hover:bg-slate-700 px-4 py-3 text-white">
                      {mine ? text.release : text.reserve}
                    </SubmitButton>
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
            <SubmitButton className="rounded bg-slate-800 enabled:hover:bg-slate-700 px-4 py-3 text-white">{text.reserve}</SubmitButton>
          </form>
        )}
      </section>
    </main>
  );
}
