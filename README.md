# Game-On!

Find gaming sessions that match your game, platform, region, and play style.
Signed-in players can message each other from public profiles or the player search on the Messages page. The sidebar lists pinned conversations first, then conversations by most recent access (new incoming conversations use their latest message time until opened). Conversation pins and individually pinned messages are private to each account. Messages update live with periodic refresh as a fallback; older history can be loaded in batches. Only sender and recipient can read a message. Apply all pending migrations before using messaging.

Messaging access checks: `Get-Content supabase/tests/messages.sql -Raw | docker exec -i supabase_db_game-on psql -U postgres -d postgres -v ON_ERROR_STOP=1`. Fixtures are rolled back.

Find open gaming sessions, create a ticket, and share the games you play on a public player profile.

The current version supports searching and filtering sample sessions, opening session details, and creating sessions with a player limit, optional schedule, description, and voice preference. **Created sessions are stored in this browser's local storage, not published online.** Samples are labeled and cannot be joined. Game usernames and in-game leaderboards have an optional Supabase integration. Online session sharing and joining remain future work.

## Development

Use Node.js 24 (the cloud environment provides 24.19.0) and npm:

```sh
npm ci
NEXT_TELEMETRY_DISABLED=1 npm run dev
```

No credentials are needed for local sessions, profiles, or the game-account preview. Shared accounts and leaderboards require Supabase configuration.

```sh
npm test
npm run lint
NEXT_TELEMETRY_DISABLED=1 npm run build
npm run start
```

The build includes TypeScript validation. Google Fonts are fetched during compilation; restricted environments need HTTPS access to `fonts.googleapis.com` and `fonts.gstatic.com`.

Session data uses the `game-on:sessions:v1` local-storage key and synchronizes between tabs in the same browser. Clearing site data removes created sessions. Storage failures keep the creation form open, and malformed saved data is reported without overwriting it.

## Phone passwordless sign-in and passkeys

### Manage Connections

Account lists linked Supabase identities under Manage Connections. Edit opens provider-managed settings or lets a user replace the connected account. Removing/replacing requires at least two existing identities, and replacement disconnects the old provider before starting the new linking flow. Canceling OAuth leaves that provider disconnected; the other sign-in method remains available. Missing OAuth connections can be added using Connect. Enable Manual Linking in hosted Supabase Auth settings; `enable_manual_linking=true` is configured locally. Email and phone identity details are edited through Account Info. Third-party passwords and profile settings are managed by their provider.

### Account info editing

Account Info shows the public username and masked connected email/phone, with Reveal and Edit controls. Editing starts a ten-minute request tied to the current user and session. Reauthenticate with the current password or an existing connected sign-in method, complete any enrolled 2FA, then save. Email and phone changes require Supabase's contact confirmation flow. Passwords are never saved in browser storage; pending edit values survive OAuth redirects in session storage.

Apply `20261028110000_account_edit_verification.sql` and run `supabase/tests/account_edit_verification.sql`. These checks enforce fresh authentication and a later second factor on the account editor's server endpoint, with single-use edit requests. Existing Supabase Auth contact-change confirmation settings must remain enabled. OAuth providers control their own consent and credential prompts; the app never asks for a Google or Discord password. A reauthentication must return to the same Game-On account. Real email/SMS delivery and WebAuthn device prompts require manual verification with configured providers.

### Passkey two-factor authentication

Signed-in users can enable a separate WebAuthn second factor in Account → Two-factor authentication. This requires approval after the initial sign-in and supports adding backup passkeys and removing factors after verification. Passwordless sign-in passkeys and MFA passkeys are separate enrollments. WebAuthn MFA is experimental in the Supabase SDK.

Enable WebAuthn MFA enrollment and verification in Supabase Auth, with the correct relying-party domain/origins. The local config enables `auth.mfa.web_authn`; restart the local Supabase stack to apply Auth settings. Use a stable hostname (localhost and 127.0.0.1 are different passkey domains).

Apply `20261028100000_passkey_mfa.sql` before allowing enrollment in production. It adds restrictive policies for existing public RLS tables and sets the PostgREST pre-request hook `public.require_mfa` to protect RPCs that bypass RLS. If you already have a custom pre-request hook, combine its checks with this function rather than replacing it. New RLS tables should add the same MFA policy. The migration does not affect unenrolled users. Test using `supabase/tests/passkey_mfa.sql`.

