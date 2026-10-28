begin;
insert into auth.users(id,raw_user_meta_data) values('c0110000-0000-4000-8000-000000000077','{"name":"Account Edit Test"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0110000-0000-4000-8000-000000000077',true);
select set_config('request.jwt.claims',jsonb_build_object('sub',auth.uid(),'session_id','original','aal','aal1','amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint)))::text,true);
select set_config('test.challenge',public.begin_account_edit()::text,true);
do $$ begin
  begin
    perform public.authorize_account_edit(current_setting('test.challenge')::uuid);
    raise exception 'Original session bypassed reauthentication';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',auth.uid(),'session_id','fresh','aal','aal1','amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint)))::text,true);
select public.check_account_edit_primary(current_setting('test.challenge')::uuid);
reset role;
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) values('c0110000-0000-4000-8000-000000000078','c0110000-0000-4000-8000-000000000077','webauthn','verified',now(),now());
set local role authenticated;
do $$ begin
  begin
    perform public.authorize_account_edit(current_setting('test.challenge')::uuid);
    raise exception 'Missing second factor allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',auth.uid(),'session_id','fresh','aal','aal2','amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint),jsonb_build_object('method','mfa/webauthn','timestamp',extract(epoch from now())::bigint)))::text,true);
select public.authorize_account_edit(current_setting('test.challenge')::uuid);
do $$ begin
  begin
    perform public.authorize_account_edit(current_setting('test.challenge')::uuid);
    raise exception 'Consumed challenge was reusable';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
