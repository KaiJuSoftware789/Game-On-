\o /dev/null
set role anon;
set request.jwt.claim.sub='';
select public.test_assert((public.ranking_board('valorant','competitive')->>'total')::int=0,'empty board contains no invented ranks');
do $$ begin
 begin perform public.ranking_save_username('Nova#NA1'); raise exception 'anonymous write allowed'; exception when insufficient_privilege then null; end;
 begin perform public.ranking_account(); raise exception 'anonymous private profile read allowed'; exception when insufficient_privilege then null; end;
 begin perform count(*) from game_on_rankings.accounts; raise exception 'private tables readable'; exception when insufficient_privilege then null; end;
end $$;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.ranking_save_username('Nova#NA1');
select public.test_assert(public.ranking_account()->'game_accounts'->0->>'username'='Nova#NA1','username saved on own profile');
select public.test_assert(public.ranking_account()->'game_accounts'->0->'ranks'='[]'::jsonb,'username alone does not create a rank');
select public.test_assert((public.ranking_board('valorant','competitive')->>'total')::int=0,'unsynced username absent from board');
select set_config('test.original_changed',public.ranking_account()->'game_accounts'->0->>'changedAt',false);
select public.ranking_save_username('nova#na1');
select public.test_assert(public.ranking_account()->'game_accounts'->0->>'changedAt'=current_setting('test.original_changed'),'case-only save preserves lock');
select public.ranking_set_visibility(false);
select public.ranking_set_visibility(true);
select public.test_assert(public.ranking_account()->'game_accounts'->0->>'changedAt'=current_setting('test.original_changed'),'hide/show preserves lock');
do $$ begin
 begin perform public.ranking_save_username('Other#NA1'); raise exception 'cooldown bypassed'; exception when raise_exception then if sqlerrm='cooldown bypassed' then raise; end if; end;
 begin perform public.ranking_apply_verified_rank('00000000-0000-0000-0000-000000000001','Nova#NA1',now(),'Radiant',now(),'riot'); raise exception 'client forged rank'; exception when insufficient_privilege then null; end;
 begin delete from game_on_rankings.accounts; raise exception 'client erased lock'; exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_assert(public.ranking_account()->'game_accounts'='[]'::jsonb,'other player cannot read private account');
do $$ begin
 begin perform public.ranking_save_username('NoTag'); raise exception 'invalid id allowed'; exception when raise_exception then if sqlerrm='invalid id allowed' then raise; end if; end;
 begin perform public.ranking_save_username('Name#A!1'); raise exception 'invalid tag allowed'; exception when raise_exception then if sqlerrm='invalid tag allowed' then raise; end if; end;
end $$;
select public.ranking_save_username('Orbit#EU1');
select set_config('test.second_changed',public.ranking_account()->'game_accounts'->0->>'changedAt',false);
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select public.ranking_save_username('Atlas#NA1');
select set_config('test.third_changed',public.ranking_account()->'game_accounts'->0->>'changedAt',false);
set role service_role;
select public.ranking_apply_verified_rank('00000000-0000-0000-0000-000000000001','Nova#NA1',current_setting('test.original_changed')::timestamptz,'Gold 2',now(),'riot');
select public.ranking_apply_verified_rank('00000000-0000-0000-0000-000000000002','Orbit#EU1',current_setting('test.second_changed')::timestamptz,'Immortal 1',now(),'tracker');
select public.ranking_apply_verified_rank('00000000-0000-0000-0000-000000000003','Atlas#NA1',current_setting('test.third_changed')::timestamptz,'Immortal 1',now(),'riot');
do $$ begin
 begin perform public.ranking_apply_verified_rank('00000000-0000-0000-0000-000000000001','Wrong#NA1',current_setting('test.original_changed')::timestamptz,'Radiant',now(),'riot'); raise exception 'stale identity imported'; exception when raise_exception then if sqlerrm='stale identity imported' then raise; end if; end;
 begin perform public.ranking_apply_verified_rank('00000000-0000-0000-0000-000000000001','Nova#NA1',current_setting('test.original_changed')::timestamptz,'Invented tier',now(),'riot'); raise exception 'invalid tier imported'; exception when raise_exception then if sqlerrm='invalid tier imported' then raise; end if; end;
 begin perform public.ranking_apply_verified_rank('00000000-0000-0000-0000-000000000001','Nova#NA1',current_setting('test.original_changed')::timestamptz,'Gold 2',now()+interval '1 day','riot'); raise exception 'future timestamp imported'; exception when raise_exception then if sqlerrm='future timestamp imported' then raise; end if; end;
end $$;
-- Out-of-order responses never overwrite a more recent rank.
select public.ranking_apply_verified_rank('00000000-0000-0000-0000-000000000001','Nova#NA1',current_setting('test.original_changed')::timestamptz,'Iron 1',now()-interval '1 hour','riot');
set role anon;
set request.jwt.claim.sub='';
select public.test_assert((public.ranking_board('valorant','competitive')->>'total')::int=3,'synced ranks publicly visible');
select public.test_assert(public.ranking_board('valorant','competitive')->'entries'->0->>'rank_name'='Immortal 1','native rank order');
select public.test_assert((public.ranking_board('valorant','competitive')->'entries'->1->>'position')::int=1,'equal tiers share position');
select public.test_assert((public.ranking_board('valorant','competitive')->'entries'->2->>'position')::int=3,'position skips after tie');
select public.test_assert(public.ranking_board('valorant','competitive')->'entries'->2->>'rank_name'='Gold 2','older observation discarded');
select public.test_assert(public.ranking_board('valorant','competitive')->'mine'='null'::jsonb,'signed-out board has no private account');
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.test_assert((public.ranking_board('valorant','competitive')->'mine'->>'position')::int=3,'own board position');
select public.ranking_set_visibility(false);
select public.test_assert((public.ranking_board('valorant','competitive')->>'total')::int=2,'hiding removes public rank');
reset role;
select public.test_assert(('2026-11-30T12:34:56Z'::timestamptz+interval '3 months')='2027-02-28T12:34:56Z'::timestamptz,'three calendar months clamp month end');
update game_on_rankings.accounts set next_change_at=clock_timestamp() where player_id='00000000-0000-0000-0000-000000000001';
set role authenticated;
select public.ranking_save_username('Changed#NA1');
select public.test_assert(public.ranking_account()->'game_accounts'->0->'ranks'='[]'::jsonb,'changing username clears old rank');
select public.test_assert(public.ranking_account()->'game_accounts'->0->>'visible'='false','identity edit preserves privacy');
select public.test_assert((public.ranking_account()->'game_accounts'->0->>'nextChangeAt')::timestamptz=(public.ranking_account()->'game_accounts'->0->>'changedAt')::timestamptz+interval '3 months','new identity starts a fresh three-month lock');
set role service_role;
do $$ begin
 begin perform public.ranking_apply_verified_rank('00000000-0000-0000-0000-000000000001','Nova#NA1',current_setting('test.original_changed')::timestamptz,'Gold 2',now(),'riot'); raise exception 'old job restored rank after identity change'; exception when raise_exception then if sqlerrm='old job restored rank after identity change' then raise; end if; end;
end $$;
reset role;
update game_on_rankings.synced_ranks set synced_at=now()-interval '25 hours';
set role anon;
set request.jwt.claim.sub='';
select public.test_assert((public.ranking_board('valorant','competitive')->>'total')::int=0,'expired observations are not presented as current');
reset role;
\o
select 'PASS: identity validation, three-month lock, authorization, stale sync rejection, native ranks, ties, freshness and privacy' as result;
