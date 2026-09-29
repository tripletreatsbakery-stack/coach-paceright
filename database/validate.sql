-- Read-only acceptance checks against authoritative production data.
select 'active roster complete' as check_name,
 (select count(*) from coach_private.roster)=(select count(*) from public.athletes where lower(status)='active') as passed
union all
select 'no inactive or non-XC results',not exists(
 select 1 from coach_private.races r join public.athletes a on a.id=r.athlete_id
 join public.meets m on m.id=r.meet_id where lower(a.status)<>'active' or m.sport_type<>'XC')
union all
select 'prior best strictly chronological',not exists(
 select 1 from coach_private.races r where r.previous_best is distinct from
 (select min(p.time_seconds) from coach_private.races p where p.athlete_id=r.athlete_id and p.season=r.season and p.date<r.date))
union all
select 'season mean and sample SD match',not exists(
 select 1 from coach_private.roster a left join lateral (
 select avg(time_seconds) as mean,stddev_samp(time_seconds) as sd from coach_private.races r
 where r.athlete_id=a.athlete_id and r.season=extract(year from current_date)) s on true
 where a.season_average is distinct from s.mean or a.season_sd is distinct from s.sd)
union all
select 'membership RLS enabled',(select relrowsecurity from pg_class where oid='coach_private.members'::regclass)
union all
select 'anon cannot execute',not has_function_privilege('anon','public.coach_dashboard()','execute')
union all
select 'authenticated cannot read membership',not has_table_privilege('authenticated','coach_private.members','select');
