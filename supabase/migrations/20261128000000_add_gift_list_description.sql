alter table public.events add column gift_list_description text;

create function public.save_event_gifts(
  p_event_id uuid,
  p_rows jsonb,
  p_gift_list_description text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.events
  set gift_list_description = p_gift_list_description, updated_at = now()
  where id = p_event_id;

  if not found then
    raise exception 'Event not found';
  end if;

  perform public.save_event_gifts(p_event_id, p_rows);
end;
$$;

revoke all on function public.save_event_gifts(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.save_event_gifts(uuid, jsonb, text) to service_role;
