begin;
insert into auth.users(id, raw_user_meta_data) values
('c0110000-0000-4000-8000-000000000099', '{"name":"MFA Test Player"}');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0110000-0000-4000-8000-000000000099', true);
select set_config('request.jwt.claims', '{"sub":"c0110000-0000-4000-8000-000000000099","role":"authenticated","aal":"aal1"}', true);
do $$ begin assert public.has_required_mfa(), 'Unenrolled accounts retain access'; end $$;
reset role;
insert into auth.mfa_factors(id,user_id,friendly_name,factor_type,status,created_at,updated_at)
values('c0110000-0000-4000-8000-000000000098','c0110000-0000-4000-8000-000000000099','Test passkey','webauthn','verified',now(),now());
set local role authenticated;
do $$ begin
  assert not public.has_required_mfa(), 'AAL1 cannot bypass enrollment';
  assert not exists(select 1 from public.profiles), 'RLS blocks pending MFA';
  begin
    perform public.require_mfa();
    raise exception 'Pre-request check allowed unverified MFA';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims', '{"sub":"c0110000-0000-4000-8000-000000000099","role":"authenticated","aal":"aal2"}', true);
do $$ begin
  assert public.has_required_mfa(), 'Verified AAL2 gains access';
  perform public.require_mfa();
  assert exists(select 1 from public.profiles where id = auth.uid()), 'Verified user can read profile';
end $$;
reset role;
delete from auth.mfa_factors where user_id='c0110000-0000-4000-8000-000000000099';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0110000-0000-4000-8000-000000000099","role":"authenticated","aal":"aal1"}', true);
do $$ begin assert public.has_required_mfa(), 'Unenrollment restores AAL1 access'; end $$;
rollback;
