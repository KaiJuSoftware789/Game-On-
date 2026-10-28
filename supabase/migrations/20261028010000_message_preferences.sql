create table public.conversation_preferences (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  peer_id uuid not null references public.profiles(id) on delete cascade,
  last_opened_at timestamptz not null default now(),
  pinned boolean not null default false,
  primary key (user_id, peer_id),
  check (user_id <> peer_id)
);
alter table public.conversation_preferences enable row level security;
create policy "Own conversation preferences" on public.conversation_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.conversation_preferences from anon, authenticated;
grant select on public.conversation_preferences to authenticated;
grant insert (peer_id, last_opened_at, pinned), update (last_opened_at, pinned) on public.conversation_preferences to authenticated;

create table public.message_pins (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  message_id bigint not null references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);
alter table public.message_pins enable row level security;
create policy "Own message pins" on public.message_pins for select to authenticated using (user_id = auth.uid());
create policy "Pin messages you can read" on public.message_pins for insert to authenticated with check (
 user_id = auth.uid() and exists (select 1 from public.messages where id = message_id and auth.uid() in (sender_id, recipient_id))
);
create policy "Remove own pins" on public.message_pins for delete to authenticated using (user_id = auth.uid());
revoke all on public.message_pins from anon, authenticated;
grant select, delete on public.message_pins to authenticated;
grant insert (message_id) on public.message_pins to authenticated;

create function public.open_conversation(other_player uuid) returns void language sql security invoker set search_path = '' as $$
 insert into public.conversation_preferences(peer_id, last_opened_at) values(other_player, now())
 on conflict(user_id, peer_id) do update set last_opened_at = now();
$$;
revoke all on function public.open_conversation(uuid) from public, anon;
grant execute on function public.open_conversation(uuid) to authenticated;

create function public.recent_conversations() returns table(peer_id uuid, display_name text, body text, created_at timestamptz, pinned boolean, last_opened_at timestamptz)
language sql stable security invoker set search_path = '' as $$
 with latest as (select * from public.my_conversations()), peers as (
 select peer_id from latest union select peer_id from public.conversation_preferences where user_id = auth.uid()
 )
 select peers.peer_id, p.display_name, latest.body, latest.created_at, coalesce(pref.pinned, false), pref.last_opened_at
 from peers join public.profiles p on p.id = peers.peer_id
 left join latest on latest.peer_id = peers.peer_id
 left join public.conversation_preferences pref on pref.peer_id = peers.peer_id and pref.user_id = auth.uid()
 order by coalesce(pref.pinned, false) desc, coalesce(pref.last_opened_at, latest.created_at) desc, peers.peer_id;
$$;
revoke all on function public.recent_conversations() from public, anon;
grant execute on function public.recent_conversations() to authenticated;
alter publication supabase_realtime add table public.conversation_preferences, public.message_pins;
create function public.set_conversation_pin(other_player uuid, is_pinned boolean) returns void language sql security invoker set search_path = '' as $$
 insert into public.conversation_preferences(peer_id, pinned) values(other_player, is_pinned)
 on conflict(user_id, peer_id) do update set pinned = excluded.pinned;
$$;
revoke all on function public.set_conversation_pin(uuid,boolean) from public, anon;
grant execute on function public.set_conversation_pin(uuid,boolean) to authenticated;
