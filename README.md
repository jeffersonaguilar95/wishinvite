# Wishvite

A self-hosted invitation and gift list application. It includes guest invitations and an admin panel.

## Project status

Wishvite is in **alpha** and under active development. Features, configuration, and database migrations may change before the first stable release.

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

## Supabase integration tests

These tests write isolated fixtures and delete them afterwards. Use a dedicated disposable Supabase project, never production. Apply all migrations to it, then configure `.env.local` with the test project's `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Also set `TEST_SUPABASE_URL` to the same test project URL, `TEST_SUPABASE_SERVICE_ROLE_KEY` to its server key, `TEST_APP_URL=http://localhost:3000`, and `TEST_ALLOW_DATABASE_WRITES=true`. Start the app with `npm run dev` in another terminal, and run:

```sh
npm run test:integration
```

The suite sends concurrent reservation requests, checks invalid-token database operations and HTTP 404s, and checks that a past deadline prevents RSVP updates. `npm test` runs the offline unit tests only. If a test run is interrupted, its test event and related records may need manual cleanup in the test project.

## Deploy to Vercel

1. Push this repository to a Git provider supported by Vercel. Create a **new** Supabase production project, and note its project reference, project URL, publishable key and secret key from **Settings → API Keys** (legacy `anon` and `service_role` keys are also supported).
2. Install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started). In the repository root, run the following; run `supabase init` only if `supabase/config.toml` does not already exist. Confirm the project reference carefully before pushing:

   ```sh
   supabase init
   supabase login
   supabase link --project-ref <production-project-ref>
   supabase db push --dry-run --remote
   supabase db push --remote
   ```

   This applies the migrations and creates the private `invitations` Storage bucket. Do not use `--include-seed` for production. If the project already has a schema or migration history, reconcile it before applying these migrations.
3. In Resend, add and verify your sending domain in **Domains**, then create an API key in **API Keys**. Choose an address on that domain as the sender. Resend is optional for guest invitations; leave its two variables unset to use copied links instead.
4. In Vercel, create a project by importing the Git repository, select the Next.js framework and the repository root, and use Node.js 22 or newer. Under **Settings → Environment Variables**, add the following for **Production**:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase production project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable (or legacy anon) key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret (or legacy service-role) key; server only |
   | `ADMIN_EMAIL` | The one email address allowed into `/admin` |
   | `NEXT_PUBLIC_APP_URL` | Final HTTPS origin, for example `https://example.com` |
   | `RESEND_API_KEY` | Resend API key, if using invitation email |
   | `RESEND_FROM_EMAIL` | Verified sender address, if using invitation email |

   Do not put test variables or the service key in public variables. Deploy the production branch. If the final Vercel domain was not known beforehand, set `NEXT_PUBLIC_APP_URL` to the final HTTPS origin and redeploy after it is known. Changes to environment variables require a new deployment.
5. In Supabase **Authentication → URL Configuration**, set **Site URL** to the same production origin and add `https://<your-domain>/admin/auth/callback` to **Redirect URLs**. Enable email sign-in. Configure custom SMTP under Authentication for reliable magic-link delivery; Resend's Supabase integration is one option. Supabase's default mail service restricts recipients and is not intended for production. Auth SMTP is separate from the app's Resend API settings.
6. Visit `https://<your-domain>/admin`, request a magic link for `ADMIN_EMAIL`, and open it in the same browser. Create an event, upload its image, set the deadline, add guests and gifts, and verify a guest link and RSVP. If Resend is configured, send a test invitation to an address you control. Test deployments should use their own Supabase project, keys, admin email and app URL rather than production credentials.

References: [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations), [Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp), and [Vercel Git deployments](https://vercel.com/docs/git).
