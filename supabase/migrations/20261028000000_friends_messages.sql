create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> recipient_id)
);
create unique index friendship_pair on public.friendships (least(requester_id, recipient_id), greatest(requester_id, recipient_id));
create index friendships_recipient on public.friendships(recipient_id);
create index friendships_requester on public.friendships(requester_id);
alter table public.friendships enable row level security;
create policy "Participants read friendships" on public.friendships for select to authenticated using (auth.uid() in (requester_id, recipient_id));
create policy "Send own friend requests" on public.friendships for insert to authenticated with check (auth.uid() = requester_id and status = 'pending');
create policy "Participants remove friendships" on public.friendships for delete to authenticated using (auth.uid() in (requester_id, recipient_id));
revoke all on public.friendships from anon, authenticated;
grant select, delete on public.friendships to authenticated;
grant insert (recipient_id) on public.friendships to authenticated;

create function public.accept_friend_request(request_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.friendships set status = 'accepted', updated_at = now()
  where id = request_id and recipient_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Friend request unavailable' using errcode = '42501'; end if;
end;
$$;
revoke all on function public.accept_friend_request(uuid) from public, anon;
grant execute on function public.accept_friend_request(uuid) to authenticated;

create table public.messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index messages_sender on public.messages(sender_id, id desc);
create index messages_recipient on public.messages(recipient_id, id desc);
alter table public.messages enable row level security;
create policy "Only participants read messages" on public.messages for select to authenticated using (auth.uid() in (sender_id, recipient_id));
create policy "Send messages as yourself" on public.messages for insert to authenticated with check (auth.uid() = sender_id);
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert (recipient_id, body) on public.messages to authenticated;
grant usage on sequence public.messages_id_seq to authenticated;

create function public.my_conversations() returns table (peer_id uuid, display_name text, body text, created_at timestamptz, message_id bigint)
language sql stable security invoker set search_path = '' as $$
  select latest.peer, p.display_name, latest.body, latest.created_at, latest.id
  from (
    select distinct on (case when sender_id = auth.uid() then recipient_id else sender_id end)
      case when sender_id = auth.uid() then recipient_id else sender_id end as peer, body, created_at, id
    from public.messages where auth.uid() in (sender_id, recipient_id)
    order by case when sender_id = auth.uid() then recipient_id else sender_id end, id desc
  ) latest join public.profiles p on p.id = latest.peer order by latest.id desc;
$$;
revoke all on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;
alter publication supabase_realtime add table public.friendships, public.messages;
