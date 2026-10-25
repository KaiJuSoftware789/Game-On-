# VALORANT accounts and in-game leaderboard setup

Implemented: Riot ID profile card, Tracker.gg profile link, three-calendar-month identity-change lock, native-rank leaderboard display, and Supabase persistence/access controls. Live Riot/Tracker account authorization and rank retrieval are **not implemented**. A typed username is not proof of account ownership.

## Connect the existing Supabase project

1. Review and apply `supabase/migrations/202610250001_public_rankings.sql` to the intended project. This is an initial, previously unapplied migration, replacing the earlier draft community ladder. It creates a private `game_on_rankings` schema and narrow `public.ranking_*` RPCs. If an earlier draft was applied elsewhere, prepare a separate migration instead of rerunning this initial file. Never apply `tests/rankings-db-bootstrap.sql` to a hosted project.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in environment settings, then rebuild/restart. Keep service-role credentials out of `NEXT_PUBLIC_*` variables and browser code. The current frontend needs only the publishable key.
3. Enable Supabase Email authentication and email confirmation. Set the Site URL to the app origin and allow `<app-origin>/auth/callback`. Successful confirmation returns to the game accounts section of the profile.
4. In restricted cloud environments, allow the exact Supabase project hostname. Saved cloud configuration drafts must be reviewed/published and the environment restarted before they take effect. No project credentials or hostname are currently configured.
5. Test registration, hosted email confirmation, sign-in, saving a Riot ID, attempting an early change, and cross-device persistence with test users. Local PostgreSQL and mocked browser checks do not validate hosted auth or email delivery.

## Identity-change rule

Each signed-in Game On account currently has one VALORANT Riot ID. It is normalized as `Name#Tag`, with a 3–16 character game name and a 3–5 alphanumeric tag. Saving uses server time and a per-user transaction lock. The earliest allowed change is three calendar months later in UTC, with end-of-month clamping. For example, November 30 becomes February 28, or February 29 in a leap year. The UI displays the exact unlock time in the viewer's time zone.

Saving the same ID, including case-only changes, is a no-op. Hiding/showing a rank and signing out do not reset the lock. There is no client delete-and-readd path. An eligible change resets the lock and discards the old account's rank. The general player profile name is separate. The browser-only preview is explicitly local and can be cleared; it cannot enforce the public rule.

## Authorized rank data still needed

The requested reference is https://tracker.gg/valorant/. The app links to the corresponding player profile. It does not scrape Tracker.gg, use its private endpoints, or claim that an API connection exists. This cloud environment denied direct access to the Tracker and Riot documentation hosts during setup, so current provider availability could not be checked here.

Before adding a live adapter:

- Obtain approved Riot account authorization/data access or a Tracker Network agreement that explicitly provides VALORANT current ranks. Confirm the provider actually supports that data for the intended players; do not assume an API key alone enables it.
- Verify that the signed-in user controls the Riot account and respect the provider's consent and visibility rules. Do not infer ownership from a typed Riot ID.
- Fetch the current competitive rank for the relevant region/act. A tier from the most recent match or a past act is not necessarily the current rank. Handle private accounts, unranked players, resets, missing data, rate limits, and revoked access explicitly.
- Keep provider credentials and access tokens in a trusted server environment. Add only required hosts to the environment allowlist.

`public.ranking_apply_verified_rank` is a **server-only storage contract**, executable only by `service_role`. A future trusted adapter can call it after the above checks, passing the user ID, expected Riot ID and change timestamp, native rank label, observation timestamp, and authorized source (`riot` or `tracker`). Browsers cannot submit ranks or timestamps. Imports reject changed identities, unknown tiers, future timestamps, and observations older than 24 hours. Out-of-order observations cannot overwrite newer ranks. The schema deliberately stores no invented rating or game statistics.

Boards and account cards omit observations older than 24 hours. Username changes invalidate prior observations. Only visible accounts with fresh imported ranks appear publicly, with the Riot ID, native tier, and update time. Emails and other local profile details are never included. Equal native tiers share positions; alphabetical order stabilizes ties. Positions are within Game On's board, not claimed global Riot placement. Hiding a rank removes it from public boards while retaining the identity-change lock.

## Verification

`npm test` checks native tier ordering, identity validation, calendar boundaries, the exact cooldown boundary, and storage corruption/untrusted rank data, plus existing session/profile behavior.

`npm run test:rankings:db` applies the migration to a disposable, network-isolated PostgreSQL 17 container with synthetic Auth roles. It checks anonymous/client permissions, ownership, cooldown enforcement, privacy, stale identity imports, rank ordering and ties, observation freshness, and timestamp ordering. It cleans up its container afterward. These tests use synthetic rank fixtures, not live game data.
