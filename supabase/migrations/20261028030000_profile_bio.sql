alter table public.profiles add column bio text not null default '' check(char_length(bio) <= 200);
create function public.set_player_bio(new_bio text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to edit your bio.'; end if;
 if char_length(coalesce(new_bio,'')) > 200 then raise exception 'Keep your bio to 200 characters.'; end if;
 update public.profiles set bio=btrim(coalesce(new_bio,'')) where id=auth.uid();
 if not found then raise exception 'Profile unavailable.'; end if;
end;
$$;
revoke all on function public.set_player_bio(text) from public, anon;
grant execute on function public.set_player_bio(text) to authenticated;
