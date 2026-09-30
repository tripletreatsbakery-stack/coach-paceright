-- Canonical team history: unique athlete season bests, independent of class/status.
-- Match class reporting's XC 5K distance band. No existing policies are changed.
create view public.v_xc_team_season with (security_invoker = true) as
with athlete_bests as (
  select extract(year from m.date)::integer as season,
    a.id as athlete_id, a.full_name, min(r.time_seconds) as season_best_seconds
  from public.results r
  join public.meets m on m.id = r.meet_id
  join public.athletes a on a.id = r.athlete_id
  where m.sport_type = 'XC' and m.distance_km between 4.9 and 5.1
    and m.date is not null and r.time_seconds > 0
    and r.time_seconds::text not in ('NaN', 'Infinity', '-Infinity')
  group by extract(year from m.date)::integer, a.id, a.full_name
), ranked as (
  select *, row_number() over (
    partition by season order by season_best_seconds, full_name, athlete_id
  ) as team_sb_rank from athlete_bests
)
select season, count(*)::integer as athlete_count,
  count(*) filter (where team_sb_rank <= 5)::integer as top5_athlete_count,
  case when count(*) >= 5 then avg(season_best_seconds) filter (where team_sb_rank <= 5) end as top5_avg_seconds,
  jsonb_agg(jsonb_build_object(
    'athlete_id', athlete_id, 'full_name', full_name,
    'season_best_seconds', season_best_seconds, 'team_sb_rank', team_sb_rank
  ) order by team_sb_rank) filter (where team_sb_rank <= 5) as top5_athletes
from ranked group by season;
comment on view public.v_xc_team_season is
  'XC 4.9-5.1 km season bests of five unique athletes. No status or graduation filter. Fewer than five athletes yields a null average. Caller permissions apply.';
revoke all on public.v_xc_team_season from public, anon, authenticated;
grant select on public.v_xc_team_season to anon, authenticated;
