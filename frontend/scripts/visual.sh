#!/usr/bin/env bash
# Visual regression of every Storybook story, inside the official Playwright
# Docker image pinned to the installed Playwright version, so screenshots match
# the committed baselines and CI exactly (fonts and anti-aliasing differ per OS).
#
#   npm run test:visual                 # compare with the baselines
#   npm run test:visual:update          # rewrite the baselines that differ
#   npm run test:visual -- --grep Alert # any extra Playwright arguments
#
# Builds Storybook first; set VISUAL_SKIP_BUILD=1 to reuse storybook-static/.
# Inside CI (already in the image) it runs Playwright directly.
# Design: docs/ui-quality-pipeline.md, layer 2.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ "${VISUAL_SKIP_BUILD:-}" != "1" ]; then
  npm run build-storybook -- --quiet
fi

PW_VERSION="$(node -p 'require("@playwright/test/package.json").version')"
IMAGE="mcr.microsoft.com/playwright:v${PW_VERSION}-noble"

if [ -n "${CI:-}" ] || [ -n "${VISUAL_IN_IMAGE:-}" ]; then
  exec npx playwright test -c playwright.visual.config.ts "$@"
fi

if ! command -v docker >/dev/null; then
  echo "visual.sh: Docker is required, so screenshots match CI (${IMAGE})." >&2
  exit 1
fi

# The image only runs Playwright, which is plain JavaScript, so the host's
# node_modules work as they are. Files are written as the calling user.
exec docker run --rm --init --ipc=host \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -v "$PWD:/work" -w /work \
  "$IMAGE" \
  npx playwright test -c playwright.visual.config.ts "$@"