Keep at least one backup second-factor device. Recovery from losing every second factor requires a trusted account recovery process; no automatic email bypass is provided.

Account supports SMS sign-in codes alongside social sign-in. Enter a phone number including its country code, request a code, and verify it to sign in or create an account. Codes are verified by Supabase; the app never stores them. Phone numbers remain in Auth and are not copied into public profiles. Signing in with a new phone number creates a separate account from an existing social account; this flow does not link accounts.

For hosted Supabase, enable **Authentication → Providers → Phone**, allow phone signups, and configure an SMS provider such as Twilio. Keep credentials in Supabase. Configure server-side SMS rate limits and spend limits before public rollout; the UI's 60-second resend timer is only a convenience. The phone form reads availability from Supabase's Auth settings.

Local SMS signup and phone confirmation are enabled in `supabase/config.toml`. Configure the existing Twilio section with real credentials to send messages, or uncomment `auth.sms.test_otp` with a development-only phone/code pair to test without sending texts. Never configure fixed test codes on a production project. Restart the local stack after changing Auth configuration; do not reset the database.

Passkeys use Supabase's experimental native WebAuthn support. In **Authentication → Passkeys**, enable passkeys and configure the relying party display name, stable domain ID (no scheme or port), and allowed HTTPS app origins. Then set `NEXT_PUBLIC_ENABLE_PASSKEYS=true` in `.env.local` or the deployment environment and restart/rebuild the app. This flag exposes the UI; it does not enable the Auth service. Users sign in first with a phone or social provider, add a passkey in Account, then use **Sign in with a passkey** on subsequent visits. Account also lists and removes registered passkeys. Keep access to the original sign-in method as a fallback.

For local passkey testing, add the following to `supabase/config.toml` and restart Supabase, using `http://localhost:3000` for the app:

```toml
[auth.passkey]
enabled = true

[auth.webauthn]
rp_display_name = "Game-On!"
rp_id = "localhost"
rp_origins = ["http://localhost:3000"]
```

Passkeys require a browser with WebAuthn and HTTPS (localhost is allowed). Changing the relying party ID invalidates previously registered passkeys. Both SMS sign-in and passkeys use the existing Supabase session and database permissions; no additional 2FA prompt is added.

Manual verification with configured Auth: request an SMS code, reject an incorrect/expired code, resend after the cooldown, switch phone numbers, and verify the correct code reaches the requested page with a session. Register a passkey, sign out, sign back in with it, cancel a browser prompt and retry, then remove the passkey and confirm the original sign-in method still works. Verify a phone-created account receives a public Player profile without exposing the phone number.

