-- Local gaming events. Apply after the initial Game On migration.
begin;
create schema if not exists game_on_events;
revoke all on schema game_on_events from public, anon, authenticated;
create table game_on_events.events (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 payload jsonb not null, starts_at timestamptz not null, ends_at timestamptz not null,
 latitude double precision not null check(latitude between -90 and 90), longitude double precision not null check(longitude between -180 and 180),
 kind text not null check(kind in ('Tournament','Gaming session')), game_name text not null,
 section text not null check(section in ('official','unofficial')),
 status text not null default 'scheduled' check(status in ('scheduled','cancelled')), created_at timestamptz not null default now()
);
create index local_events_upcoming on game_on_events.events(ends_at,starts_at) where status='scheduled';
create index local_events_owner on game_on_events.events(user_id,created_at desc);
alter table game_on_events.events enable row level security;
revoke all on all tables in schema game_on_events from public, anon, authenticated;
create function game_on_events.distance_miles(a double precision,b double precision,c double precision,d double precision) returns double precision
language sql immutable set search_path='' as $$ select 3958.7613*2*asin(sqrt(least(1,greatest(0,power(sin(radians(c-a)/2),2)+cos(radians(a))*cos(radians(c))*power(sin(radians(d-b)/2),2))))) $$;
revoke all on function game_on_events.distance_miles(double precision,double precision,double precision,double precision) from public,anon,authenticated;

create function public.local_event_publish(p_event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); eid uuid; start_at timestamptz; end_at timestamptz; gid text; name text; entry game_on_events.events; field text; clean jsonb;
begin
 if uid is null then raise exception 'Sign in to publish an event.'; end if;
 if p_event is null or jsonb_typeof(p_event)<>'object' or octet_length(p_event::text)>16000 then raise exception 'Invalid event.'; end if;
 foreach field in array array['id','title','kind','host','venue','address','startsAt','endsAt','timezone','description','registrationUrl','createdAt','status'] loop
  if jsonb_typeof(p_event->field) is distinct from 'string' then raise exception 'Invalid event field: %',field; end if;
 end loop;
 foreach field in array array['id','name','genre','mark','theme'] loop
  if jsonb_typeof(p_event->'game'->field) is distinct from 'string' then raise exception 'Invalid game details.'; end if;
 end loop;
 foreach field in array array['zip','city','state'] loop
  if jsonb_typeof(p_event->'location'->field) is distinct from 'string' then raise exception 'Invalid venue location.'; end if;
 end loop;
 if jsonb_typeof(p_event->'location'->'latitude') is distinct from 'number' or jsonb_typeof(p_event->'location'->'longitude') is distinct from 'number' or jsonb_typeof(p_event->'capacity') is distinct from 'number' then raise exception 'Invalid location or player limit.'; end if;
 if char_length(btrim(p_event->>'title')) not between 4 and 80 or char_length(btrim(p_event->>'host')) not between 2 and 32
  or char_length(btrim(p_event->>'venue')) not between 2 and 80 or char_length(btrim(p_event->>'address')) not between 3 and 160
  or char_length(p_event->>'description')>1000 or p_event->>'kind' not in ('Tournament','Gaming session') or p_event->>'status'<>'scheduled' then raise exception 'Please check the event details.'; end if;
 if p_event->'location'->>'zip' !~ '^[0-9]{5}$' or char_length(p_event->'location'->>'city') not between 1 and 100 or char_length(p_event->'location'->>'state')<>2
  or (p_event->'location'->>'latitude')::double precision not between -90 and 90 or (p_event->'location'->>'longitude')::double precision not between -180 and 180 then raise exception 'Invalid venue ZIP or coordinates.'; end if;
 if (p_event->>'capacity')::numeric not between 2 and 1000 or trunc((p_event->>'capacity')::numeric)<>(p_event->>'capacity')::numeric then raise exception 'Use a player limit from 2 to 1,000.'; end if;
 if p_event->>'timezone' not in ('America/New_York','America/Chicago','America/Denver','America/Phoenix','America/Los_Angeles','America/Anchorage','Pacific/Honolulu','America/Puerto_Rico','Pacific/Guam','UTC') then raise exception 'Choose a supported time zone.'; end if;
 if char_length(p_event->>'registrationUrl')>500 or (p_event->>'registrationUrl'<>'' and p_event->>'registrationUrl' !~ '^https://[^/@[:space:]]+([/?#]|$)') then raise exception 'Use a valid HTTPS registration link.'; end if;
 gid:=p_event->'game'->>'id'; name:=p_event->'game'->>'name';
 if gid !~ '^[a-zA-Z0-9-]{1,100}$' or char_length(name) not between 2 and 60 or char_length(p_event->'game'->>'genre')>40 or char_length(p_event->'game'->>'mark') not between 1 and 3 or p_event->'game'->>'theme' not in ('coral','violet','gold','sage','copper','sky') then raise exception 'Invalid game.'; end if;
 if gid not in ('valorant','fortnite','helldivers','minecraft','apex','rocket-league') and gid not like 'custom-%' then raise exception 'Choose an official or unofficial game.'; end if;
 if gid not like 'custom-%' and name is distinct from (case gid when 'valorant' then 'VALORANT' when 'fortnite' then 'Fortnite' when 'helldivers' then 'Helldivers 2' when 'minecraft' then 'Minecraft' when 'apex' then 'Apex Legends' when 'rocket-league' then 'Rocket League' end) then raise exception 'The official game name must match the catalog.'; end if;
 start_at:=(p_event->>'startsAt')::timestamptz; end_at:=(p_event->>'endsAt')::timestamptz; eid:=(p_event->>'id')::uuid;
 if start_at<=now() or start_at>now()+interval '730 days' or end_at<=start_at or end_at>start_at+interval '24 hours' then raise exception 'Choose a valid future event time.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('game-on-events:'||uid::text,0));
 -- Keep the expected public fields only, including server-owned creation time.
 clean:=jsonb_build_object('id',eid,'title',p_event->>'title','kind',p_event->>'kind','host',p_event->>'host','venue',p_event->>'venue','address',p_event->>'address','game',p_event->'game','location',p_event->'location','startsAt',start_at,'endsAt',end_at,'timezone',p_event->>'timezone','capacity',(p_event->>'capacity')::integer,'description',p_event->>'description','registrationUrl',p_event->>'registrationUrl','status','scheduled','createdAt',now());
 select * into entry from game_on_events.events where id=eid;
 if found then
  if entry.user_id=uid and (entry.payload-'createdAt')=(clean-'createdAt') then return jsonb_build_object('event',entry.payload); end if;
  raise exception 'This event has already been published. Open Your events to view it.';
 end if;
 if (select count(*) from game_on_events.events where user_id=uid and created_at>now()-interval '1 day')>=20 then raise exception 'You can publish up to 20 events per day.'; end if;

 insert into game_on_events.events(id,user_id,payload,starts_at,ends_at,latitude,longitude,kind,game_name,section)
 values(eid,uid,clean,start_at,end_at,(p_event->'location'->>'latitude')::double precision,(p_event->'location'->>'longitude')::double precision,p_event->>'kind',name,case when gid like 'custom-%' then 'unofficial' else 'official' end);
 return jsonb_build_object('event',clean);
