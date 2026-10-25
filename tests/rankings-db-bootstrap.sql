-- Only for the disposable PostgreSQL test container, never a hosted project.
create role anon;
create role service_role;
create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function public.test_assert(condition boolean, message text) returns void language plpgsql as $$ begin if condition is distinct from true then raise exception 'ASSERTION FAILED: %',message; end if; end; $$;
insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
