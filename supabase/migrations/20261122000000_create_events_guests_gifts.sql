-- Guest access is mediated by trusted server code. No table policies are
-- created for anon or authenticated roles; the service role bypasses RLS.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  invitation_content text,
  invitation_image_path text,
  locale text not null default 'es' check (locale in ('es', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  display_name text not null,
  email text,
  token text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  rsvp_status text not null default 'pending' check (rsvp_status in ('pending', 'yes', 'no')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guests_token_unique unique (token),
  constraint guests_token_length check (char_length(token) >= 22),
  constraint guests_id_event_unique unique (id, event_id)
);

create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  url text,
  reserved_by_guest_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gifts_one_per_guest unique (reserved_by_guest_id),
  constraint gifts_reserving_guest_same_event foreign key (reserved_by_guest_id, event_id)
    references public.guests (id, event_id) on delete no action
);

create index guests_event_id_idx on public.guests (event_id);
create index gifts_event_id_idx on public.gifts (event_id);

alter table public.events enable row level security;
alter table public.guests enable row level security;
alter table public.gifts enable row level security;
revoke all on public.events, public.guests, public.gifts from public, anon, authenticated;
grant all on public.events, public.guests, public.gifts to service_role;

-- A unique violation means this guest already holds another gift. A false
-- result means the token or gift is invalid, or the gift is unavailable.
create function public.reserve_gift(p_token text, p_gift_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with reservation as (
    update public.gifts as gift
    set reserved_by_guest_id = guest.id, updated_at = now()
    from public.guests as guest
    where guest.token = p_token
      and gift.id = p_gift_id
      and gift.event_id = guest.event_id
      and gift.reserved_by_guest_id is null
    returning gift.id
  )
  select exists (select 1 from reservation);
$$;

create function public.release_gift(p_token text, p_gift_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with release as (
    update public.gifts as gift
    set reserved_by_guest_id = null, updated_at = now()
    from public.guests as guest
    where guest.token = p_token
      and gift.id = p_gift_id
      and gift.event_id = guest.event_id
      and gift.reserved_by_guest_id = guest.id
    returning gift.id
  )
  select exists (select 1 from release);
$$;

revoke all on function public.reserve_gift(text, uuid) from public, anon, authenticated;
revoke all on function public.release_gift(text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_gift(text, uuid) to service_role;
grant execute on function public.release_gift(text, uuid) to service_role;
