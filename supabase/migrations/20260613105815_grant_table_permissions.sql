-- Grant table-level permissions to anon and authenticated roles.
-- GRANT controls whether a role can touch the table at all;
-- RLS policies control which rows. Both layers must pass.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.sets to authenticated;
grant select                          on public.sets to anon;

grant select, insert, update, delete on public.flashcards to authenticated;
grant select                          on public.flashcards to anon;

grant select, insert on public.reviews to authenticated;
