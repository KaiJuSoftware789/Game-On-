-- Integration checks against the migrated local database. Every fixture rolls back.
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('c0110000-0000-4000-8000-000000000001', 'game-on-check-one@example.invalid', '{"name":"Test Player One"}'),
  ('c0110000-0000-4000-8000-000000000002', 'game-on-check-two@example.invalid', '{"name":"Test Player Two"}');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0110000-0000-4000-8000-000000000001', true);
select public.save_my_games(array(select id from public.games order by id limit 2));
do $$ begin
  assert (select count(*) from public.user_games where user_id = auth.uid()) = 2, 'Owner can save games';
  begin
    perform public.save_my_games(array[-1::bigint]);
    raise exception 'Invalid game unexpectedly saved';
  exception when foreign_key_violation then null;
  end;
  assert (select count(*) from public.user_games where user_id = auth.uid()) = 2, 'Failed save keeps previous selections';
  begin
    insert into public.user_games (user_id, game_id) values ('c0110000-0000-4000-8000-000000000002', (select min(id) from public.games));
    raise exception 'Cross-account write unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

insert into public.tickets (game_id, title, description, players_needed, region, invite_url)
values ((select min(id) from public.games), 'Integration check session', '', 2, 'Any region', 'https://example.invalid/invite');
do $$ begin
  assert (select count(*) from public.tickets where host_id = auth.uid() and status = 'open' and expires_at > now()) = 1, 'New ticket is live';
  begin
    update public.tickets set host_id = 'c0110000-0000-4000-8000-000000000002' where host_id = auth.uid();
    raise exception 'Ownership rewrite unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', 'c0110000-0000-4000-8000-000000000002', true);
delete from public.user_games where user_id = 'c0110000-0000-4000-8000-000000000001';
update public.tickets set status = 'closed' where host_id = 'c0110000-0000-4000-8000-000000000001';
do $$ begin
  assert (select count(*) from public.user_games where user_id = 'c0110000-0000-4000-8000-000000000001') = 2, 'Other players cannot delete selections';
  assert (select count(*) from public.tickets where host_id = 'c0110000-0000-4000-8000-000000000001' and status = 'open') = 1, 'Other players cannot close tickets';
end $$;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  assert (select count(*) from public.user_games where user_id = 'c0110000-0000-4000-8000-000000000001') = 2, 'Signed-out visitors can read game selections';
  assert (select display_name from public.profiles where id = 'c0110000-0000-4000-8000-000000000001') = 'Test Player One', 'Signed-out visitors can read public names';
  assert not exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'), 'Public profile excludes email';
  assert (select count(*) from public.tickets where host_id = 'c0110000-0000-4000-8000-000000000001') = 1, 'Signed-out visitors can read tickets';
  begin
    perform public.save_my_games(array[]::bigint[]);
    raise exception 'Anonymous save unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0110000-0000-4000-8000-000000000001', true);
update public.tickets set status = 'closed' where host_id = auth.uid();
select public.save_my_games(array[]::bigint[]);
do $$ begin
  assert (select count(*) from public.tickets where host_id = auth.uid() and status = 'open') = 0, 'Owner can close ticket';
  assert (select count(*) from public.user_games where user_id = auth.uid()) = 0, 'Owner can clear all games';
end $$;

reset role;
insert into public.tickets (host_id, game_id, title, players_needed, region, invite_url, created_at, expires_at)
values ('c0110000-0000-4000-8000-000000000001', (select min(id) from public.games), 'Expired test session', 1, 'Any region', 'https://example.invalid/expired', now() - interval '5 hours', now() - interval '1 hour');
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  assert (select count(*) from public.tickets where host_id = 'c0110000-0000-4000-8000-000000000001' and status = 'open' and expires_at > now()) = 0, 'Expired and closed sessions are excluded';
end $$;
rollback;
select 'All ticket and public profile access checks passed.' as result;
