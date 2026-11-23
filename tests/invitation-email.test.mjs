import test from "node:test";
import assert from "node:assert/strict";
import { invitationEmail } from "../src/lib/email/invitation.mjs";

test("email escapes host and guest content and keeps a plain-text link", () => {
  const email = invitationEmail({ family: '<script>alert("x")</script>', title: "Fiesta & amigos", content: "Hola <familia>", link: 'https://example.test/i/a?x=1&y=2' });
  assert.match(email.html, /&lt;script&gt;/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /Fiesta &amp; amigos/);
  assert.match(email.html, /x=1&amp;y=2/);
  assert.match(email.html, /cid:invitacion/);
  assert.match(email.text, /https:\/\/example\.test\/i\/a\?x=1&y=2/);
});

test("email accepts an empty invitation description", () => {
  const email = invitationEmail({ family: "Ejemplo", title: "Fiesta", content: null, link: "https://example.test/i/token" });
  assert.match(email.text, /Hola, familia Ejemplo/);
  assert.doesNotMatch(email.text, /null/);
});

test("Resend request embeds the image and reports accepted and rejected sends", async () => {
  const { sendInvitation } = await import("../src/lib/email/resend.mjs");
  const options = { apiKey: "test-key", from: "host@example.test", to: "guest@example.test", family: "Ejemplo", title: "Fiesta", content: null, link: "https://example.test/i/token", image: "aW1hZ2U=", imageType: "image/png" };
  let payload;
  const accepted = await sendInvitation(options, async (_url, init) => {
    payload = JSON.parse(init.body);
    return new Response(JSON.stringify({ id: "email-id" }), { status: 200 });
  });
  assert.equal(accepted, true);
  assert.deepEqual(payload.to, ["guest@example.test"]);
  assert.equal(payload.attachments[0].content_id, "invitacion");
  assert.equal(payload.attachments[0].content, options.image);
  assert.equal(await sendInvitation(options, async () => new Response("error", { status: 429 })), false);
  assert.equal(await sendInvitation(options, async () => new Response("{}", { status: 200 })), false);
});
