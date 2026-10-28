create function public.save_my_profile(new_name text, new_bio text, profile_visibility text, audience text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to edit your profile.'; end if;
 -- Preserve existing provider names when only other fields change.
 perform 1 from public.profiles where id=auth.uid() for update;
 if not found then raise exception 'Profile unavailable.'; end if;
 if (select display_name from public.profiles where id=auth.uid()) is distinct from btrim(new_name) then
  perform public.set_player_name(new_name);
 end if;
 perform public.set_player_bio(new_bio);
 perform public.set_profile_privacy(profile_visibility,audience);
end;
$$;
revoke all on function public.save_my_profile(text,text,text,text) from public,anon;
grant execute on function public.save_my_profile(text,text,text,text) to authenticated;
