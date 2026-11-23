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

export async function saveGuest(data: FormData) {
  const eventId = await authorizedEvent(data);
  const guestId = text(data, "guestId");
  const name = text(data, "name");
  const email = text(data, "email", 254);
  if (!name || email === null || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      (guestId && !uuid.test(guestId))) finish(eventId, "invalid");
  const db = createServiceClient();
  const values = { display_name: name, email: email || null, updated_at: new Date().toISOString() };
  const query = guestId ? db.from("guests").update(values).eq("id", guestId).eq("event_id", eventId)
    : db.from("guests").insert({ ...values, event_id: eventId });
  const { data: changed, error } = await query.select("id").maybeSingle();
  if (error || !changed) finish(eventId, "error");
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

export async function saveGift(data: FormData) {
  const eventId = await authorizedEvent(data);
  const giftId = text(data, "giftId");
  const name = text(data, "name");
  const description = text(data, "description", 2000);
  const url = text(data, "url", 2000);
  if (!name || description === null || url === null || (giftId && !uuid.test(giftId))) finish(eventId, "invalid");
  if (url) {
    try { if (!["http:", "https:"].includes(new URL(url).protocol)) finish(eventId, "invalid"); }
    catch { finish(eventId, "invalid"); }
  }
  const db = createServiceClient();
  const values = { name, description: description || null, url: url || null, updated_at: new Date().toISOString() };
  const query = giftId ? db.from("gifts").update(values).eq("id", giftId).eq("event_id", eventId)
    : db.from("gifts").insert({ ...values, event_id: eventId });
  const { data: changed, error } = await query.select("id").maybeSingle();
  if (error || !changed) finish(eventId, "error");
  finish(eventId, "saved");
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
