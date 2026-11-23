# Wishvite

A self-hosted invitation and gift list application. It includes guest invitations and an admin panel.

## Local setup

1. Install Node.js 22.13 or newer and npm.
2. Run `npm install`.
3. Create a Supabase project and copy its project URL and anon (publishable) key from its API settings.
4. Copy `.env.example` to `.env.local` and fill in the Supabase URL and anon key. Set the service role key and admin email when configuring server-side administration; keep the service role key secret. The Resend variables are optional and will only be needed for email sending.
5. Run `npm run dev` and open http://localhost:3000.

Run `npm run lint`, `npm run typecheck` and `npm test` to check the code. The database migration is in `supabase/migrations`, and `supabase/seed.sql` contains fictional local development data. Apply the migration before the seed using a Supabase development database; do not seed a production database. Invitation emails can optionally be sent through Resend. Guest tokens in the seed are randomly generated and can be inspected in the local database.

## Git hooks

Run `npm run hooks:install` once in each clone to enable the tracked pre-commit hook. It runs lint and typecheck before each commit; both must pass. The command sets this repository's `core.hooksPath` to `.githooks`.

## Guest invitations

Apply all migrations before using a guest link at `/i/<token>`. Set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` on the server. The invitation image path is a Storage object path in a private bucket named `invitations`; the migration creates this bucket and the admin panel uploads images to it. A missing image path is allowed. RSVP deadlines are stored as timestamps with time zones; an unset deadline leaves RSVP changes open. Guests can release a reservation before selecting another gift.

## Administration

Apply all migrations, set `ADMIN_EMAIL`, `NEXT_PUBLIC_APP_URL`, the Supabase URL and anon key, and the service-role key in `.env.local`. Enable email sign-in in Supabase Auth and add `<NEXT_PUBLIC_APP_URL>/admin/auth/callback` to its allowed redirect URLs. Configure an email provider for Supabase Auth; this is separate from the optional Resend invitation-email settings. Open `/admin` and request a magic link using `ADMIN_EMAIL`. The Supabase Auth site URL and `NEXT_PUBLIC_APP_URL` should match the deployed origin.

The panel can create and select events, update invitation text and image, and manage guests and gifts. Deadline inputs are in UTC. A guest with a reserved gift cannot be deleted until the guest releases it; deleting a gift also removes its reservation. Images are limited to 4 MB. The browser clipboard requires a secure context (HTTPS or localhost); the displayed link can also be copied manually.

## Sending invitations

Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to enable invitation emails. The sender address must use a domain verified with Resend. Upload an invitation image before sending; it is embedded in each Spanish email alongside the personal link. The bulk button sends only to guests with an email address and no recorded `invited_at`; the per-guest button sends again and updates that timestamp after Resend accepts the message. Without Resend configuration, copying links remains available.

The result distinguishes accepted and recorded messages, failures or missing responses, and accepted messages that could not be recorded. A missing response may still mean Resend accepted the email; check the Resend dashboard before retrying failures or unrecorded sends to avoid duplicates. Acceptance is not a delivery confirmation. The bulk action sends sequentially, so very large lists may exceed the hosting provider's request timeout; rerun it for guests still unmarked after checking Resend.
