alter table public.tickets drop constraint tickets_region_check;
alter table public.tickets add constraint tickets_region_check check(region in ('North America','Europe','Asia','Africa','Oceania','South America','Any region'));
