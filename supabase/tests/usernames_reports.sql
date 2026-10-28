begin;
insert into auth.users(id,email,raw_user_meta_data) values
('c0330000-0000-4000-8000-000000000001','names-one@example.invalid','{"name":"One"}'),
('c0330000-0000-4000-8000-000000000002','names-two@example.invalid','{"name":"Two"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0330000-0000-4000-8000-000000000001',true);
select public.set_player_name('  Space Ranger_42  ');
do $$ begin
 assert (select display_name from public.profiles where id=auth.uid()) = 'Space Ranger_42';
 assert public.valid_player_name('Night-Owl.7');
 assert not public.valid_player_name('f.u.c.k');
 assert not public.valid_player_name('sh1t');
 assert not public.valid_player_name('ab');
 assert not public.valid_player_name(repeat('a',33));
 begin
  perform public.set_player_name('f.u.c.k');
  raise exception 'Invalid name accepted' using errcode='XX000';
 exception when raise_exception then null; end;
 begin
  update public.profiles set display_name='Stolen' where id='c0330000-0000-4000-8000-000000000002';
  raise exception 'Direct update allowed';
 exception when insufficient_privilege then null; end;
end $$;
select public.report_player('c0330000-0000-4000-8000-000000000002','harassment','Test report');
do $$ begin
 begin
  perform public.report_player(auth.uid(),'spam','');
  raise exception 'Self report allowed' using errcode='XX000';
 exception when raise_exception then null; end;
 begin
  perform public.report_player('c0330000-0000-4000-8000-000000000002','harassment','Duplicate');
  raise exception 'Duplicate allowed' using errcode='XX000';
 exception when raise_exception then null; end;
 begin
  perform public.report_player('c0330000-0000-4000-8000-000000000002','invalid','');
  raise exception 'Invalid reason allowed';
 exception when check_violation then null; end;
 begin
  perform public.report_player('c0330000-0000-4000-8000-000000000002','spam',repeat('a',2001));
  raise exception 'Oversize details allowed';
 exception when check_violation then null; end;
 begin
  perform * from public.player_reports;
  raise exception 'Reports readable by user';
 exception when insufficient_privilege then null; end;
end $$;
select public.report_player('c0330000-0000-4000-8000-000000000002','spam','');
select public.report_player('c0330000-0000-4000-8000-000000000002','scam','');
select public.report_player('c0330000-0000-4000-8000-000000000002','threats','');
select public.report_player('c0330000-0000-4000-8000-000000000002','other','');
do $$ begin
 begin
  perform public.report_player('c0330000-0000-4000-8000-000000000002','privacy','');
  raise exception 'Daily cap bypassed' using errcode='XX000';
 exception when raise_exception then null; end;
end $$;
select set_config('request.jwt.claim.sub','c0330000-0000-4000-8000-000000000002',true);
do $$ begin
 begin
  perform * from public.player_reports;
  raise exception 'Reported player can read reports';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 assert (select count(*) from public.player_reports where reporter_id='c0330000-0000-4000-8000-000000000001')=5;
 assert (select display_name from public.profiles where id='c0330000-0000-4000-8000-000000000002')='Two';
end $$;
set local role anon;
do $$ begin
 begin
  perform public.set_player_name('Anonymous');
  raise exception 'Anonymous rename allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.report_player('c0330000-0000-4000-8000-000000000002','spam','');
  raise exception 'Anonymous report allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Username validation, ownership, report privacy and abuse limits passed' as result;
