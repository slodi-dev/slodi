# Social Module Specification

## 1. Purpose

The `/social` area enables users to share updates, collaborate asynchronously, react to content, follow interests (tags, users, programs), and surface relevant activity streams that augment the structured planning surfaces (e.g. `/builder`). It provides lightweight communication and ambient context without becoming a full chat system.

## 2. Personas & Intentions

| Persona | Goals | Secondary Intentions | Notes |
|---------|-------|----------------------|-------|
| Member / Participant | Consume feed, react, comment, follow relevant programs | Discover upcoming events, search past posts | Limited creation scope |
| Contributor | Post updates, attach media, mention users, tag programs | Promote engagement, solicit feedback | Standard posting rights |
| Moderator | Enforce guidelines, hide/remove posts, manage reports | Resolve conflicts, escalate severe issues | Elevated permissions |
| Admin | Configure feature flags, retention, moderation rules | Audit activity trends | Full access |

Key intent phrasing:

- "I want to see what's new in my groups/programs"
- "I need to post an update and tag the upcoming event"
- "I want to mention a user to ask a question"
- "I need to follow this program to get future updates"
- "I need to moderate a reported comment"

## 3. Primary Use Cases

1. Feed Consumption
   - Infinite/ paginated feed of mixed post types (text, media, system notices)
   - Contextual filtering (by tag, program, workspace)
2. Post Creation
   - Compose text, attach images/files (future), add tags, link entities (program/event/task)
   - Mention users (`@username`) with autocompletion
3. Commenting & Threading
   - Hierarchical (top-level post + inline flat comments) or shallow single depth initially
   - Edit & delete own comments
4. Reactions
   - Emoji reaction set (configurable) with aggregate counts; one reaction type per user per post
5. Following / Subscriptions
   - Follow users, tags, programs; adjust feed personalization weight
6. Notifications
   - Delivery for mentions, replies, moderation actions, followed entity new post
7. Moderation
   - Flag/report post → queue for moderators
   - Soft-delete (hidden from general users, retained for audit)
8. Search & Discovery
   - Keyword search over posts/comments (future index)
   - Tag cloud / trending posts summary
9. System Activity Injection (Optional Phase)
   - Publish system events (program published, task completed) into feed with distinct styling

## 4. Information Architecture & Routes (Next.js App Router)

```txt
/social                     → Personalized feed (default filters applied)
/social/global              → Global/public feed (if visibility allows)
/social/posts/[id]          → Post detail + full comment thread
/social/profile/[id]        → User profile (posts, follows, badges)
/social/tags                → Tag index / trending
/social/tags/[tag]          → Tag-focused feed
/social/notifications       → Notification center
/social/moderation          → Moderator dashboard (reports queue)
```

Modal/secondary routes:

- `/social/new` (PostComposer modal)
- `/social/posts/[id]/edit`
- `/social/report/[id]`

## 5. Component Inventory

- `SocialShell` – Top navigation segment, filter bar, main content region
- `FeedList` – Virtualized list rendering `FeedItem` variants
- `FeedItem` – Base wrapper for post, system event, moderation notice
- `PostComposer` – Rich text + mentions + tag selector + link attachments
- `CommentThread` – List of comments with inline editor
- `ReactionBar` – Emoji reaction controls + counts
- `FollowButton` – Manage user/tag/program follow state
- `NotificationBell` – Badge + dropdown preview latest notifications
- `NotificationList` – Full center view
- `ModerationQueue` – Table/list of reported items with actions
- `ReportDialog` – Submit report reason form
- `TagBadge` / `TagCloud`
- `UserAvatar` / `UserHandle`
- `MentionAutocomplete` – Popup list while typing `@`
- `LoadMoreButton` / `InfiniteScroller`
- `SearchBar` – Query posts by keyword
- `SystemEventCard` – Distinct styling for injected structured events

Utilities:

- `RelativeTime` formatter
- `OptimisticBoundary` for optimistic updates
- `SkeletonFeedItem` placeholders
- `Toast` for ephemeral feedback

## 6. State Management

Approach: React Query for server synchronization (feeds, posts, comments). Zustand slices for ephemeral UI state: composer draft, mention context, moderation actions selection.

Stores:

- `feedStore` – filters, active tab (personal/global/tag)
- `composerStore` – current draft content, tags, attachments
- `notificationStore` – unread counts, subscription channel info
- `moderationStore` – reported item selection, bulk action state

React Query Keys (examples):

- `['feed','personal',filters]`
- `['post', postId]`
- `['comments', postId]`
- `['notifications']`
- `['moderation','reports']`

Optimistic UX:

- Post create: append to feed list immediately; rollback on error
- Reaction toggle: locally adjust counts; revert if failure
- Comment add/edit/delete: optimistic mutation with stale invalidation

## 7. Data Contracts (Draft Types)

```ts
type UserRef = { id: string; displayName: string; avatarUrl?: string; handle: string };
type Post = { id: string; author: UserRef; body: string; tags: string[]; linkedEntities?: LinkedRef[]; createdAt: string; editedAt?: string; reactions: ReactionSummary; commentCount: number; visibility: 'public'|'workspace'|'program'; status: 'active'|'hidden' };
type LinkedRef = { type: 'program'|'event'|'task'; id: string; label: string };
type Comment = { id: string; postId: string; author: UserRef; body: string; createdAt: string; editedAt?: string; reactions: ReactionSummary; status: 'active'|'hidden' };
type ReactionSummary = { counts: Record<string, number>; userReaction?: string };
type Notification = { id: string; type: 'mention'|'reply'|'followed_new_post'|'moderation'; entityId?: string; createdAt: string; read: boolean; payload?: any };
type Report = { id: string; targetType: 'post'|'comment'; targetId: string; reason: string; createdAt: string; reporter: UserRef; status: 'open'|'resolved'|'dismissed' };
```

Alignment to backend: Derive from existing user, comment, tag, program schemas; new endpoints for feed retrieval, reactions, reports, notifications.

## 8. Interaction Flows

Flow: Compose & Publish Post

1. User opens composer modal (`/social/new`).
2. Types body, adds tags, mentions users.
3. Submits → POST /social/posts → optimistic insertion into feed.
4. Server returns normalized post; cache updated; optimistic entry reconciled.

Flow: React to Post

1. User clicks emoji in `ReactionBar`.
2. If same selected again → remove reaction (toggle).
3. Optimistically update count; send mutation; rollback if error.

Flow: Follow Tag

1. User views tag feed; clicks `FollowButton`.
2. POST /social/follows (tag) → adjust personalization weight; update UI state.

Flow: Moderate Report

1. Moderator opens `/social/moderation` queue.
2. Selects report → reviews context.
3. Chooses action (hide / dismiss / escalate) → mutation updates status.
4. Feed invalidated for affected post.

Flow: Notification Consumption

1. User opens `/social/notifications`.
2. Items marked read on view; unread count decremented.
3. Mentions link to post detail anchor.

## 9. Permissions & Visibility

- Posting restricted by workspace membership.
- Visibility tiers: public (if allowed), workspace, program-scoped.
- Moderators can hide content (status `hidden`); original author still sees with badge.
- Reports accessible only to moderators/admins.

## 10. Non-Functional Considerations

- Performance: Virtualize feed list; batch reaction counts updates.
- Accessibility: Keyboard navigation through feed items & composer fields; ARIA roles on interactive emojis.
- Internationalization: Post body stored raw; localization only for system event wrappers.
- Security: Sanitize post/comment body (allow basic markdown subset). Rate limit posting & commenting endpoints.
- Retention: Configurable archival threshold; hidden posts retained for audit.

## 11. Initial Milestones

M1: Spec + route scaffolding + basic feed (static mocked data).
M2: Post composer + create & list real posts.
M3: Comments + reactions.
M4: Following + personalized feed filters.
M5: Notifications center.
M6: Moderation workflow + reports.
M7: System event injection + search enhancements.

## 12. Open Questions

- Real-time updates? (Websocket vs polling) – defer to after M3.
- Reaction set customization per workspace?
- Full text search index strategy (external service or DB FTS)?
- Cross-posting between workspaces allowed?

## 13. Immediate Next Actions

1. Confirm data contracts with backend team.
2. Scaffold `/social` route & feed shell.
3. Implement mocked `FeedList` component for rapid UI iteration.
4. Define API endpoints spec (separate doc) for posts, comments, reactions, follows, reports, notifications.

---

Living document – evolve alongside implementation.
