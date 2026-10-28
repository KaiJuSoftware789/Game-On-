-- Require a completed second factor only for accounts that have opted in.
create function public.has_required_mfa() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is null
    or coalesce(auth.jwt()->>'aal', '') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors
      where user_id = auth.uid() and status = 'verified'
    );
$$;
revoke all on function public.has_required_mfa() from public;
grant execute on function public.has_required_mfa() to anon, authenticated;

-- Applies to direct table access, including Realtime authorization.
do $$ declare target record; begin
  for target in select schemaname, tablename from pg_tables
    where schemaname = 'public' and rowsecurity
  loop
    execute format('create policy "Require enrolled MFA" on %I.%I as restrictive to authenticated using ((select public.has_required_mfa())) with check ((select public.has_required_mfa()))', target.schemaname, target.tablename);
  end loop;
end $$;

-- PostgREST runs this before every API request, including SECURITY DEFINER RPCs
-- that can bypass table RLS. Keep this check in any future pre-request hook.
create function public.require_mfa() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_required_mfa() then
    raise exception 'Complete two-factor authentication before accessing your account.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.require_mfa() from public;
grant execute on function public.require_mfa() to anon, authenticated, service_role;
alter role authenticator set pgrst.db_pre_request = 'public.require_mfa';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