end;
$$;
create function public.local_events_search(p_latitude double precision,p_longitude double precision,p_radius integer,p_kind text default '',p_section text default 'all',p_game text default '',p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_latitude is null or p_longitude is null or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 or p_radius is null or p_radius not in (5,10,25,50) or p_kind is null or p_kind not in ('','Tournament','Gaming session') or p_section is null or p_section not in ('all','official','unofficial') or p_game is null or char_length(p_game)>60 or p_offset is null or p_offset not between 0 and 100000 then raise exception 'Invalid nearby search.'; end if;
 with nearby as (
  select e.*,game_on_events.distance_miles(p_latitude,p_longitude,latitude,longitude) distance from game_on_events.events e
  where status='scheduled' and ends_at>now() and (p_kind='' or kind=p_kind) and (p_section='all' or section=p_section) and (p_game='' or game_name=p_game)
 ), matched as (select * from nearby where distance<=p_radius), page as (select * from matched order by starts_at,distance,id limit 25 offset p_offset)
 select jsonb_build_object('events',coalesce((select jsonb_agg(jsonb_build_object('event',payload,'owner',coalesce(user_id=auth.uid(),false),'distance',distance) order by starts_at,distance,id) from page),'[]'::jsonb),'total',(select count(*) from matched)) into result;
 return result;
end;
$$;
create function public.local_event_get(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('events',coalesce(jsonb_agg(jsonb_build_object('event',payload,'owner',coalesce(user_id=auth.uid(),false))),'[]'::jsonb),'total',count(*)) from game_on_events.events where id=p_id;
$$;
create function public.local_events_mine() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('events',coalesce(jsonb_agg(jsonb_build_object('event',payload,'owner',true) order by starts_at desc),'[]'::jsonb),'total',count(*)) from game_on_events.events where user_id=auth.uid();
$$;
create function public.local_event_cancel(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first.'; end if;
 update game_on_events.events set status='cancelled',payload=jsonb_set(payload,'{status}','"cancelled"'::jsonb) where id=p_id and user_id=auth.uid();
 if not found then raise exception 'Only the organizer can cancel this event.'; end if;
end;
$$;
revoke all on function public.local_event_publish(jsonb),public.local_events_search(double precision,double precision,integer,text,text,text,integer),public.local_event_get(uuid),public.local_events_mine(),public.local_event_cancel(uuid) from public,anon,authenticated;
grant execute on function public.local_event_publish(jsonb),public.local_events_mine(),public.local_event_cancel(uuid) to authenticated;
grant execute on function public.local_events_search(double precision,double precision,integer,text,text,text,integer),public.local_event_get(uuid) to anon,authenticated;
commit;
