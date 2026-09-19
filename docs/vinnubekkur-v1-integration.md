# `release/vinnubekkur-v1` — how the integration branch stays honest

The branch for [epic 523, *Vinnubekkur v1*](https://app.shortcut.com/sl-6/epic/523). It is an
**integration and review surface, not a destination**: slices still land on `main` as soon as
they are safe to, and this branch is rebased onto `main` behind them.

That distinction is the whole point. `docs/git-branch-naming-conventions.md` records what
happened to `dev` — because this repository squash-merges, a long-lived branch accumulates
commits that are permanently unreachable from `main`, and every later PR from it re-lists all
of them. PR #125 listed **30 commits for a 10-file change**. This branch avoids that by never
being the source of more than one PR's worth of unlanded work at a time.

## The loop

1. **Work branches off `release/vinnubekkur-v1`**, named normally:
   `feature/sc-524-grid-real-data`. PR it **into the release branch**.
2. **When a slice is gate-safe, land it on `main`.** Open a second PR from the same work
   branch with `main` as the base, and squash-merge it. "Gate-safe" means it either ships
   nothing user-visible, or what it ships is behind the production gate — `MOCK_AVAILABLE`
   false in a production build, per sc-426.
3. **Immediately re-sync the release branch** (below). Do not let landed work sit on both
   sides; that is the state that grows into a conflict.
4. **When v1 is complete**, the release branch should be nearly empty of unlanded work. Open
   its final PR to `main`, squash-merge, **delete the branch.**

## Re-syncing after a slice lands

**Rebase. Never merge `main` into this branch.** A squash commit on `main` looks like an
unrelated addition of files this branch already has, so a merge produces spurious add/add
conflicts on work that is genuinely identical.

```bash
git fetch origin
git rebase origin/main            # patches already on main usually drop out here
```

When a squash combined several commits, git often cannot match them by patch-id and will
replay work that is already on `main`. Drop those commits explicitly rather than resolving
the same change twice:

```bash
git rebase --onto origin/main <last-landed-commit> release/vinnubekkur-v1
```

## Checking drift

**Compare trees, not commit counts.** "N commits ahead of main" overstates unlanded work for
the same squash-merge reason.

```bash
git diff release/vinnubekkur-v1 origin/main            # empty ⇒ nothing differs
git diff --stat origin/main...release/vinnubekkur-v1   # what this branch still carries
```

If the first is empty, `main` carries nothing this branch lacks, whatever the commit count says.

## What lands first

sc-426 splits `feature/plan-shell` into four PRs, in this order: infrastructure → the contract
(`docs/frontend/plan-api-contract.md`, `docs/design/vinnubekkurinn/`) → the plan surfaces →
mock mode with its production gate. The contract goes early on purpose, so the backend tickets
(sc-289, sc-290, sc-292, sc-293) have it on `main` to implement against.
