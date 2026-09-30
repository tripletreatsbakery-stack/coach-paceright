# Historical Class Analytics

## Feature and files

Navigation: **Analytics → Class Analytics**, deep link `/#analytics/classes`. Existing current-season Analytics remains in the adjacent tab. The existing Roster landing page, public-mode authentication flag, Supabase client, hash routing, black/gold styling and Pages workflow are retained.

Four selectable cards appear in Freshmen / Sophomores / Juniors / Seniors order. Each separates front-five average, whole-class median, depth and development, with athlete/result counts. The selected class has a sortable athlete detail table and a newest-first same-grade history table. Both offer plain **Copy for Sheets** TSV and existing CSV export. Missing prior comparisons display an em dash. Small classes and inactive/graduated historical runners are retained. No composite score or subjective class label is generated.

New files:

- `src/components/ClassAnalytics.jsx`: data loading, cards, season/period controls, drill-down, history and expandable help.
- `src/class-data.js`: explicit query fields, pagination, window selection and display-only competition ranks.
- `src/classes.css`: responsive class styling and modest print rules.
- `src/components/DataTable.jsx`: existing table extracted for reuse, with optional descending initial sort, missing-value marker and Sheets copy.
- `tests/class-data.test.js`, `tests/browser/classes.spec.js`: ranking/window, pagination, export, UI and error tests.
- `scripts/validate-classes.mjs`: read-only live browser/database comparison.
- `database/validate-class-ranks.sql`: read-only independent PostgreSQL rank check.
- This report.

Updated: `src/main.jsx` (Analytics subnavigation), `src/format.js` (plain TSV helper), `playwright.config.js` (class tests and tablet viewport), `tests/browser/portal.spec.js` (preserved auth-gate deep-link test), `README.md`, `IMPLEMENTATION_REPORT.md`.

## Supabase queries

The canonical views were inspected for actual columns and definitions before implementation. The existing public client calls:

1. `v_xc_class_summary`: explicit fields in `summaryFields`, ordered by season descending and graduation year ascending. All returned seasons populate the selector; the maximum season is the default. No hardcoded start/end years or active filter.
2. `v_xc_class_athlete`: explicit fields in `athleteFields`, filtered by selected `season`, `graduation_year` and `class_name`. Ordered by canonical `class_sb_rank`, then `season_best_seconds`, then `athlete_id`. No active-status filter and no join to the active roster.

Both reads request exact counts and paginate in 200-row ranges until complete. Requests are cancelled when selection changes or the component unmounts; previous-class results are not shown as the new class. Summary and detail errors are reported separately, with retry controls. Permission failures never trigger another data source or privileged fallback.

Every class metric—including athlete/result counts, season-best times, medians, averages, thresholds, season/YOY improvement and athlete class rank—is used directly from the views. The browser calculates only display-level comparison windows and historical ranks. YOY values remain untouched; the collapsed help note says they compare with the previous recorded season.

## Ranking methodology

- **5 Years:** selected season and four preceding calendar seasons, inclusive. Example: 2026 selects 2022–2026.
- **10 Years:** selected season and nine preceding calendar seasons, inclusive.
- **All History:** earliest available reporting season through the selected season.
- No future seasons, missing-season interpolation, cross-grade comparison or small-class exclusion.
- Compare only matching canonical `class_name` values. Use the original database precision before MM:SS.s/tenths display rounding.
- Competition rank = 1 + number of strictly better values. Ties share a rank and leave gaps, with “(tie)” shown. Rank denominator includes only non-null finite values for that metric.
- Lower Top-5 average/median times rank first. Higher athlete/depth counts and larger positive season improvement rank first. Missing metrics have no rank. These dimensions stay separate.

## Database and browser validation

Live anonymous reads succeeded for both views. At validation, the database returned 68 summaries across 17 seasons (2010–2026), with all four latest-season classes. These years are observations, not application constants.

40 displayed card values were checked against the canonical source (athlete/result counts, Top-5, median, all four thresholds, season improvement and YOY). Twelve athletes across the four classes were spot-checked across all eight displayed columns. The oldest-season Senior detail loaded 15 historical athletes. Actual clipboard output was read back and verified as unquoted eight-column TSV.

Latest-season source snapshot:

| Grade | Athletes | Results | Top-5 avg | Median SB | Sub-17 / 18 / 19 / 20 | Median season improvement |
|---|---:|---:|---|---|---|---:|
| Freshmen | 10 | 44 | 19:35.2 | 20:20.5 | 0 / 1 / 1 / 3 | +56.0 s |
| Sophomores | 17 | 80 | 16:46.6 | 19:13.5 | 5 / 6 / 8 / 11 | +34.7 s |
| Juniors | 10 | 43 | 17:29.0 | 18:57.7 | 2 / 3 / 6 / 7 | +51.0 s |
| Seniors | 13 | 52 | 16:09.0 | 17:40.6 | 5 / 7 / 7 / 9 | +9.9 s |

All 24 Top-5/Median rank comparisons (four grades × three windows × two metrics) matched independent PostgreSQL `rank()` calculations. For example, the latest Sophomore class ranks 2nd/4th of 5 for Top-5/Median, 3rd/8th of 10, and 3rd/15th of 17 for All History.

Seven unit tests pass. Browser coverage includes both authentication modes; current dashboard regression; historical season/card selection; the three windows; missing prior values, missing summary metrics and absent grades; source-view permission errors; plain Sheets copy; CSV; and desktop/tablet/mobile layouts. Live Chromium validation found no browser errors or page-width overflow at 1440, 1024 and 390 pixels. The production build succeeds without a new chart dependency. The existing historical table is used instead of adding a chart package.

To repeat live checks against a local production preview:

```text
npm run build
npm run preview
node --env-file=.env.local scripts/validate-classes.mjs http://127.0.0.1:4173
```

Optionally pass a JSON export of `database/validate-class-ranks.sql` as the final argument to compare the same browser ranks with independent database ranks. Test screenshots/output remain ignored under `test-results/`.

## Security, limitations and deployment

No database schema, reporting view, RLS policy, role grant, existing coach RPC or authentication flag was changed. No privileged key is used. No data/RLS limitation blocks this feature under current anonymous permissions. Missing prior comparisons and classes with fewer than five athletes are displayed normally. The view's existing definitions and historical completeness are not inferred or corrected in the frontend.

Parent and athlete applications were not modified. Deployment uses the existing coach `main` branch GitHub Actions workflow and custom domain. The final task response links the verified deployment run.
