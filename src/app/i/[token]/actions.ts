"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function validateGuest(token: string) {
  if (token.length < 22 || token.length > 256) notFound();
  const { data, error } = await createServiceClient()
    .from("guests").select("id").eq("token", token).maybeSingle();
  if (error) throw new Error("Unable to verify guest");
  if (!data) notFound();
}

function finish(token: string, notice: string): never {
  const path = `/i/${encodeURIComponent(token)}`;
  revalidatePath(path);
  redirect(`${path}?notice=${notice}`);
}

export async function updateRsvp(token: string, formData: FormData) {
  await validateGuest(token);
  const status = formData.get("status");
  if (status !== "yes" && status !== "no") finish(token, "failed");
  const { data, error } = await createServiceClient().rpc("update_rsvp", {
    p_token: token, p_status: status,
  });
  if (error) finish(token, "failed");
  finish(token, data ? "saved" : "deadlinePassed");
}

export async function changeReservation(token: string, formData: FormData) {
  await validateGuest(token);
  const giftId = formData.get("giftId");
  const operation = formData.get("operation");
  if (typeof giftId !== "string" || !uuidPattern.test(giftId) ||
      (operation !== "reserve" && operation !== "release")) finish(token, "failed");

  const { data, error } = await createServiceClient().rpc(
    operation === "reserve" ? "reserve_gift" : "release_gift",
    { p_token: token, p_gift_id: giftId },
  );
  if (error) finish(token, error.code === "23505" ? "alreadyReserved" : "failed");
  if (!data) finish(token, operation === "reserve" ? "taken" : "failed");
  finish(token, operation === "reserve" ? "reservedSuccess" : "released");
}