References: [Supabase phone sign-in](https://supabase.com/docs/guides/auth/phone-login) and [passkey configuration](https://supabase.com/docs/guides/auth/passkeys).

## Custom multiplayer games

The built-in catalog is labeled **Official** (supported by Game On). Player-added games belong to **Unofficial**. Use **All sections**, **Official games**, and **Unofficial games** to filter sessions and the game picker. This label describes app support, not publisher endorsement or live account integration.

Choose **Add game** next to the game filters, or **Add or customize a game** while creating a session. Set the game name, an optional category and badge (up to three letters or numbers), and a card color. A live preview shows the result. New games become available in session creation, filters, and search immediately.

Open the same editor and choose a game from **Your game library** to rename or restyle it. Existing sessions stay linked to the game. Duplicate names are rejected, and games are saved locally alongside sessions, including across reloads and tabs. Sessions saved before custom games were introduced remain supported.

## Player profiles and achievements

Open **Your profile** to edit your player name and bio, record per-game hours played, assists, and kills, and add notable game achievements or personal milestones. Stats and achievements support both game sections. Leave irrelevant stats blank; zero means a recorded total of zero. Hours support one decimal place; kills and assists use whole numbers. Achievements can include a story and an optional date, today or earlier. Use each card’s edit button to update or remove an entry.

Profiles use the separate `game-on:profile:v1` local-storage key and sync across tabs. Custom game renames remain linked to profile entries, and the profile name prefills new session forms. **Profiles and all statistics are self-reported, visible only in the current browser, and not connected to game accounts.** Clearing browser site data removes them. Storage errors leave the form open for retry; malformed data is never silently replaced.

## VALORANT usernames and in-game ranks

Open **Your profile → Game accounts** to save a full Riot ID (`Name#Tag`). It appears in a VALORANT rank card with a link to that account on Tracker.gg. First save and each subsequent username change start a **three-calendar-month** lock, clamped at month end. Changing the saved Riot ID does not rename the actual Riot account. The general Game On profile name is separate and remains editable.

Without Supabase, the account preview uses `game-on:game-accounts:v1` in browser storage. This local lock is a preview, not an enforceable restriction across devices. When connected, the server owns the username and change timestamps, rejects early changes, and preserves the lock through sign-out and hiding/showing leaderboard participation. Changing an eligible username removes the old synced rank. Existing profile stats, achievements, sessions, and custom games stay intact.

**Rankings** displays only native in-game ranks, starting with VALORANT Competitive. Equal tiers share a board position. Official/Unofficial filters remain available; unavailable rank features display **Feature coming soon**. Local profile statistics do not affect leaderboard positions.

**Live Riot/Tracker rank syncing is not implemented or connected.** Saving a Riot ID does not verify ownership or fetch a rank. Until an authorized provider integration is available, profile cards and unavailable leaderboards show **Feature coming soon**. No sample players or manually entered ranks are presented as live results. The existing database includes a restricted server import contract for future authorized data; it is not a working provider adapter.

See [Supabase and rank data setup](docs/rankings-setup.md). Database checks use a disposable PostgreSQL container:

```sh
npm run test:rankings:db
```

## Nearby gaming events

Open **Local events** to find tournaments and in-person gaming sessions by U.S. ZIP code. Choose a 5–50 mile radius and filter by event type, game, or Official/Unofficial section. Distances are approximate straight-line distances between ZIP centers.

Use **Host an event** to add a venue/address, date and venue time zone, organizer, player limit, and optional registration link. Events can be saved in this browser and shared by link immediately. Recipients can open the invitation and save it to their own event list. Shared local links contain a snapshot, so changed/cancelled events need a new link. A public deployment origin is required for links to work outside the local development machine.

**Public event feed · Coming soon** appears until the existing Supabase project is configured. The prepared public integration supports email sign-in, explicit publishing, nearby discovery, stable share links, and organizer-only cancellation. It does not upload local events automatically. See [local event setup](docs/local-events-setup.md) for the migration and configuration.

## Live tickets and connected accounts

The Supabase-backed live ticket board is available at `/tickets`, with account settings at `/account`, game selections at `/games`, and public player profiles at `/players/<id>`. These routes preserve the connected features from main. Local browsing remains at `/`. See [live ticket and OAuth setup](docs/live-tickets-setup.md).
If the Windows Turbopack CSS worker exits before connecting, use the supported Webpack fallback: `npm run build -- --webpack` (or `npm run dev -- --webpack`). The final production build was verified with this fallback.

### Usernames and player reports

Players can change their public display name in Account. Names are not unique account identifiers: links and messages continue to use immutable profile IDs. New names accept 3–32 ASCII letters, digits, spaces, dots, underscores and hyphens. The database filter normalizes common numeric substitutions and punctuation, and rejects a curated English profanity/slur list. This is a baseline filter, not comprehensive multilingual moderation; it can also reject innocent names containing blocked substrings. Provider names that fail validation fall back to Player for new accounts.

Signed-in players can report another player from their public profile. Reports are stored privately in `public.player_reports`; clients cannot read or modify them. Submissions are capped at five per rolling 24 hours, with one pending report per target/reason. Authorized operators can review pending reports in the Supabase dashboard and change `status` to `reviewed` or `dismissed`. No automated penalties, notification delivery or moderator dashboard is implemented. Keep database/service-role access restricted to trusted operators.

Regression checks: run `supabase/tests/usernames_reports.sql` against the local database with psql. The test transaction rolls back all fixtures.

### Profile privacy

Edit profile includes Public/Private mode. Existing and new profiles start public; selecting Private defaults to Friends and me, with an Only me option. Username/ID remain searchable for messaging and reporting. Bio lives in `profile_details` and game selections use the same database access rule: public, owner, or accepted friend when allowed. Pending requests grant no access. Friend controls are available on other player profiles. Removing a friendship removes private-profile access. Profile privacy does not change visibility of tickets users post publicly.

Run `supabase/tests/profile_privacy.sql` for rollback-only database access checks. Bio editors now read `profile_details`, replacing the earlier `profiles.bio` column.
