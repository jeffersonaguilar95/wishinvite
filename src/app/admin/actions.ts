"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function text(data: FormData, key: string, max = 200): string | null {
  const value = data.get(key);
  if (typeof value !== "string" || value.trim().length > max) return null;
  return value.trim();
}
function id(data: FormData, key: string) {
  const value = text(data, key);
  return value && uuid.test(value) ? value : null;
}
function finish(eventId: string | null, notice: string): never {
  revalidatePath("/admin");
  const query = new URLSearchParams({ notice });
  if (eventId) query.set("event", eventId);
  redirect(`/admin?${query.toString()}`);
}
async function authorizedEvent(data: FormData) {
  await requireAdmin();
  const eventId = id(data, "eventId");
  if (!eventId) finish(null, "invalid");
  return eventId;
}

export async function signOut() {
  await requireAdmin();
  const client = await createClient();
  await client.auth.signOut();
  redirect("/admin/login");
}

export async function createEvent(data: FormData) {
  await requireAdmin();
  const title = text(data, "title");
  const locale = text(data, "locale");
  if (!title || (locale !== "es" && locale !== "en")) finish(null, "invalid");
  const { data: event, error } = await createServiceClient().from("events")
    .insert({ title, locale }).select("id").single();
  if (error || !event) finish(null, "error");
  finish(event.id, "saved");
}

