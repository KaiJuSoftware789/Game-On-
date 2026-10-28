create table public.profile_details (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 bio text not null default '' check(char_length(bio)<=200),
 visibility text not null default 'public' check(visibility in ('public','private')),
 private_audience text not null default 'friends' check(private_audience in ('friends','only_me'))
);
insert into public.profile_details(user_id,bio) select id,bio from public.profiles;
alter table public.profile_details enable row level security;
create function public.can_view_profile(player_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profile_details d where d.user_id=player_id and
 (d.visibility='public' or d.user_id=auth.uid() or (d.private_audience='friends' and exists(
 select 1 from public.friendships f where f.status='accepted' and
 ((f.requester_id=d.user_id and f.recipient_id=auth.uid()) or (f.recipient_id=d.user_id and f.requester_id=auth.uid()))))));
$$;
revoke all on function public.can_view_profile(uuid) from public;
grant execute on function public.can_view_profile(uuid) to anon,authenticated;
create policy "Allowed viewers read profile details" on public.profile_details for select to anon,authenticated using(public.can_view_profile(user_id));
revoke all on public.profile_details from anon,authenticated;
grant select on public.profile_details to anon,authenticated;
-- Public identities stay searchable; private content lives behind row-level access.
alter table public.profiles drop column bio;
create or replace function public.set_player_bio(new_bio text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to edit your bio.'; end if;
 if char_length(coalesce(new_bio,''))>200 then raise exception 'Keep your bio to 200 characters.'; end if;
 insert into public.profile_details(user_id,bio) values(auth.uid(),btrim(coalesce(new_bio,'')))
 on conflict(user_id) do update set bio=excluded.bio;
end;
$$;
create function public.set_profile_privacy(profile_visibility text, audience text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to edit your profile.'; end if;
 if profile_visibility not in ('public','private') or audience not in ('friends','only_me') or profile_visibility is null or audience is null then raise exception 'Invalid privacy preference.'; end if;
 insert into public.profile_details(user_id,visibility,private_audience) values(auth.uid(),profile_visibility,audience)
 on conflict(user_id) do update set visibility=excluded.visibility,private_audience=excluded.private_audience;
end;
$$;
revoke all on function public.set_profile_privacy(text,text) from public,anon;
grant execute on function public.set_profile_privacy(text,text) to authenticated;
drop policy "Anyone can view game selections" on public.user_games;
create policy "Allowed viewers read game selections" on public.user_games for select to anon,authenticated using(public.can_view_profile(user_id));
create function public.initialize_profile_details() returns trigger
language plpgsql security definer set search_path='' as $$
begin insert into public.profile_details(user_id) values(new.id); return new; end;
$$;
revoke all on function public.initialize_profile_details() from public,anon,authenticated;
create trigger initialize_profile_details after insert on public.profiles for each row execute function public.initialize_profile_details();
