-- Serialize creation per owner, and replace only that owner's previous ticket.
create function public.publish_ticket(ticket_game bigint,ticket_title text,ticket_description text,ticket_players integer,ticket_region text,ticket_invite text,replace_existing boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare ticket_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to publish a ticket.'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if not found then raise exception 'Profile unavailable.'; end if;
 if exists(select 1 from public.tickets where host_id=auth.uid()) and not replace_existing then
  raise exception 'ticket_replace_required';
 end if;
 delete from public.tickets where host_id=auth.uid();
 insert into public.tickets(host_id,game_id,title,description,players_needed,region,invite_url)
 values(auth.uid(),ticket_game,btrim(ticket_title),ticket_description,ticket_players,ticket_region,ticket_invite) returning id into ticket_id;
 return ticket_id;
end;
$$;
revoke all on function public.publish_ticket(bigint,text,text,integer,text,text,boolean) from public,anon;
grant execute on function public.publish_ticket(bigint,text,text,integer,text,text,boolean) to authenticated;
-- Creation must use the atomic replacement path. Existing owner-only update RLS governs closing.
revoke insert on public.tickets from authenticated;
revoke insert(game_id,title,description,players_needed,region,invite_url) on public.tickets from authenticated;
