# Wishvite

A self-hosted invitation and gift list application. This repository currently contains the application scaffold; invitation and administration features are not implemented yet.

## Local setup

1. Install Node.js 22.13 or newer and npm.
2. Run `npm install`.
3. Create a Supabase project and copy its project URL and anon (publishable) key from its API settings.
4. Copy `.env.example` to `.env.local` and fill in the Supabase URL and anon key. Set the service role key and admin email when configuring server-side administration; keep the service role key secret. The Resend variables are optional and will only be needed for email sending.
5. Run `npm run dev` and open http://localhost:3000.

Run `npm run lint` and `npm run typecheck` to check the code. The database migration is in `supabase/migrations`, and `supabase/seed.sql` contains fictional local development data. Apply the migration before the seed using a Supabase development database; do not seed a production database. Authentication and email sending will be added in later phases. Guest tokens in the seed are randomly generated and can be inspected in the local database.

## Git hooks

Run `npm run hooks:install` once in each clone to enable the tracked pre-commit hook. It runs lint and typecheck before each commit; both must pass. The command sets this repository's `core.hooksPath` to `.githooks`.

## Guest invitations

Apply all migrations before using a guest link at `/i/<token>`. Set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` on the server. The invitation image path is a Storage object path in a private bucket named `invitations`; create this bucket and upload an image before setting the event path. A missing image path is allowed. RSVP deadlines are stored as timestamps with time zones; an unset deadline leaves RSVP changes open. Guests can release a reservation before selecting another gift.
