# 002 — Get like buttons working end-to-end

**Status:** Open

## Problem

The like system has backend endpoints and frontend UI, but they are not properly wired together. The frontend calls `POST /programs/{programId}/like` while the backend exposes `POST /content/{content_id}/likes` — a URL mismatch. Additionally, the favorites feature is localStorage-only with no backend persistence.

## Current state

### Backend (implemented)

- `UserLikedContent` model in `backend/app/models/like.py` — composite PK `(user_id, content_id)`.
- `LikeRepository` with `count_content_likes`, `list_for_content`, `create`, `delete`.
- `LikeService` wrapping the repository.
- REST endpoints in `backend/app/routers/likes.py`:
  - `GET /content/{content_id}/likes`
  - `POST /content/{content_id}/likes`
  - `DELETE /content/{content_id}/likes/me`
  - `DELETE /content/{content_id}/likes/{user_id}` (admin)
- Unit tests in `backend/tests/test_social.py`.

### Frontend (partially implemented)

- `LikesContext` with optimistic updates and localStorage fallback.
- `LikeButton` component with heart icon.
- `FavoritesContext` for bookmarking (localStorage-only, backend TODO).
- `ProgramCard` renders both like and favorite buttons.
- `programs.service.ts` has `toggleProgramLike()` calling `POST /programs/{programId}/like` — **wrong URL**.

## Tasks

1. **Fix the endpoint URL** — Update `toggleProgramLike()` in `frontend/services/programs.service.ts` to call the correct backend endpoint (`/content/{id}/likes` for POST, `/content/{id}/likes/me` for DELETE).
2. **Fetch initial like state** — On page load, fetch each program's like count from the backend and whether the current user has liked it. Consider a bulk endpoint or embedding `like_count` and `user_has_liked` in the program list response to avoid N+1 requests.
3. **Sync LikesContext with backend** — Replace or supplement the localStorage fallback with actual API calls. Keep optimistic updates for snappy UX.
4. **Favorites backend** — Decide whether favorites should be a separate backend model (e.g. `UserFavoritedContent`) or reuse the likes table with a `type` column. Implement endpoints and wire up `FavoritesContext`.
5. **Handle unauthenticated users** — Like buttons should prompt login or be disabled for non-authenticated visitors.

## Files of interest

- `backend/app/routers/likes.py` — existing endpoints
- `backend/app/models/like.py` — `UserLikedContent`
- `frontend/services/programs.service.ts` — `toggleProgramLike()`
- `frontend/contexts/LikesContext.tsx` — state management
- `frontend/contexts/FavoritesContext.tsx` — favorites (localStorage-only)
- `frontend/components/LikeButton/LikeButton.tsx` — UI component
- `frontend/app/programs/components/ProgramCard.tsx` — renders both buttons
- `frontend/hooks/useProgramLikes.ts` — hook (minimal, TODO)
- `frontend/hooks/useFavorites.ts` — hook (placeholder)
