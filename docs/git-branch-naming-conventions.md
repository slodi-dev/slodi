# Git Branch Naming Conventions

A comprehensive guide to branch naming best practices for maintaining clean and organized repositories.

## Where to branch from — and why it matters here

**Branch off `main`, and open the pull request against `main`.** One branch per
piece of work, deleted once it merges. Do not accumulate work on a long-lived
shared branch and then open a PR from that.

This is not style preference — it follows from the fact that this repository
**squash-merges** pull requests. A squash creates a brand new commit on `main`;
it never absorbs the branch's own commits. For a short-lived branch that is
fine, because the branch is deleted straight afterwards. A long-lived branch,
though, survives with commits that are now permanently unreachable from `main`,
and **every later PR from that branch re-lists all of them** — a list that only
grows.

That is what happened to `dev`: PR #125 listed **30 commits for a 10-file
change**, because 28 of them had been squashed away in earlier merges and can
never be reachable from `main`. The Files Changed tab stayed correct throughout
— it is computed from the merge base — so the symptom is a misleading Commits
tab rather than a wrong diff.

`dev` is kept as an integration branch for local and exploratory work, but is no
longer the source of pull requests into `main`.

### Two related gotchas when syncing

- Merging `main` back into a long-lived branch produces **spurious add/add
  conflicts**, because main's squash commit looks like an unrelated addition of
  files the branch already has. Check `git diff <branch> origin/main` first: if
  it is empty, `main` carries nothing the branch lacks.
- "Commits ahead of `main`" badly overstates unlanded work for the same reason.
  Compare trees, not commit counts.

## Standard Branch Prefixes

### Core Types (Most Common)

| Prefix              | Purpose                            | Example                           |
| ------------------- | ---------------------------------- | --------------------------------- |
| `feature/`          | New features or enhancements       | `feature/add-user-authentication` |
| `bugfix/` or `fix/` | Bug fixes (non-urgent)             | `bugfix/login-timeout-error`      |
| `hotfix/`           | Urgent production fixes            | `hotfix/security-vulnerability`   |
| `refactor/`         | Code refactoring (no new features) | `refactor/simplify-auth-logic`    |

### Extended Types

| Prefix        | Purpose                  | Example                          |
| ------------- | ------------------------ | -------------------------------- |
| `docs/`       | Documentation only       | `docs/update-api-readme`         |
| `test/`       | Testing/experiments      | `test/try-new-cache-strategy`    |
| `chore/`      | Maintenance tasks        | `chore/update-dependencies`      |
| `style/`      | Code style/formatting    | `style/fix-linting-errors`       |
| `perf/`       | Performance improvements | `perf/optimize-database-queries` |
| `ci/`         | CI/CD changes            | `ci/add-github-actions`          |
| `build/`      | Build system changes     | `build/update-webpack-config`    |
| `release/`    | Release preparation      | `release/v2.0.0`                 |
| `experiment/` | Experimental features    | `experiment/try-graphql`         |

## Naming Format

### Basic Format

``` text
<type>/<short-description>
```

### With Ticket Number

``` text
<type>/<ticket-id>-<short-description>
```

### Examples

```bash
# Basic format
feature/user-profile
bugfix/fix-login-redirect
hotfix/payment-crash
refactor/cleanup-user-service

# With ticket numbers
feature/SLODI-123-add-scout-groups
bugfix/JIRA-456-header-overflow
docs/SLODI-789-update-installation-guide
```

## Best Practices

### ✅ Do

- Use **lowercase** letters
- Separate words with **hyphens** (`-`)
- Be **descriptive** but **concise**
- Use **alphanumeric** characters only (a-z, 0-9, -)
- Include **ticket/issue numbers** when available
- Keep names under **50 characters**
- Use imperative mood in descriptions (e.g., `add`, `fix`, `update`)

### ❌ Don't

- ❌ Use spaces: `feature/new feature`
- ❌ Use underscores: `feature/new_feature`
- ❌ Use continuous hyphens: `feature/new--feature`
- ❌ End with hyphen: `feature/new-feature-`
- ❌ Use personal names: `john/my-changes`
- ❌ Be vague: `fix/bug`, `feature/updates`, `temp-fix`
- ❌ Use special characters: `feature/new_feature!`
- ❌ Start with numbers: `123-feature`

## Real-World Examples

### Features

```bash
feature/add-scout-program-builder
feature/event-calendar
feature/group-leader-dashboard
feature/user-authentication
feature/export-to-pdf
```

### Bug Fixes

```bash
bugfix/fix-auth0-cors-error
bugfix/user-profile-crash
bugfix/missing-favicon
bugfix/login-timeout
bugfix/header-overlap-mobile
```

### Hotfixes (Production Emergencies)

