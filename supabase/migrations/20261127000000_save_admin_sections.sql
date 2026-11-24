create function public.save_event_guests(p_event_id uuid, p_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_count integer;
begin
  update public.guests as guest
  set display_name = row.name, email = row.email, updated_at = now()
  from jsonb_to_recordset(p_rows) as row(id uuid, name text, email text)
  where guest.id = row.id and guest.event_id = p_event_id;

  get diagnostics updated_count = row_count;
  if updated_count <> (
    select count(*) from jsonb_to_recordset(p_rows) as row(id uuid) where row.id is not null
  ) then
    raise exception 'Guest rows changed or belong to another event';
  end if;

  insert into public.guests (event_id, display_name, email)
  select p_event_id, row.name, row.email
  from jsonb_to_recordset(p_rows) as row(id uuid, name text, email text)
  where row.id is null;
end;
$$;

create function public.save_event_gifts(p_event_id uuid, p_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_count integer;
begin
  update public.gifts as gift
  set name = row.name, description = row.description, url = row.url, updated_at = now()
  from jsonb_to_recordset(p_rows) as row(id uuid, name text, description text, url text)
  where gift.id = row.id and gift.event_id = p_event_id;

  get diagnostics updated_count = row_count;
  if updated_count <> (
    select count(*) from jsonb_to_recordset(p_rows) as row(id uuid) where row.id is not null
  ) then
    raise exception 'Gift rows changed or belong to another event';
  end if;

  insert into public.gifts (event_id, name, description, url)
  select p_event_id, row.name, row.description, row.url
  from jsonb_to_recordset(p_rows) as row(id uuid, name text, description text, url text)
  where row.id is null;
end;
$$;

revoke all on function public.save_event_guests(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.save_event_gifts(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_event_guests(uuid, jsonb) to service_role;
grant execute on function public.save_event_gifts(uuid, jsonb) to service_role;
