# Local events and ZIP-code discovery

The Local events page supports tournaments and in-person gaming sessions. It uses a bundled U.S. ZIP directory to resolve a city/state and approximate coordinates without browser geolocation or a paid mapping API. Search distances are 5, 10, 25, and 50 miles, measured in a straight line between ZIP centers, not between street addresses or by driving route. The directory may omit recently introduced ZIPs; the UI suggests trying a nearby code when a code is unavailable.

## Available without cloud credentials

- Create events with an organizer, game, venue/address, ZIP, venue time zone, date, duration, player limit, description, and optional HTTPS registration link.
- Save events in the separate `game-on:events:v1` browser key. Changes synchronize between tabs. Existing profile, session, and game library storage stays separate.
- Browse saved events by ZIP/radius, event type, game, and Official/Unofficial section.
- Share an event snapshot through the device share sheet, clipboard, or a selectable link. The URL fragment contains the event details, including the venue address and organizer name. It does not contain profile bios, game statistics, email, or authentication data.
- Open a shared invitation in another browser and explicitly save it. Shared data is validated, ZIP coordinates are resolved again, and existing saved events are never silently overwritten. A shared copy is labeled as a snapshot because later changes or cancellations do not update older links.
- Cancel a locally hosted event, remove old saved copies, and open the venue in Google Maps or the organizer's registration page.

Dates are entered in the selected venue time zone and stored in UTC. The app rejects nonexistent/repeated daylight-saving hours rather than silently choosing an incorrect time. Cards show venue time, including the time-zone abbreviation. Past and cancelled events are excluded from nearby search; saved copies remain available under Your events.

## Public feed via the existing Supabase project

Public discovery/publishing needs the shared project configuration. Until configured, the UI shows **Public event feed · Coming soon** while local event links continue to work. No synthetic events are advertised as nearby public events.

1. Review and apply `supabase/migrations/202610250002_local_events.sql` to the intended project using your migration workflow. It creates a private `game_on_events` schema and restricted public RPCs. Test/bootstrap SQL is only for disposable databases.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in environment settings. Never use a service-role key in these variables. Rebuild/restart after changes. Restricted environments also need the project's exact host allowed.
3. Enable Supabase Email authentication/confirmation. Allow the app's `/auth/callback` redirect, including the `/auth/callback?next=/events` confirmation destination. The callback only accepts `/events` as an alternate destination; arbitrary redirects are not allowed.
4. Sign in from Local events, then explicitly select **Publish so players can find this event by ZIP code** when creating an event. Local entries are not automatically uploaded.
5. Verify with two accounts and a signed-out browser: publish an event, search nearby, open its stable share link, and cancel it as the organizer. Check email confirmation on the actual deployed origin.

Public events use stable `/events?event=<uuid>` links. These show the current event record, including cancellation. Anyone can read public events; only authenticated organizers can publish and cancel their own. Auth IDs are excluded from public payloads. Publishing is limited to 20 events per user per rolling 24 hours. The server resolves the venue ZIP and canonicalizes official game details before publication. Venue and event information remain organizer-provided; publication is not venue verification.

Database tables have row-level security and no anonymous/authenticated direct-table grants. Narrow security-definer RPCs enforce ownership and input validation. Search uses actual spherical distance, applies filters before pagination, and excludes expired/cancelled events. User IDs and creation times come from the server. A repeated publication with the same event ID/details returns the existing event; a different owner or payload cannot overwrite it.

No shared project is configured in the current environment. The migration and API integration are prepared but have not been applied/tested against a hosted Supabase project. The host application's public origin is also needed for links to be reachable outside its deployment; loopback development links only work locally.

## Checks

- `npm test`: ZIP lookup and leading zeros, distances, time zones/DST, validation, shared payloads, corruption, and existing app behavior.
- `npm run test:events:db`: isolated PostgreSQL checks for public search, permissions, ownership, publication validation, retries, filtering, cancellation, and stale events. Requires Docker and leaves the real Supabase project untouched.
- `npm run lint` and `npm run build`: static/type/build verification.

The `zipcodes` dependency is pinned to 8.0.0 and used only by server code. Its license is reproduced in [zipcodes-license.txt](zipcodes-license.txt); see its package README for data sources.
