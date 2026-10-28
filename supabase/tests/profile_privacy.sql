begin;
insert into auth.users(id,email) values
('c0440000-0000-4000-8000-000000000001','privacy1@example.invalid'),
('c0440000-0000-4000-8000-000000000002','privacy2@example.invalid'),
('c0440000-0000-4000-8000-000000000003','privacy3@example.invalid');
insert into public.user_games(user_id,game_id) select 'c0440000-0000-4000-8000-000000000001',id from public.games limit 1;
set local role authenticated;
select set_config('request.jwt.claim.sub','c0440000-0000-4000-8000-000000000001',true);
select public.set_player_bio('Private test bio');
select public.set_profile_privacy('private','friends');
do $$ begin
 assert (select count(*) from public.profile_details where user_id=auth.uid())=1;
 assert public.can_view_profile(auth.uid());
end $$;
insert into public.friendships(recipient_id) values('c0440000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','c0440000-0000-4000-8000-000000000002',true);
do $$ begin
 assert not public.can_view_profile('c0440000-0000-4000-8000-000000000001');
 assert (select count(*) from public.profile_details where user_id='c0440000-0000-4000-8000-000000000001')=0;
 assert (select count(*) from public.user_games where user_id='c0440000-0000-4000-8000-000000000001')=0;
end $$;
select public.accept_friend_request(id) from public.friendships where requester_id='c0440000-0000-4000-8000-000000000001';
do $$ begin
 assert public.can_view_profile('c0440000-0000-4000-8000-000000000001');
 assert (select bio from public.profile_details where user_id='c0440000-0000-4000-8000-000000000001')='Private test bio';
end $$;
select set_config('request.jwt.claim.sub','c0440000-0000-4000-8000-000000000003',true);
do $$ begin
 assert not public.can_view_profile('c0440000-0000-4000-8000-000000000001');
 begin
  update public.profile_details set visibility='public' where user_id='c0440000-0000-4000-8000-000000000001';
  raise exception 'Direct update allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','c0440000-0000-4000-8000-000000000001',true);
select public.set_profile_privacy('private','only_me');
select set_config('request.jwt.claim.sub','c0440000-0000-4000-8000-000000000002',true);
do $$ begin assert not public.can_view_profile('c0440000-0000-4000-8000-000000000001'); end $$;
select set_config('request.jwt.claim.sub','c0440000-0000-4000-8000-000000000001',true);
select public.set_profile_privacy('public','friends');
reset role;
set local role anon;
do $$ begin
 assert public.can_view_profile('c0440000-0000-4000-8000-000000000001');
 assert (select bio from public.profile_details where user_id='c0440000-0000-4000-8000-000000000001')='Private test bio';
 begin
  perform public.set_profile_privacy('public','friends');
  raise exception 'Anonymous preference write allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Profile privacy, friend approval, owner-only mode and public access passed' as result;
