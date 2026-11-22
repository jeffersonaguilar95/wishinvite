-- Fictional local development data. Guest tokens are generated randomly.
insert into public.events (id, title, invitation_content, locale)
values ('00000000-0000-4000-8000-000000000001', 'Example celebration', 'Example invitation', 'en');

insert into public.guests (event_id, display_name)
values
  ('00000000-0000-4000-8000-000000000001', 'Example family 1'),
  ('00000000-0000-4000-8000-000000000001', 'Example family 2'),
  ('00000000-0000-4000-8000-000000000001', 'Example family 3');

insert into public.gifts (event_id, name)
values
  ('00000000-0000-4000-8000-000000000001', 'Example gift 1'),
  ('00000000-0000-4000-8000-000000000001', 'Example gift 2'),
  ('00000000-0000-4000-8000-000000000001', 'Example gift 3'),
  ('00000000-0000-4000-8000-000000000001', 'Example gift 4'),
  ('00000000-0000-4000-8000-000000000001', 'Example gift 5');