```bash
hotfix/jwt-verification-failed
hotfix/database-connection-timeout
hotfix/security-vulnerability
hotfix/payment-gateway-error
```

### Refactoring

```bash
refactor/simplify-user-service
refactor/extract-auth-logic
refactor/database-schema
refactor/component-structure
```

### Documentation

```bash
docs/add-api-endpoints
docs/update-deployment-guide
docs/readme-installation
docs/api-authentication
```

### Tests & Experiments

```bash
test/try-postgresql-optimization
test/experiment-redis-cache
test/load-testing
experiment/graphql-implementation
```

### Chores & Maintenance

```bash
chore/update-dependencies
chore/cleanup-unused-imports
chore/configure-eslint
chore/upgrade-next-js
```

## Simple Convention (Minimum Viable)

If you want to keep it simple for smaller teams, use these 4-5 core types:

```bash
feature/   # New functionality
bugfix/    # Fix broken stuff
hotfix/    # Emergency production fixes
docs/      # Documentation changes
chore/     # Maintenance tasks
```

## Branch Workflow

### Creating a Feature Branch

```bash
# Start from an up-to-date main — see "Where to branch from" above
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/add-user-profile

# Work on your changes
git add .
git commit -m "Add user profile component"

# Push to remote
git push origin feature/add-user-profile
```

### Creating a Bugfix Branch

```bash
# Create from main
git checkout main
git pull origin main
git checkout -b bugfix/fix-login-error

# Fix the bug
git add .
git commit -m "Fix login redirect error"

# Push
git push origin bugfix/fix-login-error
```

### Creating a Hotfix Branch

```bash
# Create from production/main branch
git checkout main
git pull origin main
git checkout -b hotfix/security-patch

# Apply urgent fix
git add .
git commit -m "Apply security patch for CVE-2024-XXXX"

# Push
git push origin hotfix/security-patch
```

## Git Hook Enforcement

You can enforce naming conventions automatically with a Git hook.

### Pre-commit Hook

Create `.git/hooks/commit-msg`:

```bash
#!/bin/bash
# .git/hooks/commit-msg

branch=$(git symbolic-ref --short HEAD)
pattern="^(feature|bugfix|hotfix|refactor|docs|test|chore|style|perf|ci|build|release|experiment)\/[a-z0-9-]+$"

if ! echo "$branch" | grep -Eq "$pattern"; then
    echo "❌ ERROR: Branch name '$branch' doesn't follow convention"
    echo ""
    echo "Expected format: <type>/<description>"
    echo ""
    echo "Valid types:"
    echo "  feature, bugfix, hotfix, refactor, docs,"
    echo "  test, chore, style, perf, ci, build"
    echo ""
    echo "Examples:"
    echo "  feature/add-user-auth"
    echo "  bugfix/fix-login-error"
    echo "  hotfix/payment-crash"
    echo ""
    exit 1
fi
```

Make it executable:

```bash
chmod +x .git/hooks/commit-msg
```

## Common Mistakes to Avoid

### 1. Inconsistent Separators

```bash
❌ feature/userAuth
❌ bugfix/user_auth
✅ feature/user-auth
```

### 2. Personal Ownership

```bash
❌ john/new-feature
❌ sarah-testing
✅ feature/user-dashboard
```

### 3. Too Many Types

```bash
❌ enhancement/, improvement/, addition/, new-feature/
✅ feature/
```

### 4. Vague Names

```bash
❌ feature/updates
❌ fix/bug
❌ temp-fix
✅ feature/add-scout-calendar
✅ bugfix/fix-auth-redirect
```

## Branch Cleanup

Keep your repository clean by deleting merged branches:

```bash
# Delete local branch
git branch -d feature/completed-feature

# Delete remote branch
git push origin --delete feature/completed-feature

# Prune deleted remote branches
git fetch --prune
```

## Team Size Considerations

### Small Teams (1-5 developers)

Keep it simple with 4-5 core types:

- `feature/`
- `bugfix/`
- `hotfix/`
- `docs/`

### Medium Teams (5-20 developers)

Add more granularity:

- `feature/`, `bugfix/`, `hotfix/`
- `refactor/`, `docs/`, `test/`
- `chore/`, `perf/`

### Large Teams (20+ developers)

Full convention with ticket integration:

- All standard types
- Mandatory ticket numbers: `feature/PROJ-123-description`
- Automated enforcement via CI/CD

## Resources & References

- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)

## Contributing

When contributing to projects using these conventions:

1. Check the project's specific naming convention (usually in `CONTRIBUTING.md`)
2. Follow the established pattern
3. Include ticket numbers if the project uses them
4. Keep descriptions clear and concise
5. Delete branches after merging

---

**Last Updated:** July 2026  
**Version:** 1.1.0