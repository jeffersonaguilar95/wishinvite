import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const { TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_ROLE_KEY, TEST_APP_URL, TEST_ALLOW_DATABASE_WRITES } = process.env;
if (!TEST_SUPABASE_URL || !TEST_SUPABASE_SERVICE_ROLE_KEY || !TEST_APP_URL || TEST_ALLOW_DATABASE_WRITES !== "true") {
  throw new Error("Set TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_ROLE_KEY, TEST_APP_URL and TEST_ALLOW_DATABASE_WRITES=true for an isolated test project in .env.local");
}
const db = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const eventId = randomUUID();
const giftId = randomUUID();
const guestIds = [randomUUID(), randomUUID()];
const tokens = [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")];
const missingToken = randomBytes(32).toString("hex");
let created = false;

function check(result) {
  if (result.error) throw new Error(`Supabase test operation failed: ${result.error.message}`);
  return result.data;
}

before(async () => {
  check(await db.from("events").insert({ id: eventId, title: "Integration test", rsvp_deadline: "2000-01-01T00:00:00Z" }));
  created = true;
  check(await db.from("guests").insert(guestIds.map((id, index) => ({
    id, event_id: eventId, display_name: `Test family ${index}`, token: tokens[index],
  }))));
  check(await db.from("gifts").insert({ id: giftId, event_id: eventId, name: "Test gift" }));
});

after(async () => {
  if (!created) return;
  // Delete gifts first, then guests, because a reservation references a guest.
  check(await db.from("gifts").delete().eq("event_id", eventId));
  check(await db.from("guests").delete().eq("event_id", eventId));
  check(await db.from("events").delete().eq("id", eventId));
});

test("invalid tokens cannot reserve, release, or update an RSVP", async () => {
  assert.equal(check(await db.rpc("reserve_gift", { p_token: missingToken, p_gift_id: giftId })), false);
  assert.equal(check(await db.rpc("release_gift", { p_token: missingToken, p_gift_id: giftId })), false);
  assert.equal(check(await db.rpc("update_rsvp", { p_token: missingToken, p_status: "yes" })), false);
  const gift = check(await db.from("gifts").select("reserved_by_guest_id").eq("id", giftId).single());
  assert.equal(gift.reserved_by_guest_id, null);
});

test("invalid invitation links return 404", async () => {
  for (const token of ["invalid", missingToken]) {
    const response = await fetch(new URL(`/i/${token}`, TEST_APP_URL), { redirect: "manual" });
    assert.equal(response.status, 404);
  }
});

test("two simultaneous reservations for one gift yield exactly one winner", async () => {
  const results = await Promise.all(tokens.map(token => db.rpc("reserve_gift", { p_token: token, p_gift_id: giftId })));
  const outcomes = results.map(check);
  assert.deepEqual(outcomes.slice().sort(), [false, true]);
  const gift = check(await db.from("gifts").select("reserved_by_guest_id").eq("id", giftId).single());
  assert.equal(gift.reserved_by_guest_id, guestIds[outcomes.indexOf(true)]);
});

test("RSVP updates after the deadline leave the original status unchanged", async () => {
  assert.equal(check(await db.rpc("update_rsvp", { p_token: tokens[0], p_status: "yes" })), false);
  const guest = check(await db.from("guests").select("rsvp_status").eq("id", guestIds[0]).single());
  assert.equal(guest.rsvp_status, "pending");
});
