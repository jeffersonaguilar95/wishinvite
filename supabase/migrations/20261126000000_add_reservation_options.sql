alter table public.guests drop constraint guests_rsvp_status_check;
alter table public.guests add constraint guests_rsvp_status_check
  check (rsvp_status in ('pending', 'yes', 'no', 'other'));

alter table public.gifts add column is_custom boolean not null default false;

-- The deadline is checked in the same statement that saves the RSVP.
create or replace function public.update_rsvp(p_token text, p_status text)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with updated as (
    update public.guests as guest
    set rsvp_status = p_status, updated_at = now()
    from public.events as event
    where guest.token = p_token
      and event.id = guest.event_id
      and p_status in ('yes', 'no', 'other')
      and (event.rsvp_deadline is null or event.rsvp_deadline > statement_timestamp())
    returning guest.id
  )
  select exists (select 1 from updated);
$$;

create function public.reserve_custom_gift(p_token text, p_name text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_gift_id uuid;
begin
  if p_name is null or char_length(btrim(p_name)) not between 1 and 200 then
    return false;
  end if;

  insert into public.gifts (event_id, name, is_custom)
  select guest.event_id, btrim(p_name), true
  from public.guests as guest
  where guest.token = p_token
  returning id into new_gift_id;

  if new_gift_id is null then
    return false;
  end if;

  -- Use the catalogue reservation's conditional update and unique constraint.
  -- If the update fails, the transaction also rolls back the insert.
  if not public.reserve_gift(p_token, new_gift_id) then
    raise exception 'Unable to reserve custom gift';
  end if;
  return true;
end;
$$;

create or replace function public.release_gift(p_token text, p_gift_id uuid)
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
      and not gift.is_custom
    returning gift.id
  ), removed as (
    delete from public.gifts as gift
    using public.guests as guest
    where guest.token = p_token
      and gift.id = p_gift_id
      and gift.event_id = guest.event_id
      and gift.reserved_by_guest_id = guest.id
      and gift.is_custom
    returning gift.id
  )
  select exists (select 1 from release) or exists (select 1 from removed);
$$;

revoke all on function public.reserve_custom_gift(text, text) from public, anon, authenticated;
grant execute on function public.reserve_custom_gift(text, text) to service_role;
