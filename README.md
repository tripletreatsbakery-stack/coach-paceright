# PaceRight Coach Portal

Independent, read-only Noblesville boys XC dashboard for https://coach.paceright.run.

## Run and verify

Use Node 24. `npm ci`, copy `.env.example` to `.env.local`, provide the existing project's public anon/publishable key, then `npm run dev`. On Windows with restricted PowerShell scripts use `npm.cmd` / `npx.cmd`.

`npm test` validates formatting, null sorting and export escaping. `npx playwright install chromium` then `npx playwright test` checks desktop/mobile login, denied access, navigation, search, sorting and downloads. Browser tests intercept API responses with test-only fixtures; production has no mock-data mode. `npm run build` produces `dist/`. `npm run preview` serves that build.

## Architecture and references

React 19 + Vite 8 + Supabase JS, pinned in package-lock.json. Hash navigation keeps every route compatible with Pages without rewrite rules. Root asset paths serve the custom domain. The interface preserves the existing black/gold PaceRight styling, with responsive tables and desktop sidebar/mobile horizontal navigation.

Read-only references inspected under `C:\Users\stew4\Documents`:

- `paceright-site-github`: Git checkout for the main PaceRight site; Next.js static export, GitHub Actions Pages workflow. `paceright-site` is a separate non-Git working copy of the same main site.
- `nhs-boys-xc-parents`: plain HTML/CSS/JS, CNAME `parent.paceright.run`.
- `noblesville_boys_cross_country`: plain HTML/CSS/JS, CNAME `athlete.paceright.run`. Public REST reads, authoritative race-neighborhood view, and a temporary Columbus presentation helper.

No reference project files were modified. No existing policies, views, algorithms, athlete records, DNS records, or other site deployments were modified.

## Data contract and calculations

The browser calls only `public.coach_dashboard()`. Its private implementation returns one atomic JSON snapshot without PostgREST row-limit truncation. Base tables: `public.athletes`, `results`, `events`, `meets`. Existing views reused unchanged: `v_athlete_xc_race_vdot` and `v_athlete_xc_race_neighborhood`, including their training-profile/PR dependencies.

The live schema and definitions of `v_athlete_physiology`, `v_athlete_meet_pr_season`, `v_active_athlete_prs_pivot`, and the training-profile view were inspected. The series-PR view can mix distances, and the pivot/weather views contain fixed 2025 logic, so those are not used for current-season 5K statistics.

Additive SQL in `database/coach-portal.sql` was applied to project `ezohjtwkamhxztjzqbrh`. New objects:

- `coach_private.members`: admin-maintained Auth-user allowlist; no athlete/performance data duplicated.
- `coach_private.races`: qualifying race history and chronological PR calculations.
- `coach_private.roster`: active roster with aggregate statistics and improvement metrics.
- `coach_private.dashboard()` and `public.coach_dashboard()`: guarded implementation and invoker RPC wrapper.

Definitions:

- Active season is the database's current calendar year, following the existing VDOT/season views; no browser-year or hardcoded season. Active roster uses `lower(status) = 'active'` and includes runners without results.
- Qualifying results: `meets.sport_type = 'XC'`, event distance 5000m (meet distance fallback only when event distance is null), positive recorded seconds, meet date no later than database current date. Track and other XC distances cannot enter coaching 5K metrics.
- Career PR uses all qualifying historical results. Season mean and SD use only current-season results. SD is sample SD, denominator n−1, unavailable for n<2. Recent statistics use the latest up to three current-season races, ordered by date then result UUID to make same-day ordering deterministic. Recent n is shown.
- Previous best is strictly before the meet date; same-day races cannot be ordered reliably from this schema and do not compare against one another. PRs require strict improvement; first results establish a PR baseline and count as PRs. Ties are not new PRs.
- PR gap = season best − career PR. Meet previous-best delta = result − strictly prior season best. Meet average delta = result − full season-to-date mean (including later meets); this is explicitly different from prior-best comparison.
- Season improvement = first season result − best; percentage divides by first result. Year improvement = previous calendar-season best − current best. Positive improvement means faster.
- Mile pace = seconds × 1609.344 / 5000. All stored calculations use seconds. Display times round to tenths as MM:SS.s; differences are labeled seconds.
- Existing VDOT model weights PR signals 1600/3200/5000 as 20/35/45%, then uses its own race-count-dependent season weighting. SER uses the existing weighted log-distance/time exponent and identifies its source, including VDOT fallback. SIR = 1600 PR − 2 × 800 PR. No physiology or neighborhood formulas are reimplemented in JavaScript.
- Race neighborhood preserves three faster and two similar/slower candidates within its ±1.25 VDOT band, historical target percentages, ±0.75 anchor tolerance, and existing varsity override. Missing slots stay unavailable; we do not fill them with a competing algorithm.

