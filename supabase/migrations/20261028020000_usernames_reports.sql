-- Usernames remain public display names; account identity is the immutable UUID.
create function public.valid_player_name(value text) returns boolean
language sql immutable set search_path = '' as $$
 select value is not null
 and char_length(value) between 3 and 32
 and value = btrim(value)
 and value ~ '^[A-Za-z0-9][A-Za-z0-9 ._-]*$'
 and regexp_replace(translate(lower(value), '013457', 'oieast'), '[^a-z]', '', 'g')
     !~ '(fuck|shit|bitch|cunt|nigger|nigga|faggot|motherfucker|asshole|cock|dick|pussy|whore|porn|nazi)';
$$;
revoke all on function public.valid_player_name(text) from public, anon;
grant execute on function public.valid_player_name(text) to authenticated;

create function public.set_player_name(new_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to edit your username.'; end if;
 if not public.valid_player_name(btrim(new_name)) then
  raise exception 'Choose an appropriate username with 3–32 letters, numbers, spaces, dots, underscores or hyphens.';
 end if;
 update public.profiles set display_name = btrim(new_name) where id = auth.uid();
 if not found then raise exception 'Profile unavailable.'; end if;
end;
$$;
revoke all on function public.set_player_name(text) from public, anon;
grant execute on function public.set_player_name(text) to authenticated;

-- Provider names use the same filter without preventing account creation.
create or replace function public.create_player_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare candidate text := btrim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Player'));
begin
 insert into public.profiles(id, display_name)
 values(new.id, case when public.valid_player_name(candidate) then candidate else 'Player' end);
 return new;
end;
$$;

create table public.player_reports (
 id bigint generated always as identity primary key,
 reporter_id uuid not null references public.profiles(id),
 reported_id uuid not null references public.profiles(id),
 reason text not null check(reason in ('harassment','hate_speech','inappropriate_profile','spam','scam','threats','sexual_content','privacy','cheating','other')),
 details text not null default '' check(char_length(details) <= 2000),
 status text not null default 'pending' check(status in ('pending','reviewed','dismissed')),
 created_at timestamptz not null default now(),
 check(reporter_id <> reported_id)
);
create index player_reports_review on public.player_reports(status, created_at);
create index player_reports_rate on public.player_reports(reporter_id, created_at);
create unique index player_reports_pending on public.player_reports(reporter_id, reported_id, reason) where status = 'pending';
alter table public.player_reports enable row level security;
revoke all on public.player_reports from anon, authenticated;
grant all on public.player_reports to service_role;
grant usage, select on sequence public.player_reports_id_seq to service_role;

create function public.report_player(player_id uuid, report_reason text, report_details text default '') returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to report a player.'; end if;
 if player_id = auth.uid() then raise exception 'You cannot report yourself.'; end if;
 -- Serialize submissions for the same account so concurrent calls cannot bypass the cap.
 perform 1 from public.profiles where id = auth.uid() for update;
 if not found then raise exception 'Profile unavailable.'; end if;
 if exists(select 1 from public.player_reports where reporter_id=auth.uid() and reported_id=player_id and reason=report_reason and status='pending') then
  raise exception 'You already have a pending report for this reason.';
 end if;
 if (select count(*) from public.player_reports where reporter_id=auth.uid() and created_at > now()-interval '24 hours') >= 5 then
  raise exception 'You can submit up to five reports per day. Please try again later.';
 end if;
 insert into public.player_reports(reporter_id,reported_id,reason,details)
 values(auth.uid(),player_id,report_reason,btrim(coalesce(report_details,'')));
end;
$$;
revoke all on function public.report_player(uuid,text,text) from public, anon;
grant execute on function public.report_player(uuid,text,text) to authenticated;
