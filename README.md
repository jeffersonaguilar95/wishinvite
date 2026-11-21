# Wishvite

A self-hosted invitation and gift list application. This repository currently contains the application scaffold; invitation and administration features are not implemented yet.

## Local setup

1. Install Node.js 22.13 or newer and npm.
2. Run `npm install`.
3. Create a Supabase project and copy its project URL and anon (publishable) key from its API settings.
4. Copy `.env.example` to `.env.local` and fill in the Supabase URL and anon key. Set the service role key and admin email when configuring server-side administration; keep the service role key secret. The Resend variables are optional and will only be needed for email sending.
5. Run `npm run dev` and open http://localhost:3000.

Run `npm run lint` and `npm run typecheck` to check the code. Supabase schema migrations, authentication and email sending will be added in later phases.

## Git hooks

Run `npm run hooks:install` once in each clone to enable the tracked pre-commit hook. It runs lint and typecheck before each commit; both must pass. The command sets this repository's `core.hooksPath` to `.githooks`.
