# Game-On!

Signed-in players can message each other from public profiles or the player search on the Messages page. The sidebar lists pinned conversations first, then conversations by most recent access (new incoming conversations use their latest message time until opened). Conversation pins and individually pinned messages are private to each account. Messages update live with periodic refresh as a fallback; older history can be loaded in batches. Only sender and recipient can read a message. Apply all pending migrations before using messaging.

Messaging access checks: `Get-Content supabase/tests/messages.sql -Raw | docker exec -i supabase_db_game-on psql -U postgres -d postgres -v ON_ERROR_STOP=1`. Fixtures are rolled back.

Find open gaming sessions, create a ticket, and share the games you play on a public player profile.

## Run locally

1. Install dependencies with `npm install`.
2. Start Docker and run `npx supabase start`.
3. Run `npx supabase migration up --local` to apply pending migrations without resetting data.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` using the local Supabase project values.
5. Run `npm run dev` and open `http://localhost:3000`.

The database migrations create the game catalog, tickets, public profiles, and game selections. Tickets are never seeded with sample sessions. The live board reads open, unexpired tickets, subscribes to Supabase Realtime, and refreshes every 30 seconds as a fallback and to remove expired sessions. Each ticket lasts four hours; its host can close it early. The board shows the latest 100 open tickets.

Game selections and display names are public, including to signed-out visitors, at `/players/<user-id>`. Email addresses and sign-in details are not copied into public profiles. Only the account owner can save their game selections. Saves are transactional, so a failed request does not erase the previous lineup.

## Enable social sign-in

The app implements Supabase OAuth with a PKCE callback at `/auth/callback`, session refresh, and sign-out. Provider credentials are still required before real users can sign in. The Account page reads Google and Discord availability from Supabase and shows unconfigured options as unavailable.

### Google and Discord

Create an OAuth application with each provider and enable the matching provider in Supabase Authentication. Keep client secrets in Supabase, never in `NEXT_PUBLIC_*` variables.

- [Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [Discord setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-discord)

Register the **Supabase** callback URL in the provider console (`https://<project-ref>.supabase.co/auth/v1/callback`, or the local callback shown by Supabase). In Supabase URL Configuration, allow the **app** callback `http://localhost:3000/auth/callback**`, `http://127.0.0.1:3000/auth/callback**`, and the equivalent production HTTPS callback. Set the production Site URL as well.

For the local Supabase stack, add the following sections to `supabase/config.toml` after creating the provider apps, export the referenced environment variables, and restart the local stack for auth configuration changes to take effect. Do not reset the database.

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"

[auth.external.discord]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_DISCORD_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_DISCORD_SECRET)"
```

### Riot Games

Riot requires approved [Riot Sign On (RSO) access](https://developer.riotgames.com/docs/lol#rso-integration); a normal development API key is insufficient. Configure a [custom Supabase OAuth/OIDC provider](https://supabase.com/docs/guides/auth/custom-oauth-providers) with identifier `custom:riot` and the approved RSO credentials. Use Riot's issued integration configuration and discovery information. Enable `email_optional` because Riot may not return email. Supabase must support the token authentication method assigned to the RSO client; coordinate with Riot if the assigned client uses Private Key JWT instead of a supported client-secret method.

Copy the custom provider's displayed Supabase callback URL into the Riot application. After the custom provider is enabled and verified, set the server-side app variable `SUPABASE_RIOT_PROVIDER=custom:riot` and restart Next.js. The Riot button then uses the same Supabase session and callback as other sign-in methods. This variable is an identifier, not a credential. No custom token minting or fabricated accounts are used.

Production OAuth and Riot interoperability must be tested with real provider credentials; local checks cannot verify third-party consent or provider approval.

## Phone passwordless sign-in and passkeys

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

## Checks

- `npm run lint`
- `npm run build`
- `Get-Content supabase/tests/access.sql -Raw | docker exec -i supabase_db_game-on psql -U postgres -d postgres -v ON_ERROR_STOP=1`

The SQL integration check covers public selections, owner-only writes, atomic game saves, ticket permissions, and expiration filtering. It runs in a transaction and rolls back its test fixtures. Google font downloads require network access during the production build.

If the Windows Turbopack CSS worker exits before connecting, use the supported Webpack fallback: `npm run build -- --webpack` (or `npm run dev -- --webpack`). The final production build was verified with this fallback.

### Usernames and player reports

Players can change their public display name in Account. Names are not unique account identifiers: links and messages continue to use immutable profile IDs. New names accept 3–32 ASCII letters, digits, spaces, dots, underscores and hyphens. The database filter normalizes common numeric substitutions and punctuation, and rejects a curated English profanity/slur list. This is a baseline filter, not comprehensive multilingual moderation; it can also reject innocent names containing blocked substrings. Provider names that fail validation fall back to Player for new accounts.

Signed-in players can report another player from their public profile. Reports are stored privately in `public.player_reports`; clients cannot read or modify them. Submissions are capped at five per rolling 24 hours, with one pending report per target/reason. Authorized operators can review pending reports in the Supabase dashboard and change `status` to `reviewed` or `dismissed`. No automated penalties, notification delivery or moderator dashboard is implemented. Keep database/service-role access restricted to trusted operators.

Regression checks: run `supabase/tests/usernames_reports.sql` against the local database with psql. The test transaction rolls back all fixtures.

### Profile privacy

Edit profile includes Public/Private mode. Existing and new profiles start public; selecting Private defaults to Friends and me, with an Only me option. Username/ID remain searchable for messaging and reporting. Bio lives in `profile_details` and game selections use the same database access rule: public, owner, or accepted friend when allowed. Pending requests grant no access. Friend controls are available on other player profiles. Removing a friendship removes private-profile access. Profile privacy does not change visibility of tickets users post publicly.

Run `supabase/tests/profile_privacy.sql` for rollback-only database access checks. Bio editors now read `profile_details`, replacing the earlier `profiles.bio` column.
