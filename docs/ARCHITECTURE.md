# Game Platform — Architecture

A modular, scalable mobile multiplayer gaming platform. Four games ship in v1
(Baloot, Jackaroo, Carrom, Ludo Star); new games plug in as modules without
touching the core.

## High-Level Layout

```
┌─────────────────────────┐   ┌──────────────────────────┐
│  client (mobile-first)  │   │  admin (web dashboard)   │
│  Vue 3 + Vite + Socket  │   │  Vue 3 + Vite            │
└────────────┬────────────┘   └────────────┬─────────────┘
             │ HTTP /api + Socket.IO       │ HTTP /api/admin
             ▼                             ▼
┌───────────────────────────────────────────────────────────────┐
│                      server (Node + Express)                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  API layer  ·  REST routers (modules/auth, users, ...)    │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  Real-time hub · Socket.IO namespaced per game + room     │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  Platform services · auth · users · presence · rooms      │  │
│  │                       matchmaking · notifications · admin │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  Game engine core · GameEngine · TurnManager · MatchSession│ │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  Game modules (plugins)  baloot · jackaroo · carrom · ludo│  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │ SQLite (better-sqlite3)              │
└──────────────────────────────────────────────────────────────────┘
```

## The One-Platform Rule

All games share:

- Authentication & JWT sessions
- User profiles, avatars, levels, XP, achievements
- Friends, presence (online/offline/in-game), blocks, reports
- Lobby, game catalog, categories
- Rooms (private/public, room codes) and room management
- Matchmaking queue
- Real-time transport (Socket.IO) and state synchronization
- Notifications (in-app + announcements)
- Statistics and leaderboards
- Admin & moderation surface

Games **only** contribute: a server `engine.js`, a `config.js` (meta), and a
client-side `GameView.vue` plus optional render helpers. Nothing else changes
when a new game is added.

## Adding a New Game (no core changes)

Server:

1. Create `server/src/games/<code>/engine.js` exporting a class extending `GameEngine`.
2. Create `server/src/games/<code>/config.js` exporting `meta`.
3. Register in `server/src/games/index.js`.

Client:

1. Create `client/src/games/<code>/` with `index.js` (meta + routing info),
   `GameView.vue`, optional `components/`.
2. Import it in `client/src/games/index.js`.

Admin: game appears automatically in game management (enable/disable/config).

## Design Principles

- **Separation of concerns** — modules expose routers/services/socket-handlers;
  the engine core knows nothing about Express or the DB.
- **Server-authoritative** — all rules and randomness live on the server; the
  client renders and sends intents (`match:action`).
- **Deterministic game state** — state is serialized to plain JSON and broadcast
  as `match:state`; clients render purely from it, enabling reconnection.
- **Reconnection** — players who drop keep their seat; on reconnect they rejoin
  the room and receive the authoritative state + missed actions.
- **Extensibility** — game registry, pluggable engines, admin-managed config.

## Folder Map

```
server/src/
  config/           env + constants
  db/               schema + seed
  lib/              logger, errors, jwt, http helpers
  middleware/       auth, admin guards
  modules/          auth, users, games, rooms, matchmaking, notifications,
                    presence, admin, realtime (socket hub)
  engine/           platform game-engine core (GameEngine, TurnManager,
                    MatchSession, sync)
  games/            pluggable game modules (baloot, jackaroo, carrom, ludo)

client/src/
  api/  store/  socket/  i18n/  theme/  router/
  games/            game modules (meta + GameView.vue + components)
  components/  views/

admin/src/
  views/            dashboard, users, games, rooms, matches, reports,
                    notifications, logs, analytics, leaderboards
```

## Tech Choices

| Concern          | Choice                                         |
| ---------------- | ---------------------------------------------- |
| Runtime          | Node.js 18+                                     |
| HTTP/API         | Express (REST)                                  |
| Real-time        | Socket.IO (namespace per game, rooms per match) |
| Database         | SQLite via better-sqlite3 (swap-ready data layer) |
| Client UI        | Vue 3 + Vite + Pinia + Vue Router               |
| i18n / RTL       | vue-i18n (en/ar), CSS logical properties        |
| Themes           | CSS custom properties (dark/light)              |
| Admin UI         | Vue 3 + Vite (separate workspace)               |

See `docs/DATABASE.md`, `docs/API.md`, `docs/GAME-MODULES.md` for details.
