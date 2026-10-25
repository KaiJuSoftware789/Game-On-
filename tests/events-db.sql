\o /dev/null
create function public.test_event(eid uuid,zip text default '60601',lat double precision default 41.8858,lon double precision default -87.6181) returns jsonb language sql as $$
 select jsonb_build_object('id',eid,'title','Community tournament','kind','Tournament','game',jsonb_build_object('id','valorant','name','VALORANT','genre','Tactical shooter','mark','V','theme','coral'),'host','Nova','venue','Community lounge','address','100 Example Street','location',jsonb_build_object('zip',zip,'city','Chicago','state','IL','latitude',lat,'longitude',lon),'startsAt',now()+interval '1 day','endsAt',now()+interval '1 day 3 hours','timezone','America/Chicago','capacity',16,'description','All players welcome.','registrationUrl','','createdAt',now(),'status','scheduled');
$$;
set role anon;
set request.jwt.claim.sub='';
select public.test_assert((public.local_events_search(41.8858,-87.6181,25)->>'total')::int=0,'empty public search works anonymously');
do $$ begin
 begin perform public.local_event_publish(public.test_event('10000000-0000-4000-8000-000000000001')); raise exception 'anonymous publishing allowed'; exception when insufficient_privilege then null; end;
 begin perform count(*) from game_on_events.events; raise exception 'private table readable'; exception when insufficient_privilege then null; end;
 begin perform public.local_events_mine(); raise exception 'anonymous own-event read allowed'; exception when insufficient_privilege then null; end;
end $$;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select set_config('test.event',public.test_event('10000000-0000-4000-8000-000000000001')::text,false);
select public.local_event_publish(current_setting('test.event')::jsonb);
select public.local_event_publish(current_setting('test.event')::jsonb);
select public.test_assert((public.local_events_mine()->>'total')::int=1,'idempotent retry does not duplicate event');
select public.local_event_publish(public.test_event('10000000-0000-4000-8000-000000000002','90210',34.0901,-118.4065));
select public.local_event_publish(jsonb_set(public.test_event('10000000-0000-4000-8000-000000000003','60201',42.0546,-87.6943),'{kind}','"Gaming session"'));
select public.test_assert((public.local_events_search(41.8858,-87.6181,25)->>'total')::int=2,'nearby includes Chicago and Evanston, excludes California');
select public.test_assert((public.local_events_search(41.8858,-87.6181,5)->>'total')::int=1,'radius boundaries respected');
select public.test_assert((public.local_events_search(41.8858,-87.6181,25,'Gaming session')->>'total')::int=1,'event type filter combines with radius');
select public.test_assert((public.local_events_search(41.8858,-87.6181,25,'','unofficial')->>'total')::int=0,'section filter respected');
select public.test_assert((public.local_events_search(41.8858,-87.6181,25,'','all','Fortnite')->>'total')::int=0,'game filter respected');
select public.test_assert((public.local_events_search(41.8858,-87.6181,25)->'events'->0->>'owner')::boolean,'owner recognized');
do $$ declare event jsonb:=public.test_event('10000000-0000-4000-8000-000000000004'); begin
 begin perform public.local_event_publish(jsonb_set(event,'{registrationUrl}','"javascript:alert(1)"')); raise exception 'unsafe URL accepted'; exception when raise_exception then if sqlerrm='unsafe URL accepted' then raise; end if; end;
 begin perform public.local_event_publish(jsonb_set(event,'{game,name}','"Fake official game"')); raise exception 'official label spoofed'; exception when raise_exception then if sqlerrm='official label spoofed' then raise; end if; end;
 begin perform public.local_event_publish(jsonb_set(event,'{title}','{}')); raise exception 'malformed text accepted'; exception when raise_exception then if sqlerrm='malformed text accepted' then raise; end if; end;
 begin perform public.local_event_publish(jsonb_set(event,'{capacity}','1.5')); raise exception 'fractional capacity accepted'; exception when raise_exception then if sqlerrm='fractional capacity accepted' then raise; end if; end;
 begin perform public.local_event_publish(jsonb_set(event,'{startsAt}',to_jsonb((now()-interval '1 day')::text))); raise exception 'past event accepted'; exception when raise_exception then if sqlerrm='past event accepted' then raise; end if; end;
 begin perform public.local_events_search(41.8858,-87.6181,5000); raise exception 'invalid radius accepted'; exception when raise_exception then if sqlerrm='invalid radius accepted' then raise; end if; end;
end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_assert((public.local_events_mine()->>'total')::int=0,'other user cannot see private organizer list');
do $$ begin
 begin perform public.local_event_cancel('10000000-0000-4000-8000-000000000001'); raise exception 'other user cancelled event'; exception when raise_exception then if sqlerrm='other user cancelled event' then raise; end if; end;
 begin perform public.local_event_publish(current_setting('test.event')::jsonb); raise exception 'other user took ownership'; exception when raise_exception then if sqlerrm='other user took ownership' then raise; end if; end;
end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.local_event_cancel('10000000-0000-4000-8000-000000000001');
select public.test_assert((public.local_events_search(41.8858,-87.6181,5)->>'total')::int=0,'cancelled events leave nearby search');
select public.test_assert(public.local_event_get('10000000-0000-4000-8000-000000000001')->'events'->0->'event'->>'status'='cancelled','stable link shows cancellation');
reset role;
update game_on_events.events set ends_at=now()-interval '1 hour' where id='10000000-0000-4000-8000-000000000003';
set role anon;
set request.jwt.claim.sub='';
select public.test_assert((public.local_events_search(41.8858,-87.6181,25)->>'total')::int=0,'past events leave nearby search');
select public.test_assert(not (public.local_event_get('10000000-0000-4000-8000-000000000001')->'events'->0->>'owner')::boolean,'anonymous readers never own events');
select public.test_assert(not (public.local_event_get('10000000-0000-4000-8000-000000000001')->'events'->0->'event' ? 'user_id'),'owner auth id is not public');
reset role;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
do $$ begin
 for n in 4..20 loop perform public.local_event_publish(public.test_event(('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid)); end loop;
 begin perform public.local_event_publish(public.test_event('10000000-0000-4000-8000-000000000021')); raise exception 'daily publication cap bypassed'; exception when raise_exception then if sqlerrm='daily publication cap bypassed' then raise; end if; end;
end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
do $$ begin
 for n in 21..30 loop perform public.local_event_publish(public.test_event(('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid)); end loop;
end $$;
select public.test_assert((public.local_events_search(41.8858,-87.6181,25)->>'total')::int=27,'pagination total includes all matching upcoming events');
select public.test_assert(jsonb_array_length(public.local_events_search(41.8858,-87.6181,25)->'events')=25,'first page is capped at 25');
select public.test_assert(jsonb_array_length(public.local_events_search(41.8858,-87.6181,25,'','all','',25)->'events')=2,'second page returns remaining events');
reset role;
\o
select 'PASS: public search, true distance, combined filters, safe publication, ownership, idempotent retries, cancellation and stale events' as result;
