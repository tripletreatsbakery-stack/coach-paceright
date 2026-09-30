-- Append a canonical strictly sub-16-minute athlete count; preserve existing metrics.
create or replace view public.v_xc_class_summary with (security_invoker = true) as
 SELECT season,
    graduation_year,
    class_name,
    count(*)::integer AS athlete_count,
    sum(race_count)::integer AS result_count,
    round(avg(season_best_seconds), 2) AS avg_season_best_seconds,
    round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (season_best_seconds::double precision))::numeric, 2) AS median_season_best_seconds,
    round(avg(season_best_seconds) FILTER (WHERE class_sb_rank <= 5), 2) AS top5_avg_seconds,
    count(*) FILTER (WHERE season_best_seconds < 1020::numeric)::integer AS sub_17,
    count(*) FILTER (WHERE season_best_seconds < 1080::numeric)::integer AS sub_18,
    count(*) FILTER (WHERE season_best_seconds < 1140::numeric)::integer AS sub_19,
    count(*) FILTER (WHERE season_best_seconds < 1200::numeric)::integer AS sub_20,
    round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (season_improvement_seconds::double precision))::numeric, 2) AS median_season_improvement_seconds,
    round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (yoy_improvement_seconds::double precision)) FILTER (WHERE yoy_improvement_seconds IS NOT NULL)::numeric, 2) AS median_yoy_improvement_seconds,
    count(yoy_improvement_seconds)::integer AS yoy_athlete_count,
    count(*) FILTER (WHERE season_best_seconds < 960::numeric)::integer AS sub_16
   FROM public.v_xc_class_athlete
  GROUP BY season, graduation_year, class_name;
