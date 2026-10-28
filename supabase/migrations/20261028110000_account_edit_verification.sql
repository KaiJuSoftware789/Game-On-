create table public.account_edit_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_session text not null,
  created_at timestamptz not null default now()
);
alter table public.account_edit_challenges enable row level security;
revoke all on public.account_edit_challenges from anon, authenticated;

create function public.begin_account_edit() returns uuid
language plpgsql security definer set search_path='' as $$
declare challenge uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode='42501'; end if;
  perform public.require_mfa();
  delete from public.account_edit_challenges where user_id=auth.uid();
  insert into public.account_edit_challenges(user_id,original_session) values(auth.uid(),auth.jwt()->>'session_id') returning id into challenge;
  return challenge;
end;
$$;

create function public.check_account_edit_primary(challenge uuid) returns void
language plpgsql security definer set search_path='' as $$
declare started timestamptz; first_at bigint; original text;
begin
  select created_at, original_session into started, original from public.account_edit_challenges
    where id=challenge and user_id=auth.uid() for update;
  if started is null or started < now()-interval '10 minutes' then
    raise exception 'Edit request expired. Start again.' using errcode='42501';
  end if;
  select max((a->>'timestamp')::bigint) into first_at
    from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a
    where a->>'method' in ('password','oauth','otp','passkey');
  if first_at is null or first_at < floor(extract(epoch from started)) or original = auth.jwt()->>'session_id' then
    raise exception 'Verify your existing sign-in method first.' using errcode='42501';
  end if;
end;
$$;

create function public.authorize_account_edit(challenge uuid) returns void
language plpgsql security definer set search_path='' as $$
declare first_at bigint; second_at bigint;
begin
  perform public.check_account_edit_primary(challenge);
  select max((a->>'timestamp')::bigint) into first_at
    from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a
    where a->>'method' in ('password','oauth','otp','passkey');
  if exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified') then
    select max((a->>'timestamp')::bigint) into second_at
      from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a
      where a->>'method' in ('totp','mfa/totp','mfa/phone','mfa/webauthn');
    if auth.jwt()->>'aal' <> 'aal2' or second_at is null or second_at < first_at then
      raise exception 'Complete two-factor authentication after signing in.' using errcode='42501';
    end if;
  end if;
  delete from public.account_edit_challenges where id=challenge;
end;
$$;
revoke all on function public.begin_account_edit() from public, anon;
revoke all on function public.authorize_account_edit(uuid) from public, anon;
revoke all on function public.check_account_edit_primary(uuid) from public, anon;
grant execute on function public.begin_account_edit() to authenticated;
grant execute on function public.authorize_account_edit(uuid) to authenticated;
grant execute on function public.check_account_edit_primary(uuid) to authenticated;
notify pgrst,'reload schema';
