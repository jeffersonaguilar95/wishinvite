-- The service role performs uploads and signs URLs after server-side checks.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invitations', 'invitations', false, 4194304,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
