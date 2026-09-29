-- Additive installation. Existing objects and public-site policies are unchanged.
begin;
create schema if not exists coach_private;
revoke all on schema coach_private from public, anon, authenticated;
grant usage on schema coach_private to authenticated;
create table if not exists coach_private.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table coach_private.members enable row level security;
revoke all on coach_private.members from public, anon, authenticated;

create or replace view coach_private.races as
with eligible as (
  select r.id, r.athlete_id, r.meet_id, a.full_name, m.meet_name, m.date,
    extract(year from m.date)::integer as season, r.time_seconds,
    r.time_seconds * 1609.344 / 5000 as mile_pace
  from public.results r join public.athletes a on a.id=r.athlete_id
  join public.meets m on m.id=r.meet_id
  left join public.events e on e.id=r.event_id
  where lower(a.status)='active' and m.sport_type='XC'
    and coalesce(e.distance_m, round(m.distance_km*1000)::integer)=5000
    and r.time_seconds>0 and m.date<=current_date
), prior as (
  select e.*,
    min(time_seconds) over(partition by athlete_id,season order by date range between unbounded preceding and interval '1 day' preceding) as previous_best,
    min(time_seconds) over(partition by athlete_id order by date range between unbounded preceding and interval '1 day' preceding) as previous_career_best,
    avg(time_seconds) over(partition by athlete_id,season) as season_average
  from eligible e
)
select *, previous_best is null or time_seconds<previous_best as season_pr,
  previous_career_best is null or time_seconds<previous_career_best as career_pr,
  time_seconds-previous_best as previous_best_delta,
  time_seconds-season_average as average_delta,
  min(time_seconds) over(partition by athlete_id,season order by date) as best_to_date
from prior;

create or replace view coach_private.roster as
with ranked as (
  select *, row_number() over(partition by athlete_id order by date desc,id desc) as recent_rank
  from coach_private.races where season=extract(year from current_date)
), stats as (
  select athlete_id, min(time_seconds) as season_best, avg(time_seconds) as season_average,
    stddev_samp(time_seconds) as season_sd, count(*)::integer as races,
    percentile_cont(0.5) within group(order by time_seconds) filter(where recent_rank<=3) as recent_median,
    stddev_samp(time_seconds) filter(where recent_rank<=3) as recent_sd,
    count(*) filter(where recent_rank<=3)::integer as recent_count,
    max(time_seconds) filter(where recent_rank=1) as latest,
    (array_agg(time_seconds order by date,id))[1] as first_result
  from ranked group by athlete_id
), career as (
  select athlete_id,min(time_seconds) as career_pr,
    min(time_seconds) filter(where season=extract(year from current_date)-1) as previous_season_best
  from coach_private.races group by athlete_id
)
select a.id as athlete_id,a.full_name,s.season_best,c.career_pr,s.season_average,s.season_sd,
  s.recent_median,s.recent_sd,coalesce(s.recent_count,0) as recent_count,s.latest,
  s.season_best-c.career_pr as pr_gap,coalesce(s.races,0) as races,
  s.first_result-s.season_best as improvement,
  100*(s.first_result-s.season_best)/nullif(s.first_result,0) as improvement_pct,
  c.previous_season_best,c.previous_season_best-s.season_best as year_improvement
from public.athletes a left join stats s on s.athlete_id=a.id
left join career c on c.athlete_id=a.id where lower(a.status)='active';

-- Definer implementation is in an unexposed schema. Every call checks membership.
-- It deliberately provides a narrow read API without granting access to its views.
create or replace function coach_private.dashboard() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from coach_private.members where user_id=auth.uid()) then
    raise exception 'Coach access required' using errcode='42501';
  end if;
  return jsonb_build_object(
    'season',extract(year from current_date)::integer,
    'as_of',current_date,
    'roster',coalesce((select jsonb_agg(to_jsonb(r) order by season_best nulls last,full_name) from coach_private.roster r),'[]'::jsonb),
    'races',coalesce((select jsonb_agg(to_jsonb(r) order by date,id) from coach_private.races r),'[]'::jsonb),
    'meets',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',meet_name,'date',date) order by date desc) from public.meets where sport_type='XC' and extract(year from date)=extract(year from current_date)),'[]'::jsonb),
    'physiology',coalesce((select jsonb_agg(to_jsonb(v)) from public.v_athlete_xc_race_vdot v join public.athletes a on a.id=v.athlete_id where lower(a.status)='active'),'[]'::jsonb),
    'groups',coalesce((select jsonb_agg(to_jsonb(v)) from public.v_athlete_xc_race_neighborhood v join public.athletes a on a.id=v.athlete_id where lower(a.status)='active'),'[]'::jsonb)
  );
end $$;
revoke all on all tables in schema coach_private from public,anon,authenticated;
revoke all on function coach_private.dashboard() from public,anon,authenticated;
grant execute on function coach_private.dashboard() to authenticated;
create or replace function public.coach_dashboard() returns jsonb
language sql stable security invoker set search_path='' as $$ select coach_private.dashboard(); $$;
revoke all on function public.coach_dashboard() from public,anon;
grant execute on function public.coach_dashboard() to authenticated;
commit;
