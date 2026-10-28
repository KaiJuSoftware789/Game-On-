begin;
insert into auth.users(id,email,raw_user_meta_data) values
('c0220000-0000-4000-8000-000000000001','messages-one@example.invalid','{"name":"One"}'),
('c0220000-0000-4000-8000-000000000002','messages-two@example.invalid','{"name":"Two"}'),
('c0220000-0000-4000-8000-000000000003','messages-three@example.invalid','{"name":"Three"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0220000-0000-4000-8000-000000000001',true);
insert into public.messages(recipient_id,body) values('c0220000-0000-4000-8000-000000000002','Private hello');
select public.open_conversation('c0220000-0000-4000-8000-000000000002');
select public.open_conversation('c0220000-0000-4000-8000-000000000003');
update public.conversation_preferences set last_opened_at = now() - interval '1 hour' where peer_id='c0220000-0000-4000-8000-000000000002';
do $$ begin
 assert (select peer_id from public.recent_conversations() limit 1) = 'c0220000-0000-4000-8000-000000000003'::uuid, 'Most recently accessed conversation first';
end $$;
select public.set_conversation_pin('c0220000-0000-4000-8000-000000000002',true);
insert into public.message_pins(message_id) select id from public.messages where body='Private hello' and sender_id=auth.uid();
do $$ begin
 assert (select peer_id from public.recent_conversations() limit 1) = 'c0220000-0000-4000-8000-000000000002'::uuid, 'Pinned conversation first';
 assert (select count(*) from public.message_pins where user_id=auth.uid())=1, 'Participant can pin a message';
 begin
  insert into public.messages(sender_id,recipient_id,body) values('c0220000-0000-4000-8000-000000000002','c0220000-0000-4000-8000-000000000003','Forged');
  raise exception 'Sender spoofing allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.messages(recipient_id,body) values('c0220000-0000-4000-8000-000000000002','   ');
  raise exception 'Empty message allowed';
 exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','c0220000-0000-4000-8000-000000000002',true);
do $$ begin
 assert (select count(*) from public.messages where body='Private hello' and recipient_id=auth.uid())=1, 'Recipient can read message';
 assert (select count(*) from public.message_pins)=0, 'Sender pins private from recipient';
 assert (select count(*) from public.conversation_preferences)=0, 'Access history private from recipient';
end $$;
select set_config('request.jwt.claim.sub','c0220000-0000-4000-8000-000000000003',true);
do $$ begin
 assert (select count(*) from public.messages where sender_id='c0220000-0000-4000-8000-000000000001')=0, 'Third party cannot read conversation';
 assert (select count(*) from public.my_conversations())=0, 'Third party cannot list private conversation';
end $$;
reset role;
select set_config('test.message_id',(select id::text from public.messages where sender_id='c0220000-0000-4000-8000-000000000001' and body='Private hello'),true);
set local role authenticated;
do $$ begin
 begin
  insert into public.message_pins(message_id) values(current_setting('test.message_id')::bigint);
  raise exception 'Third party pinned private message';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','c0220000-0000-4000-8000-000000000001',true);
delete from public.message_pins where user_id=auth.uid();
select public.set_conversation_pin('c0220000-0000-4000-8000-000000000002',false);
do $$ begin
 assert (select count(*) from public.message_pins)=0, 'Unpin message';
 assert (select peer_id from public.recent_conversations() limit 1) = 'c0220000-0000-4000-8000-000000000003'::uuid, 'Unpin restores access ordering';
end $$;
set local role anon;
do $$ begin
 begin perform * from public.messages; raise exception 'Anonymous access allowed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Message privacy, sender identity, pins, and recent access ordering passed' as result;