export async function saveEvent(data: FormData) {
  const eventId = await authorizedEvent(data);
  const title = text(data, "title");
  const content = text(data, "content", 10000);
  const locale = text(data, "locale");
  const deadline = text(data, "deadline");
  if (!title || content === null || deadline === null || (locale !== "es" && locale !== "en")) finish(eventId, "invalid");
  let deadlineIso: string | null = null;
  if (deadline) {
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(deadline)) finish(eventId, "invalid");
    const date = new Date(`${deadline}:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 16) !== deadline) finish(eventId, "invalid");
    deadlineIso = date.toISOString();
  }
  const db = createServiceClient();
  const file = data.get("image");
  let imagePath: string | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > 4 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) finish(eventId, "imageInvalid");
    imagePath = `${eventId}/${randomUUID()}`;
    const { error } = await db.storage.from("invitations").upload(imagePath, file, { contentType: file.type });
    if (error) finish(eventId, "error");
  }
  const { data: changed, error } = await db.from("events").update({ title, invitation_content: content || null,
    locale, rsvp_deadline: deadlineIso, updated_at: new Date().toISOString(),
    ...(imagePath ? { invitation_image_path: imagePath } : {}),
  }).eq("id", eventId).select("id").maybeSingle();
  if (error || !changed) {
    if (imagePath) await db.storage.from("invitations").remove([imagePath]);
    finish(eventId, "error");
  }
  finish(eventId, "saved");
}

export async function deleteGuest(data: FormData) {
  const eventId = await authorizedEvent(data);
  const guestId = id(data, "guestId");
  if (!guestId) finish(eventId, "invalid");
  const { data: deleted, error } = await createServiceClient().from("guests").delete()
    .eq("id", guestId).eq("event_id", eventId).select("id").maybeSingle();
  if (error?.code === "23503") finish(eventId, "guestReserved");
  if (error || !deleted) finish(eventId, "error");
  finish(eventId, "saved");
}

export async function saveSection(
  eventId: string,
  section: "guests" | "gifts",
  data: FormData,
): Promise<{ status: "saved" | "error" } | { status: "invalid"; row: string }> {
  await requireAdmin();
  if (!uuid.test(eventId) || (section !== "guests" && section !== "gifts")) return { status: "error" };
  const rows = [];
  for (const key of data.getAll("rows")) {
    if (typeof key !== "string") return { status: "error" };
    const rowId = key.startsWith("new-") ? null : key;
    const name = text(data, `${key}.name`);
    if (!name || (rowId && !uuid.test(rowId))) return { status: "invalid", row: key };

    if (section === "guests") {
      const email = text(data, `${key}.email`, 254);
      if (email === null || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return { status: "invalid", row: key };
      }
      rows.push({ id: rowId, name, email: email || null });
    } else {
      const description = text(data, `${key}.description`, 2000);
      const url = text(data, `${key}.url`, 2000);
      if (description === null || url === null) return { status: "invalid", row: key };
      if (url) {
        try {
          if (!["http:", "https:"].includes(new URL(url).protocol)) return { status: "invalid", row: key };
        } catch {
          return { status: "invalid", row: key };
        }
      }
      rows.push({ id: rowId, name, description: description || null, url: url || null });
    }
  }

  const description = section === "gifts" && data.has("giftListDescription")
    ? text(data, "giftListDescription", 10000)
    : undefined;
  if (description === null) return { status: "error" };

  if (rows.length || description !== undefined) {
    const { error } = await createServiceClient().rpc(
      section === "guests" ? "save_event_guests" : "save_event_gifts",
      {
        p_event_id: eventId,
        p_rows: rows,
        ...(description !== undefined ? { p_gift_list_description: description || null } : {}),
      },
    );
    if (error) return { status: "error" };
    revalidatePath("/admin");
  }
  return { status: "saved" };
}

export async function assignGift(data: FormData) {
  const eventId = await authorizedEvent(data);
  const guestId = id(data, "guestId");
  const giftId = id(data, "giftId");
  if (!guestId || !giftId) finish(eventId, "invalid");

  const db = createServiceClient();
  const { data: guest, error: guestError } = await db.from("guests")
    .select("token").eq("id", guestId).eq("event_id", eventId).maybeSingle();
  if (guestError) finish(eventId, "error");
  if (!guest) finish(eventId, "invalid");
  const { data: reserved, error } = await db.rpc("reserve_gift", {
    p_token: guest.token, p_gift_id: giftId,
  });
  if (error?.code === "23505") finish(eventId, "familyAlreadyReserved");
  if (error) finish(eventId, "error");
  finish(eventId, reserved ? "saved" : "giftUnavailable");
}

export async function deleteGift(data: FormData) {
  const eventId = await authorizedEvent(data);
  const giftId = id(data, "giftId");
  if (!giftId) finish(eventId, "invalid");
  const { data: deleted, error } = await createServiceClient().from("gifts").delete()
    .eq("id", giftId).eq("event_id", eventId).select("id").maybeSingle();
  if (error || !deleted) finish(eventId, "error");
  finish(eventId, "saved");
}

export async function sendInvitations(data: FormData) {
  const eventId = await authorizedEvent(data);
  const guestIdValue = text(data, "guestId");
  if (guestIdValue && !uuid.test(guestIdValue)) finish(eventId, "invalid");
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!apiKey || !from || !appUrl) finish(eventId, "emailNotConfigured");
  const db = createServiceClient();
  const { data: event, error: eventError } = await db.from("events")
    .select("title, invitation_content, invitation_image_path").eq("id", eventId).maybeSingle();
  if (eventError || !event) finish(eventId, "error");
  if (!event.invitation_image_path) finish(eventId, "emailNoImage");
  let query = db.from("guests").select("id, display_name, email, token")
    .eq("event_id", eventId).not("email", "is", null);
  query = guestIdValue ? query.eq("id", guestIdValue) : query.is("invited_at", null);
  const { data: guests, error: guestsError } = await query.order("id");
  if (guestsError || !guests) finish(eventId, "error");
  if (!guests.length) finish(eventId, "emailNone");
  const { data: image, error: imageError } = await db.storage.from("invitations").download(event.invitation_image_path);
  if (imageError || !image || !["image/jpeg", "image/png", "image/webp"].includes(image.type)) finish(eventId, "emailImageError");
  const imageContent = Buffer.from(await image.arrayBuffer()).toString("base64");
  const { sendInvitation } = await import("@/lib/email/resend.mjs");
  let sent = 0;
  let failed = 0;
  let unrecorded = 0;
  for (const [index, guest] of guests.entries()) {
    // Claims prevent simultaneous requests from sending the same invitation.
    const claimId = randomUUID();
    const stale = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    let claim = db.from("guests").update({ invitation_claim_id: claimId, invitation_claimed_at: new Date().toISOString() })
      .eq("id", guest.id).eq("event_id", eventId).eq("email", guest.email)
      .or(`invitation_claimed_at.is.null,invitation_claimed_at.lt.${stale}`);
    if (!guestIdValue) claim = claim.is("invited_at", null);
    const { data: claimed, error: claimError } = await claim.select("id").maybeSingle();
    if (claimError || !claimed) { failed++; continue; }
    // Resend's default rate limit is two requests per second.
    if (index > 0) await new Promise(resolve => setTimeout(resolve, 600));
    let accepted = false;
    try {
      const link = new URL(`/i/${encodeURIComponent(guest.token)}`, appUrl).toString();
      accepted = await sendInvitation({ apiKey, from, to: guest.email, family: guest.display_name,
        title: event.title, content: event.invitation_content, link, image: imageContent, imageType: image.type });
    } catch {
      // The remote service may have accepted the request before the connection failed.
    }
    if (!accepted) {
      await db.from("guests").update({ invitation_claim_id: null, invitation_claimed_at: null })
        .eq("id", guest.id).eq("invitation_claim_id", claimId);
      failed++;
      continue;
    }
    try {
      const { data: updated, error } = await db.from("guests").update({ invited_at: new Date().toISOString(), invitation_claim_id: null, invitation_claimed_at: null })
        .eq("id", guest.id).eq("event_id", eventId).eq("email", guest.email).eq("invitation_claim_id", claimId).select("id").maybeSingle();
      if (error || !updated) unrecorded++;
      else sent++;
    } catch {
      unrecorded++;
    }
  }
  revalidatePath("/admin");
  const result = new URLSearchParams({ event: eventId, notice: "emailResult", sent: String(sent), failed: String(failed), unrecorded: String(unrecorded) });
  redirect(`/admin?${result}`);
}
