# Vinnubekkur branch (`feature/vinnubekkur`)

This branch rebuilds content and planning on a new model. Read `docs/features/data-model.html` (the
model), `docs/features/plan-api.html` (the endpoints) and `docs/features/vinnubekkur-work-map.html`
(what the frontend calls for each action) before working on the planner, the bank or content.

Add this line to your own `CLAUDE.md` (it is git-ignored) so Claude Code reads this file:

```
@docs/features/vinnubekkur-branch.md
```

- **Old API, removed later on this branch.** Don't use it in new code: `POST
  /workspaces/{id}/programs|events|tasks`, `PATCH`/`DELETE /programs/{id}`, `/events/{id}`,
  `/tasks/{id}`, `content_type`, `event_id`, `program_id`, `start_dt`/`end_dt`, Season and the
  `/seasons/{id}/grid` contract on `release/vinnubekkur-v1`.
- **New API instead.** `/workspaces/{id}/content` with `level`, `/content/{id}`, `/placements`,
  `/units` and `/copies`. Routes marked `deprecated` in `/docs` are the old ones.
- **Design principle.** As flexible as a spreadsheet: give leaders building blocks, not fixed rules.
- **Branches.** Work branches go off `feature/vinnubekkur` and PR into it, never into `main`. The
  whole branch goes to `main` once, when the Vinnubekkur is done. This file goes with it.
