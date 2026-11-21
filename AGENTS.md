# Birthday invitation + gift list

## Goal
Simple web app. Each invited family gets a personal link (/i/<token>),
sees the invitation image, confirms attendance (yes/no, no headcount)
and reserves ONE gift from a list. Two guests must never reserve the same gift.
The host manages guests, gifts and sending from /admin.

## Stack
- Next.js (App Router) + TypeScript (strict)
- Supabase: Postgres, Auth (magic link, only ADMIN_EMAIL can access /admin), Storage
- Resend for email
- Tailwind CSS
- Deploy on Vercel

## Rules
- Keep it simple. Do not add dependencies unless necessary; ask first.
- Mobile-first UI. Guest-facing texts in Spanish (Spain).
- Code, identifiers and commits in English.
- Gift reservation MUST be a single conditional UPDATE
  (WHERE reserved_by_guest_id IS NULL). Never check-then-write.
- Guests never see who reserved a gift. Only the host does.
- Guest tokens: random, >= 22 chars, never sequential ids in URLs.
- All DB access for guests goes through server actions/route handlers
  using the token; never expose the service role key to the client.
- Database changes only via SQL migrations in supabase/migrations.
- Secrets only in .env.local; keep .env.example updated.
- Open source (MIT) and self-hosted: no personal data or hardcoded texts in code;
  everything configurable via env vars or the admin panel. UI texts via i18n (es, en).
- Email is optional: without RESEND_API_KEY the admin only copies links.

## Workflow
- Before coding a phase, propose a short plan and wait for approval.
- After each change: run lint, typecheck and tests; fix failures.
- Small commits with clear messages.