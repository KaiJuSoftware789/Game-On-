-- Game On: VALORANT account identity and publisher-native ranks.
-- This is an unapplied initial migration, replacing the earlier draft ladder.
begin;
create schema if not exists game_on_rankings;
revoke all on schema game_on_rankings from public, anon, authenticated;

create table game_on_rankings.accounts (
  player_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  changed_at timestamptz not null,
  next_change_at timestamptz not null,
  visible boolean not null default true
);
create table game_on_rankings.native_ranks (
  rank_order integer primary key,
  rank_name text not null unique
);
insert into game_on_rankings.native_ranks values (0,'Unranked');
insert into game_on_rankings.native_ranks
select (tier_position-1)*3+division, tier||' '||division
from unnest(array['Iron','Bronze','Silver','Gold','Platinum','Diamond','Ascendant','Immortal']) with ordinality as tiers(tier,tier_position)
cross join generate_series(1,3) as divisions(division);
insert into game_on_rankings.native_ranks values (25,'Radiant');

-- Written exclusively by a future trusted provider adapter after account authorization.
create table game_on_rankings.synced_ranks (
  player_id uuid primary key references game_on_rankings.accounts(player_id) on delete cascade,
  rank_order integer not null references game_on_rankings.native_ranks(rank_order),
  synced_at timestamptz not null,
  source text not null check(source in ('riot','tracker'))
);
alter table game_on_rankings.accounts enable row level security;
alter table game_on_rankings.native_ranks enable row level security;
alter table game_on_rankings.synced_ranks enable row level security;
revoke all on all tables in schema game_on_rankings from public, anon, authenticated;

create function public.ranking_save_username(p_username text) returns void
language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare uid uuid := auth.uid(); current_account game_on_rankings.accounts; clean text; name_part text; tag text; changed timestamptz;
begin
 if uid is null then raise exception 'Sign in to save your Riot ID.'; end if;
 clean := btrim(normalize(p_username,NFKC));
 name_part := split_part(clean,'#',1); tag := split_part(clean,'#',2);
 if clean is null or length(clean)-length(replace(clean,'#',''))<>1 or char_length(name_part) not between 3 and 16
   or btrim(name_part)<>name_part or clean ~ '[[:cntrl:]]' or tag !~ '^[A-Za-z0-9]{3,5}$' then
   raise exception 'Enter your full Riot ID as Name#Tag: a 3–16 character name and a 3–5 letter or number tag.';
 end if;
 -- Lock before checking even on first save, preventing concurrent insert/update bypasses.
 perform pg_advisory_xact_lock(hashtextextended('game-on-riot-id:'||uid::text,0));
 select * into current_account from game_on_rankings.accounts where player_id=uid;
 if found then
   if lower(current_account.username)=lower(clean) then return; end if;
   if clock_timestamp()<current_account.next_change_at then
     raise exception 'You can change this Riot ID after % UTC.',to_char(current_account.next_change_at,'Mon DD, YYYY HH24:MI:SS');
   end if;
 end if;
 changed := clock_timestamp();
 insert into game_on_rankings.accounts(player_id,username,changed_at,next_change_at)
 values(uid,clean,changed,changed+interval '3 months')
 on conflict(player_id) do update set username=excluded.username,changed_at=excluded.changed_at,next_change_at=excluded.next_change_at;
 -- A different username must never inherit the previous account's rank.
 delete from game_on_rankings.synced_ranks where player_id=uid;
end;
$$;

create function public.ranking_set_visibility(p_visible boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first.'; end if;
 if p_visible is null then raise exception 'Choose whether to show your rank.'; end if;
 update game_on_rankings.accounts set visible=p_visible where player_id=auth.uid();
end;
$$;

create function public.ranking_account() returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('game_accounts',coalesce(jsonb_agg(jsonb_build_object(
   'game','valorant','username',a.username,'changedAt',a.changed_at,'nextChangeAt',a.next_change_at,'visible',a.visible,
   'ranks',case when r.player_id is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('queue','competitive','rank',n.rank_name,'updatedAt',r.synced_at)) end
 )), '[]'::jsonb))
 from game_on_rankings.accounts a
 left join game_on_rankings.synced_ranks r on r.player_id=a.player_id and r.synced_at>now()-interval '24 hours'
 left join game_on_rankings.native_ranks n on n.rank_order=r.rank_order
 where a.player_id=auth.uid();
