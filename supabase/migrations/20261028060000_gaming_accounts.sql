alter table public.profile_details add column gaming_accounts jsonb not null default '{}'::jsonb check(jsonb_typeof(gaming_accounts)='object');
create function public.save_my_profile(new_name text,new_bio text,profile_visibility text,audience text,accounts jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare entry record; cleaned jsonb := '{}'::jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in to edit your profile.'; end if;
 if accounts is null or jsonb_typeof(accounts)<>'object' or pg_column_size(accounts)>8192 then raise exception 'Invalid gaming accounts.'; end if;
 for entry in select key,value from jsonb_each(accounts) loop
  if entry.key not in ('discord','activision','riot','steam','xbox','playstation','battlenet','epic','ea','ubisoft','nintendo') or jsonb_typeof(entry.value)<>'string' then raise exception 'Unsupported gaming account.'; end if;
  if char_length(entry.value #>> '{}')>80 or (entry.value #>> '{}') ~ '[[:cntrl:]]' then raise exception 'Account handles must be 80 characters or fewer, without control characters.'; end if;
  if btrim(entry.value #>> '{}')<>'' then cleaned=cleaned || jsonb_build_object(entry.key,btrim(entry.value #>> '{}')); end if;
 end loop;
 perform public.save_my_profile(new_name,new_bio,profile_visibility,audience);
 update public.profile_details set gaming_accounts=cleaned where user_id=auth.uid();
end;
$$;
revoke all on function public.save_my_profile(text,text,text,text,jsonb) from public,anon;
grant execute on function public.save_my_profile(text,text,text,text,jsonb) to authenticated;
