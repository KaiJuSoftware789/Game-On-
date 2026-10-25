-- Tickets are real player-created sessions. Deliberately no sample tickets.
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  game_id bigint not null references public.games(id),
  title text not null check (char_length(btrim(title)) between 3 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  players_needed integer not null check (players_needed between 1 and 20),
  region text not null check (region in ('North America', 'Europe', 'Asia', 'Oceania', 'South America', 'Any region')),
  invite_url text not null check (char_length(invite_url) <= 2048 and invite_url ~ '^https://[^[:space:]]+$'),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '4 hours'),
  constraint ticket_expiration check (expires_at > created_at and expires_at <= created_at + interval '24 hours')
);

create index tickets_open_expiration_idx on public.tickets (expires_at, created_at desc) where status = 'open';
create index tickets_host_idx on public.tickets (host_id);
alter table public.tickets enable row level security;

-- Closed rows remain readable so Realtime can deliver their status changes.
create policy "Anyone can read tickets" on public.tickets for select to anon, authenticated using (true);
create policy "Players create their own tickets" on public.tickets for insert to authenticated
  with check ((select auth.uid()) = host_id and status = 'open' and expires_at > now());
create policy "Hosts update their tickets" on public.tickets for update to authenticated
  using ((select auth.uid()) = host_id) with check ((select auth.uid()) = host_id);

-- Only the host may close a ticket; clients cannot rewrite ownership or timestamps.
revoke all on public.tickets from anon, authenticated;
grant select on public.tickets to anon, authenticated;
grant insert (game_id, title, description, players_needed, region, invite_url) on public.tickets to authenticated;
grant update (status) on public.tickets to authenticated;

-- Public profiles expose a display name, never an email or provider credentials.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player' check (char_length(display_name) between 1 and 80)
);
alter table public.profiles enable row level security;
create policy "Anyone can view player profiles" on public.profiles for select to anon, authenticated using (true);
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;

create function public.create_player_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), 'Player'), 80));
  return new;
end;
$$;
revoke all on function public.create_player_profile() from public, anon, authenticated;
create trigger on_player_created after insert on auth.users for each row execute function public.create_player_profile();
insert into public.profiles (id, display_name)
select id, left(coalesce(nullif(btrim(raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(raw_user_meta_data ->> 'name'), ''), 'Player'), 80) from auth.users;

create table public.user_games (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  game_id bigint not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

alter table public.user_games enable row level security;
create policy "Anyone can view game selections" on public.user_games for select to anon, authenticated using (true);
create policy "Players select their games" on public.user_games for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Players remove their games" on public.user_games for delete to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.user_games from anon, authenticated;
grant select on public.user_games to anon, authenticated;
grant insert, delete on public.user_games to authenticated;

-- One transaction avoids losing existing selections if a save fails halfway through.
create function public.save_my_games(game_ids bigint[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to save your games' using errcode = '42501';
  end if;
  if game_ids is null or array_position(game_ids, null) is not null then
    raise exception 'Choose valid games' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 0));
  delete from public.user_games where user_id = auth.uid();
  insert into public.user_games (user_id, game_id)
    select auth.uid(), id from (select distinct unnest(game_ids) as id) selected;
end;
$$;
revoke all on function public.save_my_games(bigint[]) from public, anon;
grant execute on function public.save_my_games(bigint[]) to authenticated;

alter publication supabase_realtime add table public.tickets;
