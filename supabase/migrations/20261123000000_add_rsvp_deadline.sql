alter table public.events add column rsvp_deadline timestamptz;

-- The deadline is checked in the same statement that saves the RSVP.
create function public.update_rsvp(p_token text, p_status text)
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
      and p_status in ('yes', 'no')
      and (event.rsvp_deadline is null or event.rsvp_deadline > statement_timestamp())
    returning guest.id
  )
  select exists (select 1 from updated);
$$;

revoke all on function public.update_rsvp(text, text) from public, anon, authenticated;
grant execute on function public.update_rsvp(text, text) to service_role;
