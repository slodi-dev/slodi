# 003 — Add Slodi logo to front page

**Status:** Open

## Problem

The landing page hero section uses a placeholder SVG icon (a map/location icon) instead of the actual Slodi logo. The header/navbar also shows plain text "Slodi" with no logo image.

A proper logo file already exists at `frontend/public/logo/slodi-simple-vector.svg` but is not used anywhere.

## Current state

### Hero section (`frontend/app/(landing)/components/HeroSection.tsx`)

- Lines 76-96 contain a `<figure>` with class `styles.visual`.
- Inside is an inline SVG map icon with the comment `{/* Placeholder for hero image or illustration */}`.
- This is the primary placeholder to replace.

### Header (`frontend/components/Header/index.tsx`)

- Lines 20-22 render a plain text `<Link>` with "Slodi".
- No logo image is used.

### Existing asset

- `frontend/public/logo/slodi-simple-vector.svg` — the logo is already in the repo.

## Tasks

1. Replace the placeholder SVG in `HeroSection.tsx` with the Slodi logo (use `next/image` or an `<img>` pointing to `/logo/slodi-simple-vector.svg`).
2. Optionally add the logo to the header/navbar alongside or replacing the text.
3. Verify the logo renders well on both light and dark backgrounds, and at mobile/desktop sizes.

## Files of interest

- `frontend/app/(landing)/components/HeroSection.tsx` — hero placeholder
- `frontend/components/Header/index.tsx` — navbar text logo
- `frontend/public/logo/slodi-simple-vector.svg` — existing logo asset
