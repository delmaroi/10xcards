-- Development seed data for 10xCards (F-01)
-- Inserts one sample set and three flashcards for the first user found in
-- auth.users. On a fresh instance with no users it exits silently; sign up a
-- user, then re-apply this seed (or insert data manually).

do $$
declare
  dev_user_id uuid;
  new_set_id uuid;
begin
  select id into dev_user_id from auth.users limit 1;

  if dev_user_id is null then
    raise notice 'seed: no user in auth.users, skipping sample data';
    return;
  end if;

  if exists (
    select 1 from public.sets
    where user_id = dev_user_id and name = 'Sample: Polish Basics'
  ) then
    raise notice 'seed: sample data already present, skipping';
    return;
  end if;

  insert into public.sets (user_id, name)
  values (dev_user_id, 'Sample: Polish Basics')
  returning id into new_set_id;

  insert into public.flashcards (set_id, front, back) values
    (new_set_id, 'dom', 'house'),
    (new_set_id, 'kot', 'cat'),
    (new_set_id, 'woda', 'water');
end $$;
