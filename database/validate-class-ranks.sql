-- Read-only independent check of latest-season display ranks. No schema changes.
with periods(label,years) as (values ('5',5),('10',10),('all',null::integer)),
compared as (
  select p.label,s.* from periods p cross join public.v_xc_class_summary s
  where s.season <= (select max(season) from public.v_xc_class_summary)
    and (p.years is null or s.season >= (select max(season) from public.v_xc_class_summary)-p.years+1)
), ranked as (
  select *,
    rank() over(partition by label,class_name order by top5_avg_seconds nulls last) as top5_rank,
    count(top5_avg_seconds) over(partition by label,class_name) as top5_total,
    rank() over(partition by label,class_name order by median_season_best_seconds nulls last) as median_rank,
    count(median_season_best_seconds) over(partition by label,class_name) as median_total
  from compared
)
select label,class_name,season,
  case when top5_avg_seconds is not null then top5_rank end as top5_rank,top5_total,
  case when median_season_best_seconds is not null then median_rank end as median_rank,median_total
from ranked where season=(select max(season) from public.v_xc_class_summary)
order by label,class_name;
