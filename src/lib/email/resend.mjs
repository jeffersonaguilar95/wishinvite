import { invitationEmail } from "./invitation.mjs";

/**
 * @param {{apiKey: string, from: string, to: string, family: string, title: string, content: string | null, link: string, image: string, imageType: string}} options
 * @param {typeof fetch} request
 */
export async function sendInvitation(options, request = fetch) {
  const email = invitationEmail(options);
  const response = await request("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: options.from,
      to: [options.to],
      ...email,
      attachments: [{ filename: "invitacion", content: options.image, content_type: options.imageType, content_id: "invitacion" }],
    }),
  });
  if (!response.ok) return false;
  const body = await response.json();
  return typeof body.id === "string" && body.id.length > 0;
}