Exports reflect the currently sorted/filtered table, use quoted UTF-8 CSV with BOM and CRLF, preserve human-readable times, and neutralize spreadsheet formula prefixes. Copy uses quoted tab-separated data.

## Authentication and administrator setup

Supabase email/password login; session is held in memory, not persistent local storage. There is no public registration interface. Any new Auth account still needs an explicit coach allowlist entry. No service-role key or password is used by the app or Actions. Vite build-time validation rejects privileged keys before bundling; the client also validates configuration.

An administrator must create/identify each intended coach in Supabase Authentication, provide account/password setup through the normal administration process, and run this in Supabase SQL Editor, substituting the verified email:

```sql
insert into coach_private.members(user_id)
select id from auth.users where lower(email) = lower('COACH_EMAIL_HERE')
on conflict do nothing;
-- Verify exactly the intended account was found:
select u.email, m.granted_at from coach_private.members m
join auth.users u on u.id=m.user_id;
```

Revoke access with `delete from coach_private.members where user_id = 'AUTH_USER_UUID';`. Revocation is checked on the next API call, independent of stale JWT metadata. Already displayed data cannot be recalled from a browser; sign-out clears the app state. Keep `coach_private` out of the Data API exposed-schema list. It is unexposed by default.

The membership table has RLS enabled, no client table grants and no client policies (intentional deny-all). Both private views have client grants revoked. The public RPC is SECURITY INVOKER and not executable by anon. Its private SECURITY DEFINER implementation uses an empty search_path, fully qualified references, and checks `auth.uid()` against the private allowlist on every call. It exposes no writes and trusts neither user metadata nor a browser role flag.

Important scope limitation: existing public sites already expose underlying athlete/performance views. Their shared database also has pre-existing advisor findings for disabled RLS and public definer views. The new coach endpoint is restricted, but this change does not make previously public source data private. Resolving those findings requires a separate coordinated security change to existing applications. The intentional no-policy membership table generates an informational advisor notice.

## Deployment

`.github/workflows/deploy-pages.yml` runs tests, browser checks, builds and deploys `dist` on main. Pages permissions, environment and concurrency follow the inspected existing workflow. `public/CNAME` contains `coach.paceright.run`; `.nojekyll` is included. Pages was verified configured as `workflow`; DNS CNAME points to `tripletreatsbakery-stack.github.io`.

Repository Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` were configured using the existing GitHub credential helper. They are public client configuration. `scripts/github.mjs` supports inspect/configure/jobs without printing credentials.

## Validation and current limitations

Live SQL validation in `database/validate.sql`: roster completeness, XC/active filtering, strictly chronological prior best, mean/sample SD and access privileges. An authorized test used a temporary allowlist entry inside a rolled-back transaction; no access was assigned implicitly. Anonymous and authenticated non-coach calls were rejected with SQLSTATE 42501. The live authorized snapshot contained 51 active runners, 219 current-season races, 605 career qualifying races and 51 existing neighborhoods; one active runner had no season results.

Unavailable by design: actual mile/halfway splits, race-segment fade, official overall/team places (not present in the inspected schema), and current-season weather-adjusted times (existing adjustment views are fixed to 2025). Meet tables show qualifying XC 5K results for active athletes; non-5K/incomplete results do not enter these metrics. No substitute splits, placements, weather model, or race grouping were invented.

Real browser password login cannot be end-to-end verified until an intended coach account is supplied and granted access. Database role authorization is independently tested. See `IMPLEMENTATION_REPORT.md` for final deployment and test status.
