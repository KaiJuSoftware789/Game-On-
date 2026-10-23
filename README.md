# Game-On!

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

## Checks

- `npm run lint`
- `npm run build`
- `Get-Content supabase/tests/access.sql -Raw | docker exec -i supabase_db_game-on psql -U postgres -d postgres -v ON_ERROR_STOP=1`

The SQL integration check covers public selections, owner-only writes, atomic game saves, ticket permissions, and expiration filtering. It runs in a transaction and rolls back its test fixtures. Google font downloads require network access during the production build.

If the Windows Turbopack CSS worker exits before connecting, use the supported Webpack fallback: `npm run build -- --webpack` (or `npm run dev -- --webpack`). The final production build was verified with this fallback.