$$;

-- Private server integration contract. Never call this from the browser.
-- The adapter must first verify the player controls this Riot account and obtain
-- a CURRENT native rank from an authorized provider. Last-match tiers are not current ranks.
-- Expected identity AND change timestamp prevent delayed jobs restoring old ranks.
create function public.ranking_apply_verified_rank(p_player uuid,p_expected_username text,p_expected_changed_at timestamptz,p_rank text,p_synced_at timestamptz,p_source text) returns void
language plpgsql security definer set search_path = '' as $$
declare account game_on_rankings.accounts; tier integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('game-on-riot-id:'||p_player::text,0));
 select * into account from game_on_rankings.accounts where player_id=p_player;
 if not found or account.username is distinct from p_expected_username or account.changed_at is distinct from p_expected_changed_at then raise exception 'The saved Riot ID changed. Discard this sync.'; end if;
 select rank_order into tier from game_on_rankings.native_ranks where rank_name=p_rank;
 if tier is null then raise exception 'Unknown VALORANT rank.'; end if;
 if p_synced_at is null or p_synced_at>clock_timestamp() or p_synced_at<clock_timestamp()-interval '24 hours' then raise exception 'A current rank observation is required.'; end if;
 insert into game_on_rankings.synced_ranks(player_id,rank_order,synced_at,source)
 values(p_player,tier,p_synced_at,p_source)
 on conflict(player_id) do update set rank_order=excluded.rank_order,synced_at=excluded.synced_at,source=excluded.source
 where game_on_rankings.synced_ranks.synced_at<excluded.synced_at;
end;
$$;

create function public.ranking_board(p_game text,p_queue text,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
 if p_game is distinct from 'valorant' or p_queue is distinct from 'competitive' then raise exception 'This rank connection is not available yet.'; end if;
 if p_offset is null or p_offset<0 or p_offset>1000000 then raise exception 'Invalid leaderboard page.'; end if;
 with ranked as (
   select a.player_id,a.username,n.rank_name,n.rank_order,r.synced_at as updated_at,
     rank() over(order by n.rank_order desc) as position
   from game_on_rankings.accounts a join game_on_rankings.synced_ranks r using(player_id)
   join game_on_rankings.native_ranks n using(rank_order)
   where a.visible and r.synced_at>now()-interval '24 hours'
 ), page as (select * from ranked order by rank_order desc,lower(username),player_id limit 25 offset p_offset)
 select jsonb_build_object('entries',coalesce((select jsonb_agg(to_jsonb(page) order by rank_order desc,lower(username),player_id) from page),'[]'::jsonb),
 'total',(select count(*) from ranked),'mine',(select to_jsonb(ranked) from ranked where player_id=auth.uid())) into result;
 return result;
end;
$$;

revoke all on function public.ranking_save_username(text) from public, anon, authenticated;
revoke all on function public.ranking_set_visibility(boolean) from public, anon, authenticated;
revoke all on function public.ranking_account() from public, anon, authenticated;
revoke all on function public.ranking_board(text,text,integer) from public, anon, authenticated;
revoke all on function public.ranking_apply_verified_rank(uuid,text,timestamptz,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.ranking_save_username(text),public.ranking_set_visibility(boolean),public.ranking_account() to authenticated;
grant execute on function public.ranking_board(text,text,integer) to anon, authenticated;
grant execute on function public.ranking_apply_verified_rank(uuid,text,timestamptz,text,timestamptz,text) to service_role;
commit;
