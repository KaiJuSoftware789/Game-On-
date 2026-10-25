# Game-On!

Find gaming sessions that match your game, platform, region, and play style.

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
