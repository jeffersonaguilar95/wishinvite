"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { redirectWithNotice } from "@/lib/flash-notice";
import { createServiceClient } from "@/lib/supabase/service";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function validateGuest(token: string) {
  if (token.length < 22 || token.length > 256) notFound();
  const { data, error } = await createServiceClient()
    .from("guests").select("id").eq("token", token).maybeSingle();
  if (error) throw new Error("Unable to verify guest");
  if (!data) notFound();
}

function finish(token: string, notice: string): Promise<never> {
  const path = `/i/${encodeURIComponent(token)}`;
  revalidatePath(path);
  return redirectWithNotice("invitation", path, notice);
}

export async function updateRsvp(token: string, formData: FormData) {
  await validateGuest(token);
  const status = formData.get("status");
  if (status !== "yes" && status !== "no" && status !== "other") return finish(token, "failed");
  const { data, error } = await createServiceClient().rpc("update_rsvp", {
    p_token: token, p_status: status,
  });
  if (error) return finish(token, "failed");
  return finish(token, data ? "saved" : "deadlinePassed");
}

export async function changeReservation(token: string, formData: FormData) {
  await validateGuest(token);
  const giftId = formData.get("giftId");
  const operation = formData.get("operation");
  if (typeof giftId !== "string" || !uuidPattern.test(giftId) ||
      (operation !== "reserve" && operation !== "release")) return finish(token, "failed");

  const { data, error } = await createServiceClient().rpc(
    operation === "reserve" ? "reserve_gift" : "release_gift",
    { p_token: token, p_gift_id: giftId },
  );
  if (error) return finish(token, error.code === "23505" ? "alreadyReserved" : "failed");
  if (!data) return finish(token, operation === "reserve" ? "taken" : "failed");
  return finish(token, operation === "reserve" ? "reservedSuccess" : "released");
}

export async function reserveCustomGift(token: string, formData: FormData) {
  await validateGuest(token);
  const value = formData.get("name");
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 200) return finish(token, "failed");

  const { data, error } = await createServiceClient().rpc("reserve_custom_gift", {
    p_token: token, p_name: name,
  });
  if (error) return finish(token, error.code === "23505" ? "alreadyReserved" : "failed");
  return finish(token, data ? "reservedSuccess" : "failed");
}
