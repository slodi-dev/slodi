# Arnór-Clicker — server-side saves

**Status:** design, not built. Written 2026-07-27 after PR #129.

## Why

The save lives only in `localStorage`, and that has now cost a real player her
progress. Signý hit a 400 from the reverse proxy, blocked cookies in Safari to
get past it, and Safari's "Block All Cookies" blocks Web Storage too — so the
game had nowhere to save. Her words: *"ókei ég reloadaði og allt hvarf aftur"*.

PR #127 stopped that from **crashing** the page, but it cannot make the progress
survive, because there is nowhere to put it. Only a server-side save fixes it.

Three things this buys:

1. **Progress survives** a blocked, cleared or full browser store.
2. **The same game on phone and laptop**, which is how people actually play.
3. **A record we can reason about.** The leaderboard is already server-side and
   already the only thing that matters competitively; a save alongside it means
   a suspicious score can be checked against a plausible state instead of being
   taken on faith.

Not a goal: making the save authoritative or cheat-proof. The client still
computes everything, and a determined player can still send whatever they like.
This is durability, not enforcement — see "What this does not solve".

## The constraint: don't bombard the system

The game ticks 8× a second. Nothing near that rate may reach the database. The
save is written when something **meaningful** happens, and at most once every
30 seconds otherwise.

Measured payload, JSON, worst case:

| state | bytes |
|---|---|
| fresh player | 285 |
| mid-game | 590 |
| everything owned | 1,273 |

At a generous 1.5 KB and one write per player per 30s:

| concurrent players | writes/sec | bandwidth |
|---:|---:|---:|
| 20 | 0.7 | 1.0 KiB/s |
| 100 | 3.3 | 4.9 KiB/s |
| 500 | 16.7 | 24.4 KiB/s |

Storage is one row per player: 500 players is well under a megabyte. For a game
whose realistic audience is a few dozen scouts, this is nothing — but the
cadence rules below are what keep it nothing as it grows.

## Schema

One row per player per game, mirroring `game_scores` so the two sit together.

```
game_saves
  id           uuid  pk
  user_id      uuid  fk users(id) on delete cascade
  game_slug    varchar(100)
  state        jsonb          -- the save blob, opaque to the backend
  revision     integer        -- client-side monotonic counter, see Conflicts
  updated_at   timestamptz    default now()
  unique (user_id, game_slug)
```

`state` is `jsonb` rather than `text` so we can query into it later (spotting
implausible balances, say) without a migration. The backend does **not**
validate the shape: the client owns the schema and already sanitises on load.
A size limit is enforced — reject over 16 KB — so the column cannot be used as
free storage.

`game_slug` is carried so Hörpuhopp or a later game can use the same table,
exactly as `game_scores` does.

## API

```
GET  /games/{game_slug}/save   -> { state, revision, updated_at } | 404
PUT  /games/{game_slug}/save   <- { state, revision }
```

Both require `get_current_user`. `PUT` is rate limited per user — the deploy
already has `user_rate_limit`; `30/60` gives ample headroom over the intended
one-per-30s while stopping a loop hammering it.

Layering follows the existing game-scores path exactly: router → service (owns
the commit) → repository → model, with the frontend reaching it through the
`/api/leikir/[game]/save` proxy that already exists for scores.

## When the client writes

Never on a tick. Only:

- **Every 30s**, and only if the state changed since the last write.
- **On `visibilitychange`/`pagehide`**, via `navigator.sendBeacon` so it survives
  the tab closing — this is the one that actually saves people's progress.
- **On a milestone**: prestige, hiring a fundarstjóri. Rare, and the moments a
  player would be most upset to lose.

`localStorage` stays the primary store and is written as it is today. The server
is a durable **backup**, not the hot path — so the game stays instant, works
offline, and a storage-blocked browser simply falls back to the server copy.

## Conflicts

Two devices, or two tabs, will disagree. Rules:

- The client keeps a `revision` counter, incremented on every local save.
- `PUT` only overwrites when the incoming `revision` is **greater than** the
  stored one. A stale tab cannot clobber a newer state.
- On load, fetch the server copy and compare with `localStorage`: take whichever
  has the higher `revision`; on a tie prefer local, since it may hold unsent
  progress.
- Do **not** merge. An idle-game state is not meaningfully mergeable, and
  half-merged economies are worse than a clear loss.

Deliberately not last-write-wins on timestamp: device clocks are exactly what
the offline-earnings hardening already had to stop trusting.

## What this does not solve

- **Cheating.** The client still computes the state, so a crafted `PUT` can
  claim anything. The real ceiling stays the score bound and the raise-only /
  replace policy on `game_scores`. Storing the state does make an audit
  *possible* — a balance can be checked against a plausible progression — but
  nothing here enforces it.
- **The 400 that started this.** That is the Auth0 session cookie outgrowing
  nginx's header buffer, and it needs either a bigger
  `large_client_header_buffers` on the VM or a server-side session store. A
  player who cannot load the page at all is not helped by a save endpoint.

## Rollout

1. Migration and model, backend only. No client change; nothing breaks.
2. Client writes to the server but still loads from `localStorage`. Data starts
   accumulating, and the write cadence can be watched under real traffic.
3. Client prefers the server copy on load. Once this ships, blocked-storage
   players are whole again.

Each step is independently revertable, and step 2 is where the cadence
assumptions above should be checked against reality rather than trusted.
