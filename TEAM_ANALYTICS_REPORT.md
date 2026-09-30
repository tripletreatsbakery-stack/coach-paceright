# Team Analytics and visible class benchmarks

Validated against Supabase on September 30, 2026.

Team Analytics is a sibling of Current season and Class Analytics at `/#analytics/team`. Every class card now shows its historical-best class immediately below the Top-5 time. Both ranks and benchmarks use the same season window; class comparisons also require the same grade. A selected class that holds the minimum displays “This class.” Tied benchmarks prefer the selected row, otherwise the earliest tied season.

## Canonical team source

Applied `supabase/migrations/20260930155526_coach_xc_team_season.sql` to create `public.v_xc_team_season`. It exposes `season`, `athlete_count`, `top5_athlete_count`, `top5_avg_seconds`, and `top5_athletes` (athlete ID, name, season-best seconds, team SB rank).

The database takes each unique athlete's fastest positive finite XC time, using the existing class reports' 4.9–5.1 km meet-distance band. It selects exactly five unique athletes per season, with deterministic name/ID tie breaking, and averages their season bests at full database precision. Neither graduation year nor active status filters the source. A season with fewer than five athletes has a null average and is excluded from historical rank denominators. React only filters historical windows, determines ranks/benchmarks, and formats canonical values.

The new view uses `security_invoker=true` and read-only grants to `anon`/`authenticated`. Anonymous SQL and REST reads succeeded. No existing RLS policy, class metric, authentication implementation, parent app, or athlete app was changed. No privileged frontend credentials were introduced.

## Exact class validation

Direct SQL against `v_xc_class_summary`; browser assertions verified these displayed values.

| Selected sophomore season | Window | Rank | Selected average, seconds (display) | Historical best | Best average, seconds (display) |
|---|---|---|---|---|---|
| 2026 | 2022–2026 | 2nd of 5 | 1006.60 (16:46.6) | Class of 2025, Sophomores 2022 | 990.46 (16:30.5) |
| 2026 | 2017–2026 | 3rd of 10 | 1006.60 (16:46.6) | Class of 2021, Sophomores 2018 | 989.84 (16:29.8) |
| 2026 | 2010–2026 | 3rd of 17 | 1006.60 (16:46.6) | Class of 2021, Sophomores 2018 | 989.84 (16:29.8) |
| 2020 | 2016–2020 | 3rd of 5 | 1044.58 (17:24.6) | Class of 2021, Sophomores 2018 | 989.84 (16:29.8) |
| 2020 | 2010–2020 | 5th of 11 | 1044.58 (17:24.6) | Class of 2021, Sophomores 2018 | 989.84 (16:29.8) |

## Exact team validation

2026 has 50 qualifying athletes. The five contributing athletes are:

| Athlete | Season best, seconds | Display |
|---|---:|---|
| Banner Barnes | 923.2 | 15:23.2 |
| Isaiah Vohs | 926.0 | 15:26.0 |
| Jack Rush | 965.6 | 16:05.6 |
| Matt Huseman | 971.0 | 16:11.0 |
| Gavin Flynn | 979.1 | 16:19.1 |

Sum: **4764.9 seconds**. Average: **952.98 seconds**, displayed **15:53.0**.

| Selected season | Window | Rank | Selected average, seconds (display) | Historical best season | Best average, seconds (display) |
|---|---|---|---|---|---|
| 2026 | 2022–2026 | 5th of 5 | 952.98 (15:53.0) | 2025 | 919.76 (15:19.8) |
| 2026 | 2017–2026 | 6th of 10 | 952.98 (15:53.0) | 2025 | 919.76 (15:19.8) |
| 2026 | 2010–2026 | 6th of 17 | 952.98 (15:53.0) | 2025 | 919.76 (15:19.8) |
| 2020 | 2016–2020 | 1st of 5 | 941.22 (15:41.2) | 2020 (This team) | 941.22 (15:41.2) |
| 2020 | 2010–2020 | 1st of 11 | 941.22 (15:41.2) | 2020 (This team) | 941.22 (15:41.2) |

The 2026 benchmark stays 2025 across all three periods because it is the minimum in each eligible window. Synthetic browser fixtures additionally verify a benchmark that changes for each period, a future season with a faster average that must be excluded, self-best labels, and missing/denied data.

## Verification

- Independent raw-result SQL checked all 17 team seasons (2010–2026): **0 mismatched averages**, **0 invalid/duplicate front fives**, **0 mismatched individual season bests**.
- Unit and browser checks cover inclusive windows, future exclusion, same-grade matching, tie handling, visible benchmarks, navigation, canonical athlete lists, permissions, exports, and responsive layout.
- `scripts/validate-team-analytics.mjs` verifies actual anonymous Supabase data and the rendered UI at desktop, tablet and mobile sizes. It can also target production by passing `https://coach.paceright.run`.
- Supabase security advisor reported no finding for the new view. Existing shared-project findings remain outside this change: notably [existing definer views](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view) and [existing tables without RLS](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public). No shared policies or unrelated applications were altered.
