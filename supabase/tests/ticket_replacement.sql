begin;
insert into auth.users(id,email) values
('c0880000-0000-4000-8000-000000000001','ticket1@example.invalid'),
('c0880000-0000-4000-8000-000000000002','ticket2@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0880000-0000-4000-8000-000000000001',true);
select public.publish_ticket((select id from public.games limit 1),'First ticket','',2,'North America','https://example.invalid',false);
do $$ begin
 begin
  perform public.publish_ticket((select id from public.games limit 1),'Replacement','',2,'North America','https://example.invalid',false);
  raise exception 'Replacement without confirmation allowed' using errcode='XX000';
 exception when raise_exception then null; end;
 begin
  perform public.publish_ticket((select id from public.games limit 1),'Bad','',0,'North America','https://example.invalid',true);
  raise exception 'Invalid replacement allowed';
 exception when check_violation then null; end;
 assert (select title from public.tickets where host_id=auth.uid())='First ticket';
end $$;
select set_config('request.jwt.claim.sub','c0880000-0000-4000-8000-000000000002',true);
update public.tickets set status='closed' where host_id='c0880000-0000-4000-8000-000000000001';
do $$ begin assert (select status from public.tickets where host_id='c0880000-0000-4000-8000-000000000001')='open'; end $$;
select public.publish_ticket((select id from public.games limit 1),'Other ticket','',2,'North America','https://example.invalid',true);
select set_config('request.jwt.claim.sub','c0880000-0000-4000-8000-000000000001',true);
select public.publish_ticket((select id from public.games limit 1),'Replacement','',2,'North America','https://example.invalid',true);
do $$ begin
 assert (select count(*) from public.tickets where host_id=auth.uid())=1;
 assert (select title from public.tickets where host_id=auth.uid())='Replacement';
 assert exists(select 1 from public.tickets where host_id='c0880000-0000-4000-8000-000000000002');
end $$;
update public.tickets set status='closed' where host_id=auth.uid();
do $$ begin assert (select status from public.tickets where host_id=auth.uid())='closed'; end $$;
select public.publish_ticket((select id from public.games limit 1),'After closing','',2,'North America','https://example.invalid',false);
do $$ begin assert (select title from public.tickets where host_id=auth.uid())='After closing', 'Closed tickets must not trigger warning'; end $$;
reset role;
update public.tickets set created_at=now()-interval '5 hours',expires_at=now()-interval '1 hour' where host_id='c0880000-0000-4000-8000-000000000001';
set local role authenticated;
select public.publish_ticket((select id from public.games limit 1),'After expiry','',2,'North America','https://example.invalid',false);
do $$ begin assert (select title from public.tickets where host_id=auth.uid())='After expiry', 'Expired tickets must not trigger warning'; end $$;
reset role;
rollback;
