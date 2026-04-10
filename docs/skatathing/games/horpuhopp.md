# Hörpuhopp (Doodle-Jump)

Status: **not in scope for Skátaþing 2026.** With the Saturday-morning deadline, only Heiðursorðla is shipping for the event. This file exists as a placeholder for the post-event spec.

See [`../README.md`](../README.md) for the broader Skátaþing event context and [`./heidursordla.md`](./heidursordla.md) for the model the eventual spec will follow.

## Game concept (one-line)

Browser-based Doodle-Jump clone with a scout leader character. Continuous (no daily reset), score = max height reached, mobile controls are tap-left / tap-right halves of the screen.

## To be specified

- Aim of the game (win condition is "die", scoring, leaderboard scope)
- Game design (platform behavior, obstacles, collectibles, scout theming)
- Frontend implementation (canvas + game loop, controls, asset pipeline)
- Backend implementation (score submission only — no per-puzzle state)
- Anti-cheat strategy for a single client-submitted score (sanity-cap + rate-limit at minimum; replay validation is overkill for this event)
