# Program Browse & Discovery System - Implementation Guide

**Version:** 1.0  
**Last Updated:** January 5, 2026  
**Status:** Planning / Implementation Ready

---

## Table of Contents

1. [Executive Overview](#executive-overview)
2. [Backend Data Model Reference](#backend-data-model-reference)
3. [Core Features](#core-features)
4. [Technical Architecture](#technical-architecture)
5. [User Interface Specifications](#user-interface-specifications)
6. [API Integration](#api-integration)
7. [State Management](#state-management)
8. [Component Hierarchy](#component-hierarchy)
9. [Implementation Phases](#implementation-phases)
10. [Testing Strategy](#testing-strategy)
11. [Performance Considerations](#performance-considerations)
12. [Accessibility Requirements](#accessibility-requirements)

---

## Executive Overview

The Program Browse & Discovery System is a comprehensive web application for exploring, filtering, managing, and sharing youth program ideas. It enables users to discover programs through an intuitive card-based interface, dive deep into program details, save favorites, and contribute their own program ideas to the community bank.

### Key Goals

- **Discoverability**: Make it easy to find relevant programs through search, filtering, and categorization
- **Engagement**: Encourage exploration through visual cards, likes, and favorites
- **Collaboration**: Enable sharing programs across workspaces and groups
- **Quality**: Ensure programs contain comprehensive information for facilitators
- **Accessibility**: Support all users with keyboard navigation, screen readers, and responsive design

---

## Backend Data Model Reference

### Program Entity Structure

Based on the backend schema documentation, Programs inherit from the Content base entity:

#### Content Base Fields (Inherited)

```typescript
interface ContentBase {
  id: UUID; // Unique identifier
  content_type: "program"; // Discriminator (always 'program')
  name: string; // Title (1-100 chars)
  description: string | null; // Description (0-1000 chars)
  public: boolean; // Visibility flag
  like_count: number; // Non-negative integer
  created_at: DateTime; // ISO 8601 timestamp with timezone
  author_id: UUID; // User who created it
}
```

#### Program-Specific Fields

```typescript
interface Program extends ContentBase {
  image: string | null; // Image URL (0-255 chars)
  workspace_id: UUID; // Parent workspace (required)

  // Relationships (fetched via joins/includes)
  author?: User; // Author details
  workspace?: Workspace; // Workspace details
  events?: Event[]; // Associated events
  comments?: Comment[]; // User comments
  content_tags?: ContentTag[]; // Tag associations
}
```

#### Related Entities

**Tags** (Many-to-Many via content_tags):

```typescript
interface Tag {
  id: UUID;
  name: string; // 1-50 chars, globally unique
}

interface ContentTag {
  content_id: UUID; // Program ID
  tag_id: UUID; // Tag ID
}
```

**Comments** (One-to-Many):

```typescript
interface Comment {
  id: UUID;
  body: string; // 1-5000 chars
  created_at: DateTime;
  user_id: UUID;
  content_id: UUID; // Program ID
}
```

**Author** (User):

```typescript
interface User {
  id: UUID;
  name: string; // 1-100 chars
  email: string;
  pronouns?: Pronouns;
  preferences?: Record<string, any>;
}
```

**Workspace** (Context):

```typescript
interface Workspace {
  id: UUID;
  name: string;
  group_id?: UUID;
  settings?: Record<string, any>;
}
```

### Backend Constraints & Validation

- **Name**: 1-100 characters (required)
- **Description**: 0-1000 characters (optional)
- **Image**: 0-255 characters (optional URL/path)
- **Like Count**: Non-negative integer (enforced by CHECK constraint)
- **Public**: Boolean flag (required)
- **Tags**: Unique globally, reusable across all content
- **Cascade Deletes**: Deleting workspace → deletes programs; deleting program → deletes comments/tags associations

---

## Core Features

### 1. Program Browse Page (`/programs`)

**Purpose**: Primary discovery interface for all public programs

#### 1.1 Visual Layout

**Desktop (≥1024px)**:

``` text
┌─────────────────────────────────────────────────────────────┐
│ Header: "Program Bank" + Search Bar          [New Program]  │
├─────────────┬───────────────────────────────────────────────┤
│             │                                               │
│   Filters   │   Program Cards Grid (3-4 columns)           │
│   Sidebar   │   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐          │
│             │   │ P1  │ │ P2  │ │ P3  │ │ P4  │          │
│   • Search  │   └─────┘ └─────┘ └─────┘ └─────┘          │
│   • Tags    │   ┌─────┐ ┌─────┐ ┌─────┐                  │
│   • Age     │   │ P5  │ │ P6  │ │ P7  │                  │
│   • Public  │   └─────┘ └─────┘ └─────┘                  │
│             │                                               │
│   [Apply]   │   [Load More] or Pagination                  │
└─────────────┴───────────────────────────────────────────────┘
```

**Mobile (≤768px)**:

```text
┌──────────────────────┐
│ Header + [☰]         │
├──────────────────────┤
│ Search Bar           │
│ [Filters Toggle]     │
├──────────────────────┤
│ ┌──────────────────┐ │
│ │ Program Card 1   │ │
│ └──────────────────┘ │
│ ┌──────────────────┐ │
│ │ Program Card 2   │ │
│ └──────────────────┘ │
│ ┌──────────────────┐ │
│ │ Program Card 3   │ │
│ └──────────────────┘ │
└──────────────────────┘
```

#### 1.2 Program Card Component

Each card displays:

**Visual Elements**:

```text
┌─────────────────────────────┐
│ [Thumbnail Image/Icon]      │  ← image (or fallback icon)
├─────────────────────────────┤
│ Program Title               │  ← name (2 lines, ellipsis)
│ by Author Name              │  ← author.name
│                             │
│ Short description text that │  ← description (3-4 lines)
│ gives an overview of the    │
│ program activities...       │
├─────────────────────────────┤
│ 🏷️ tag1  🏷️ tag2           │  ← content_tags (max 3-4)
├─────────────────────────────┤
│ 👥 Age 9-12  ⏱️ 60 min     │  ← Metadata (custom fields)
│ 📍 Outdoor   👤 10-20       │  ← Derived from description
├─────────────────────────────┤
│ ❤️ 24        [Read More →] │  ← like_count, navigation
└─────────────────────────────┘
```

**Interaction States**:

- **Hover**: Slight elevation (shadow: 0 4px 8px rgba(0,0,0,0.1))
- **Focus**: Blue outline (2px solid, --color-primary)
- **Active Like**: Heart filled red, animate pulse
- **Loading**: Skeleton placeholder with shimmer

**Accessibility**:

- Entire card clickable (navigates to detail)
- Like button separate hit target (min 44x44px)
- Keyboard navigable (Tab, Enter, Space)
- ARIA labels: `aria-label="Program: {name}"`

#### 1.3 Search & Filter System

**Search Bar**:

```typescript
interface SearchState {
  query: string; // Search text
  isActive: boolean; // Has user entered text?
  resultCount: number; // Filtered results
  debounceMs: 300; // Delay before search
}
```

**Implementation**:

- Real-time search across `name` and `description` fields
- Case-insensitive, trimmed
- Clear button (X icon) when active
- Show "X results found" below search
- Debounced API calls (300ms delay)

**Filter Categories**:

1. **Tags** (Multi-select checkboxes)

   - Source: `content_tags` relationship
   - Display: Tag name from `tags.name`
   - Logic: OR within tags (show if ANY tag matches)

2. **Workspace** (Dropdown)

   - Source: `workspace_id`
   - Display: `workspace.name`
   - Logic: Exact match
   - Special: "All Workspaces" option

3. **Author** (Autocomplete)

   - Source: `author_id`
   - Display: `author.name`
   - Logic: Exact match

4. **Visibility** (Toggle)

   - Source: `public` boolean
   - Options: Public Only / All / Private Only
   - Default: Public Only (for non-workspace views)

5. **Date Range** (Date pickers)

   - Source: `created_at`
   - Options: From/To dates
   - Logic: Inclusive range

6. **Likes** (Range slider)
   - Source: `like_count`
   - Options: Min/Max likes
   - Display: "24+ likes"

**Filter UI**:

```typescript
interface FilterState {
  tags: UUID[]; // Selected tag IDs
  workspaceId: UUID | null; // Selected workspace
  authorId: UUID | null; // Selected author
  visibility: "public" | "all" | "private";
  dateFrom: Date | null;
  dateTo: Date | null;
  minLikes: number;
  maxLikes: number;
  isCollapsed: boolean; // Mobile sidebar state
}
```

**Filter Actions**:

- Apply Filters (primary button)
- Clear All Filters (text link)
- Active filter count badge (e.g., "3 active")
- Persist in URL query params (shareable links)

#### 1.4 Sorting Options

```typescript
type SortOption =
  | "newest" // created_at DESC
  | "oldest" // created_at ASC
  | "most-liked" // like_count DESC
  | "alphabetical" // name ASC
  | "author"; // author.name ASC

interface SortState {
  sortBy: SortOption;
  sortOrder: "asc" | "desc";
}
```

**UI**: Dropdown in header

```text
Sort by: [Newest First ▼]
```

#### 1.5 View Options

**Grid View** (Default):

- 4 columns on XL (≥1280px)
- 3 columns on LG (≥1024px)
- 2 columns on MD (≥768px)
- 1 column on SM (<768px)

**List View** (Optional):

- Full-width rows
- Horizontal layout (image left, content right)
- More metadata visible

**Toggle**: Icon button (grid/list icon)

#### 1.6 Pagination / Infinite Scroll

**Option A: Pagination** (Recommended for accessibility)

```typescript
interface PaginationState {
  page: number; // Current page (1-indexed)
  perPage: number; // Items per page (default: 24)
  totalPages: number; // Total pages
  totalItems: number; // Total matching programs
}
```

**UI**:

```txt
← Previous  [1] [2] [3] ... [10]  Next →
Showing 25-48 of 237 programs
```

**Option B: Infinite Scroll**

- Load more on scroll bottom
- "Load More" button fallback
- Loading spinner at bottom
- Preserve scroll position on back navigation

---

### 2. Program Detail Page (`/programs/:id`)

**Purpose**: Comprehensive view of a single program with full metadata, instructions, and actions

#### 2.1 URL Structure

```txt
/programs/:programId
Example: /programs/a3e7b8c9-1234-5678-90ab-cdef12345678
```

**Query Params** (Optional):

```txt
?from=browse          // Track source for back navigation
?workspace=:workspaceId  // Context workspace
```

#### 2.2 Page Layout

```txt
┌─────────────────────────────────────────────────────┐
│ Breadcrumb: Home > Programs > [Workspace] > [Name]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌───────────────────────────────────────────────┐ │
│ │ Hero Image (16:9 or 21:9)                     │ │
│ └───────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────┬───────────────────────┐ │
│ │ Program Title           │ [❤️ Like] [Share]    │ │
│ │ by Author Name          │ [Add to Workspace]   │ │
│ ├─────────────────────────┴───────────────────────┤ │
│ │                                                 │ │
│ │ OVERVIEW TAB                                    │ │
│ │                                                 │ │
│ │ Full Description                                │ │
│ │                                                 │ │
│ │ Learning Objectives:                            │ │
│ │ • Objective 1                                   │ │
│ │ • Objective 2                                   │ │
│ │                                                 │ │
│ ├─────────────────────────┬───────────────────────┤ │
│ │                         │                       │ │
│ │ INSTRUCTIONS TAB        │ QUICK INFO SIDEBAR    │ │
│ │                         │                       │ │
│ │ Step-by-step guide      │ 📊 Quick Stats        │ │
│ │                         │ ⏱️ Duration: 60 min   │ │
│ │                         │ 👥 Age: 9-12          │ │
│ │ MATERIALS TAB           │ 📍 Setting: Outdoor   │ │
│ │                         │ 👤 Group: 10-20       │ │
│ │ Required materials      │ 🏷️ Tags               │ │
│ │                         │                       │ │
│ │ COMMENTS TAB            │ 🎯 Workspace          │ │
│ │                         │ Camp Summer 2026      │ │
│ │ User comments           │                       │ │
│ │                         │ 👤 Author             │ │
│ │ RELATED TAB             │ John Doe              │ │
│ │                         │                       │ │
│ │ Similar programs        │ 📅 Created            │ │
│ │                         │ Jan 3, 2026           │ │
│ └─────────────────────────┴───────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### 2.3 Hero Section

**Components**:

1. **Hero Image**:

   - Source: `program.image` or fallback gradient
   - Aspect ratio: 16:9 or 21:9
   - Lazy loaded
   - Alt text: `program.name`

2. **Title Area**:

   ```html
   <h1>{program.name}</h1>
   <p class="byline">by <a href="/users/{author.id}">{author.name}</a></p>
   ```

3. **Action Buttons**:
   - **Like Button**: Toggle like (updates `like_count`)
   - **Share Button**: Opens share modal (copy link, email, social)
   - **Add to Workspace**: Clone program to user's workspace
   - **Edit Button**: (Only visible to author/admin)

#### 2.4 Content Tabs

**Tab Navigation**:

```typescript
type TabId = "overview" | "instructions" | "materials" | "comments" | "related";

interface TabState {
  activeTab: TabId;
}
```

**Tab: Overview**

Content:

- **Full Description**: `program.description` (rendered with line breaks)
- **Learning Objectives**: Custom field (stored in workspace settings or parsed from description)
- **Benefits**: Why run this program?
- **Preparation Time**: Estimated prep time
- **Best For**: Target audience description

**Tab: Instructions**

Content:

- **Step-by-Step Guide**: Numbered list or accordion
  - Step 1: Setup (5 min)
  - Step 2: Introduction (10 min)
  - Step 3: Main activity (30 min)
  - Step 4: Debrief (15 min)
- **Facilitator Tips**: Pro tips for success
- **Safety Notes**: Important precautions
- **Variations**: Alternative ways to run

**Tab: Materials**

Content:

- **Required Materials**:
  - Item name
  - Quantity (per person / per group)
  - Where to source
- **Optional Materials**: Nice-to-have items
- **Space Requirements**: Indoor/outdoor, dimensions
- **Equipment**: Special gear needed

**Tab: Comments** (Count: `program.comments.length`)

Display:

- Comment list (newest first)
- Comment form (if authenticated)
- Like/reply functionality
- Moderation tools (for admins)

**Backend Integration**:

```typescript
// Fetch comments
GET /api/programs/{programId}/comments
Response: Comment[]

// Post comment
POST /api/programs/{programId}/comments
Body: { body: string }
Response: Comment
```

**Tab: Related Programs**

Content:

- 3-6 similar programs (card layout)
- Criteria: Same tags, same workspace, or same author
- Click to navigate

**Backend Integration**:

```typescript
GET /api/programs/{programId}/related
Query: ?limit=6
Response: Program[]
```

#### 2.5 Quick Info Sidebar

**Sections**:

1. **Quick Stats** (Icon + Label + Value)

   - Duration: `⏱️ 60 minutes`
   - Age Group: `👥 9-12 years`
   - Setting: `📍 Outdoor`
   - Group Size: `👤 10-20 participants`
   - Difficulty: `⭐⭐⭐ Moderate`

2. **Tags**

   - Display: Pill-style badges
   - Source: `program.content_tags[]`
   - Clickable: Filter browse page by tag

3. **Workspace Context**

   - Name: `program.workspace.name`
   - Link: Navigate to workspace view
   - (Only show if user has access)

4. **Author Info**

   - Name: `program.author.name`
   - Link: View author profile
   - Contact: (If public)

5. **Metadata**

   - Created: `program.created_at` (formatted)
   - Updated: (If tracked)
   - Views: (If tracked)
   - Likes: `program.like_count`

6. **Actions**
   - **Print Version**: Opens print-friendly view
   - **Export PDF**: Generates PDF download
   - **Report Issue**: Opens report modal
   - **Suggest Edit**: (If enabled)

#### 2.6 Breadcrumb Navigation

```typescript
interface Breadcrumb {
  label: string;
  href: string;
}

const breadcrumbs: Breadcrumb[] = [
  { label: "Home", href: "/" },
  { label: "Programs", href: "/programs" },
  { label: workspace.name, href: `/workspaces/${workspace.id}` },
  { label: program.name, href: null }, // Current page
];
```

**Accessibility**:

- `<nav aria-label="Breadcrumb">`
- Last item non-clickable, `aria-current="page"`

---

### 3. Favorites / My Collection (`/programs/favorites`)

**Purpose**: User-specific saved programs for quick access

#### 3.1 Data Model

**Frontend State**:

```typescript
interface FavoriteState {
  programIds: UUID[]; // List of favorited program IDs
  programs: Program[]; // Full program objects (hydrated)
  collections: Collection[]; // Custom folders (optional)
}

interface Collection {
  id: UUID;
  name: string;
  programIds: UUID[];
}
```

**Backend Storage Options**:

**Option A**: User Preferences (Quick Implementation)

```typescript
// Store in users.preferences JSONB
user.preferences = {
  favoritePrograms: [programId1, programId2, ...]
}
```

**Option B**: Dedicated Table (Scalable)

```sql
CREATE TABLE user_program_favorites (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  program_id UUID REFERENCES content(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  collection_id UUID NULL,
  PRIMARY KEY (user_id, program_id)
);
```

#### 3.2 UI Implementation

**Same as Browse Page** but:

- Filter: Only favorited programs
- Additional action: Remove from favorites
- Empty state: "No favorites yet. Browse programs to add some!"
- Collections sidebar (if enabled)

**API Endpoints**:

```typescript
// Add favorite
POST /api/users/me/favorites
Body: { programId: UUID }

// Remove favorite
DELETE /api/users/me/favorites/{programId}

// Get all favorites
GET /api/users/me/favorites
Response: Program[]

// Bulk operations
POST /api/users/me/favorites/bulk
Body: { programIds: UUID[], action: 'add' | 'remove' }
```

#### 3.3 Export Favorites

**Formats**:

- **PDF**: Print-ready list with summaries
- **CSV**: Spreadsheet with metadata
- **JSON**: Machine-readable export

**UI**: Export button in header

---

### 4. Create/Edit Program (`/programs/new`, `/programs/:id/edit`)

**Purpose**: Allow users to contribute programs to the bank

#### 4.1 Form Fields

Based on backend schema:

```typescript
interface ProgramFormData {
  // Required fields
  name: string; // 1-100 chars
  workspace_id: UUID; // Dropdown selection
  author_id: UUID; // Auto-filled (current user)
  public: boolean; // Toggle (default: false)

  // Optional fields
  description: string | null; // 0-1000 chars, textarea
  image: string | null; // 0-255 chars, URL or upload

  // Auto-generated
  content_type: "program"; // Hidden, always 'program'
  like_count: 0; // Hidden, default 0
  created_at: DateTime; // Hidden, auto-generated

  // Related data (separate saves)
  tags: UUID[]; // Tag selector (multi-select)
}
```

#### 4.2 Form Layout

```txt
┌─────────────────────────────────────────────┐
│ Create New Program                          │
├─────────────────────────────────────────────┤
│                                             │
│ Program Title *                             │
│ [____________________________________]      │
│                                             │
│ Workspace *                                 │
│ [Select workspace ▼]                        │
│                                             │
│ Description                                 │
│ ┌─────────────────────────────────────────┐ │
│ │                                         │ │
│ │ (Rich text editor)                      │ │
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
│ 0 / 1000 characters                         │
│                                             │
│ Image                                       │
│ [Upload Image] or [Enter URL]              │
│ Preview: [thumbnail]                        │
│                                             │
│ Tags                                        │
│ [Select or create tags...]                 │
│ Selected: [tag1 ×] [tag2 ×]                │
│                                             │
│ Visibility                                  │
│ ○ Private (Only workspace members)          │
│ ● Public (Visible to all)                   │
│                                             │
│ ┌─────────────┬───────────────────────────┐ │
│ │ [Cancel]    │ [Save Draft] [Publish] │ │
│ └─────────────┴───────────────────────────┘ │
└─────────────────────────────────────────────┘
```

#### 4.3 Validation

**Client-Side**:

```typescript
const programSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullable(),
  image: z.string().max(255).url().nullable(),
  workspace_id: z.string().uuid(),
  public: z.boolean(),
  tags: z.array(z.string().uuid()),
});
```

**Server-Side**:

- Use Pydantic schemas from backend
- Return validation errors (400 status)

**Error Display**:

- Inline field errors (red text below input)
- Error summary at top (dismissible)

#### 4.4 Tag Management

**Tag Selector**:

- Autocomplete input
- Suggestions from existing tags
- Create new tag on Enter (if doesn't exist)
- Max 10 tags per program (UI limitation)

**API**:

```typescript
// Get all tags
GET /api/tags
Response: Tag[]

// Create tag (if doesn't exist)
POST /api/tags
Body: { name: string }
Response: Tag

// Associate tag with program (on program save)
POST /api/programs/{programId}/tags
Body: { tagIds: UUID[] }
```

#### 4.5 Image Upload

**Options**:

**A. Direct Upload** (Requires backend file storage)

```typescript
POST / api / upload;
Body: FormData(file);
Response: {
  url: string;
}
```

**B. External URL**

- User pastes image URL
- Validate URL format
- Store in `program.image`

**C. Image Service** (e.g., Cloudinary, S3)

- Frontend uploads to service
- Get URL, save to `program.image`

#### 4.6 Save Flow

**Draft Save** (Auto-save every 30s):

```typescript
POST / api / programs;
Body: ProgramFormData;
Response: Program;
```

**Publish**:

```typescript
// Same as draft, but set public: true
POST /api/programs
Body: { ...formData, public: true }
Response: Program
```

**Update**:

```typescript
PATCH / api / programs / { programId };
Body: Partial<ProgramFormData>;
Response: Program;
```

**Redirect**: After save, redirect to `/programs/{programId}`

---

## Technical Architecture

### Frontend Stack

```typescript
// Core
Framework: Next.js 14+ (App Router)
Language: TypeScript 5+
Styling: CSS Modules + Custom Properties
State: React Context + URL State

// Data Fetching
Client: SWR or TanStack Query
API: REST (Backend FastAPI)

// Forms
Validation: Zod
Forms: React Hook Form

// UI Components
Base: Custom components (existing in /components)
Icons: Lucide React or Heroicons
Animations: Framer Motion (optional)

// Utilities
Dates: date-fns
UUIDs: uuid
Markdown: markdown-lite (existing)
```

### Backend API

```text
Base URL: /api/v1 (or configured)

Endpoints:
  GET    /programs                    # List programs (with filters)
  POST   /programs                    # Create program
  GET    /programs/:id                # Get program details
  PATCH  /programs/:id                # Update program
  DELETE /programs/:id                # Delete program

  GET    /programs/:id/comments       # Get comments
  POST   /programs/:id/comments       # Add comment

  GET    /programs/:id/related        # Get related programs

  GET    /tags                        # List all tags
  POST   /tags                        # Create tag

  POST   /programs/:id/like           # Toggle like

  GET    /users/me/favorites          # Get user favorites
  POST   /users/me/favorites          # Add favorite
  DELETE /users/me/favorites/:id      # Remove favorite

  GET    /workspaces                  # List workspaces (for form)
```

### Database Queries

**List Programs** (with filters):

```sql
SELECT
  c.id, c.name, c.description, c.public, c.like_count, c.created_at,
  c.author_id, p.image, p.workspace_id,
  u.name as author_name,
  w.name as workspace_name,
  ARRAY_AGG(t.name) as tags
FROM content c
INNER JOIN programs p ON c.id = p.id
INNER JOIN users u ON c.author_id = u.id
INNER JOIN workspaces w ON p.workspace_id = w.id
LEFT JOIN content_tags ct ON c.id = ct.content_id
LEFT JOIN tags t ON ct.tag_id = t.id
WHERE c.content_type = 'program'
  AND (c.public = true OR p.workspace_id IN (:user_workspace_ids))
  AND (:search IS NULL OR c.name ILIKE :search OR c.description ILIKE :search)
  AND (:tag_ids IS NULL OR t.id = ANY(:tag_ids))
  AND (:workspace_id IS NULL OR p.workspace_id = :workspace_id)
  AND (:author_id IS NULL OR c.author_id = :author_id)
  AND c.created_at >= :date_from
  AND c.created_at <= :date_to
  AND c.like_count >= :min_likes
  AND c.like_count <= :max_likes
GROUP BY c.id, p.id, u.id, w.id
ORDER BY
  CASE WHEN :sort = 'newest' THEN c.created_at END DESC,
  CASE WHEN :sort = 'oldest' THEN c.created_at END ASC,
  CASE WHEN :sort = 'most-liked' THEN c.like_count END DESC,
  CASE WHEN :sort = 'alphabetical' THEN c.name END ASC
LIMIT :limit OFFSET :offset;
```

**Get Program Detail**:

```sql
SELECT
  c.*,
  p.image, p.workspace_id,
  u.id as author_id, u.name as author_name, u.email as author_email,
  w.id as workspace_id, w.name as workspace_name,
  json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) as tags,
  COUNT(DISTINCT cm.id) as comment_count
FROM content c
INNER JOIN programs p ON c.id = p.id
INNER JOIN users u ON c.author_id = u.id
INNER JOIN workspaces w ON p.workspace_id = w.id
LEFT JOIN content_tags ct ON c.id = ct.content_id
LEFT JOIN tags t ON ct.tag_id = t.id
LEFT JOIN comments cm ON c.id = cm.content_id
WHERE c.id = :program_id
GROUP BY c.id, p.id, u.id, w.id;
```

---

## State Management

### URL State (Search Params)

**Benefits**: Shareable, bookmarkable, SEO-friendly

```typescript
// Example URL:
/programs?q=camping&tags=outdoor,survival&workspace=abc123&sort=newest&page=2

// Parse with useSearchParams (Next.js)
const searchParams = useSearchParams();
const query = searchParams.get('q') || '';
const tags = searchParams.get('tags')?.split(',') || [];
const workspaceId = searchParams.get('workspace') || null;
const sort = searchParams.get('sort') || 'newest';
const page = parseInt(searchParams.get('page') || '1');

// Update URL
const router = useRouter();
const updateFilters = (newFilters: FilterState) => {
  const params = new URLSearchParams();
  if (newFilters.query) params.set('q', newFilters.query);
  if (newFilters.tags.length) params.set('tags', newFilters.tags.join(','));
  if (newFilters.workspaceId) params.set('workspace', newFilters.workspaceId);
  if (newFilters.sortBy !== 'newest') params.set('sort', newFilters.sortBy);
  if (newFilters.page !== 1) params.set('page', newFilters.page.toString());

  router.push(`/programs?${params.toString()}`);
};
```

### Client State (React Context)

**Likes** (`contexts/LikesContext.tsx`):

Like state is seeded from the `liked_by_me` and `like_count` fields returned by the API on every list and detail response — no separate fetch is made. The context holds an in-memory map so that a like toggled on the programs list is immediately reflected when navigating to the detail page.

```typescript
// useLikes — call this in any component that needs like state
const { likeCount, isLiked, toggleLike } = useLikes(
  programId,
  initialCount,  // from like_count in API response
  initialLiked   // from liked_by_me in API response
);
```

- State is seeded once per ID (subsequent renders with the same ID won't overwrite a toggled state)
- `toggleLike` does an optimistic update and reverts on API error
- `LikesProvider` must wrap the app (already in `layout.tsx`)
- State is in-memory only — not persisted across page reloads

**User Favorites**:

```typescript
// contexts/FavoritesContext.tsx
interface FavoritesContextValue {
  favorites: Set<UUID>;
  isLoading: boolean;
  toggleFavorite: (programId: UUID) => Promise<void>;
  isFavorite: (programId: UUID) => boolean;
}

export const FavoritesProvider: React.FC = ({ children }) => {
  const [favorites, setFavorites] = useState<Set<UUID>>(new Set());

  // Load from backend on mount
  useEffect(() => {
    fetchFavorites();
  }, []);

  const toggleFavorite = async (programId: UUID) => {
    const wasFavorite = favorites.has(programId);

    // Optimistic update
    setFavorites(prev => {
      const next = new Set(prev);
      wasFavorite ? next.delete(programId) : next.add(programId);
      return next;
    });

    try {
      if (wasFavorite) {
        await fetch(`/api/users/me/favorites/${programId}`, { method: 'DELETE' });
      } else {
        await fetch('/api/users/me/favorites', {
          method: 'POST',
          body: JSON.stringify({ programId }),
        });
      }
    } catch (error) {
      // Revert on error
      setFavorites(prev => {
        const next = new Set(prev);
        wasFavorite ? next.add(programId) : next.delete(programId);
        return next;
      });
      toast.error('Failed to update favorite');
    }
  };

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite, ... }}>
      {children}
    </FavoritesContext.Provider>
  );
};
```

### Server State (SWR)

**Program List**:

```typescript
// hooks/usePrograms.ts
export function usePrograms(filters: FilterState) {
  const params = buildQueryParams(filters);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/programs?${params}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 min
    }
  );

  return {
    programs: data?.programs || [],
    totalCount: data?.totalCount || 0,
    totalPages: data?.totalPages || 0,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}
```

**Program Detail**:

```typescript
// hooks/useProgram.ts
export function useProgram(programId: UUID) {
  const { data, error, isLoading, mutate } = useSWR(
    programId ? `/api/programs/${programId}` : null,
    fetcher
  );

  return {
    program: data,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}
```

---

## Component Hierarchy

``` text
app/
├── programs/
│   ├── page.tsx                      # Browse page
│   ├── layout.tsx                    # Shared layout
│   ├── [id]/
│   │   └── page.tsx                  # Detail page
│   ├── new/
│   │   └── page.tsx                  # Create page
│   ├── favorites/
│   │   └── page.tsx                  # Favorites page
│   └── components/                   # Local components
│       ├── ProgramCard.tsx
│       ├── ProgramGrid.tsx
│       ├── ProgramFilters.tsx
│       ├── ProgramSearch.tsx
│       ├── ProgramSort.tsx
│       ├── ProgramDetail.tsx
│       ├── ProgramTabs.tsx
│       ├── ProgramQuickInfo.tsx
│       ├── ProgramComments.tsx
│       ├── ProgramForm.tsx
│       └── LikeButton.tsx

components/                            # Shared components
├── Button/
├── Modal/
├── Dropdown/
├── Checkbox/
├── Input/
├── Textarea/
├── TagSelector/
├── Pagination/
└── LoadingSpinner/

hooks/
├── usePrograms.ts
├── useProgram.ts
├── useFavorites.ts
├── useTags.ts
└── useWorkspaces.ts

contexts/
├── FavoritesContext.tsx
└── AuthContext.tsx                   # Existing

lib/
├── api.ts                            # API client
├── validation.ts                     # Zod schemas
└── utils.ts                          # Utilities
```

---

## Implementation Phases

### Phase 1: Core Browse (Week 1-2)

**Goal**: Basic program browsing and viewing

**Tasks**:

1. [x] Create `/programs` page structure
2. [x] Implement `ProgramCard` component
3. [x] Implement `ProgramGrid` with responsive layout
4. [x] Add basic search functionality
5. [x] Add tag filtering (multi-select)
6. [x] Implement sorting (newest, most-liked, alphabetical)
7. [x] Add pagination
8. [x] Create program detail page (`/programs/[id]`)
9. [ ] Display program metadata (name, description, author, tags)
10. [ ] Backend API integration (GET /programs, GET /programs/:id)

**Deliverables**:

- Users can browse all public programs
- Users can search and filter by tags
- Users can view program details
- Responsive on mobile/tablet/desktop

### Phase 2: Interactions (Week 3)

**Goal**: User engagement features

**Tasks**:

1. [x] Implement like button (toggle, optimistic update)
2. [ ] Add favorites system (context + backend)
3. [ ] Create favorites page (`/programs/favorites`)
4. [ ] Add "Add to Workspace" functionality (clone program)
5. [ ] Implement share modal (copy link, email)
6. [ ] Add breadcrumb navigation
7. [ ] Implement "Related Programs" section
8. [ ] Backend API (POST like, favorites CRUD)

**Deliverables**:

- Users can like programs
- Users can save favorites
- Users can share programs
- Users can clone programs to their workspace

### Phase 3: Content Creation (Week 4)

**Goal**: Allow users to contribute programs

**Tasks**:

1. [ ] Create program form (`/programs/new`)
2. [ ] Implement form validation (Zod + React Hook Form)
3. [ ] Add rich text editor for description
4. [ ] Implement tag selector (autocomplete, create new)
5. [ ] Add image upload/URL input
6. [ ] Add workspace selector dropdown
7. [ ] Implement save draft functionality
8. [ ] Add edit page (`/programs/[id]/edit`)
9. [ ] Add delete confirmation modal
10. [ ] Backend API (POST /programs, PATCH /programs/:id, DELETE)

**Deliverables**:

- Users can create new programs
- Users can edit their own programs
- Users can delete their own programs
- Validation and error handling

### Phase 4: Advanced Filters (Week 5)

**Goal**: Comprehensive filtering and discovery

**Tasks**:

1. [ ] Add workspace filter dropdown
2. [x] Add author filter (inline autocomplete — startsWith, debounced, clear button)
3. [ ] Add date range filter (date pickers)
4. [ ] Add likes range filter (slider)
5. [ ] Add visibility filter (public/private toggle)
6. [x] Implement "Clear All Filters" button
7. [x] Add active filter count badge
8. [x] Persist filters in URL (shareable links)
9. [ ] Add filter presets (saved searches, optional)
10. [ ] Backend query optimization (indexed filters)

**Deliverables**:

- Users can filter by workspace, author, dates, likes
- Filter state persists in URL
- Shareable filtered views

### Phase 5: Comments & Community (Week 6)

**Goal**: Enable discussion and feedback

**Tasks**:

1. [ ] Implement comments section on detail page
2. [ ] Add comment form (authenticated users)
3. [ ] Display comment list (newest first, paginated)
4. [ ] Add comment timestamps and author info
5. [ ] Implement comment editing (author only)
6. [ ] Implement comment deletion (author/admin)
7. [ ] Add comment moderation tools (admin)
8. [ ] Add "Report Comment" functionality
9. [ ] Backend API (comments CRUD)

**Deliverables**:

- Users can comment on programs
- Users can edit/delete their comments
- Admins can moderate comments

### Phase 6: Enhanced Detail Page (Week 7)

**Goal**: Rich program information

**Tasks**:

1. [ ] Implement tabbed interface (Overview, Instructions, Materials, etc.)
2. [ ] Add "Quick Info" sidebar with metadata
3. [ ] Add hero image section
4. [ ] Implement "Print Version" (print-friendly CSS)
5. [ ] Add "Export PDF" functionality (html2pdf or backend)
6. [ ] Add "Suggest Edit" form (community contributions)
7. [ ] Implement "Report Issue" modal
8. [ ] Add facilitator tips section
9. [ ] Add variations/adaptations section
10. [ ] Optimize loading (skeleton screens, lazy load)

**Deliverables**:

- Comprehensive program detail page
- Multiple content sections (tabs)
- Export/print functionality
- Community contribution tools

### Phase 7: Polish & Performance (Week 8)

**Goal**: Production-ready quality

**Tasks**:

1. [ ] Implement skeleton loading states
2. [ ] Add error boundaries
3. [ ] Optimize images (next/image, lazy loading)
4. [ ] Add infinite scroll (optional alternative to pagination)
5. [ ] Implement debounced search
6. [ ] Add keyboard shortcuts (/, Esc, etc.)
7. [ ] Improve accessibility (ARIA labels, focus management)
8. [ ] Add animations (Framer Motion for cards, modals)
9. [ ] Performance audit (Lighthouse, Core Web Vitals)
10. [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)

**Deliverables**:

- Smooth, polished user experience
- Fast loading and interactions
- Accessible to all users
- Cross-browser compatible

### Phase 8: Nice-to-Haves (Future)

**Goal**: Enhanced features

**Tasks**:

1. ⏳ User ratings and reviews
2. ⏳ Recently viewed programs
3. ⏳ Comparison feature (side-by-side)
4. ⏳ Seasonal/featured highlights
5. ⏳ "Program of the Week" banner
6. ⏳ Email program details
7. ⏳ Save search/filter combinations
8. ⏳ Program analytics (views, engagement)
9. ⏳ Advanced text search (full-text, fuzzy)
10. ⏳ Collections/folders for favorites

---

## Testing Strategy

### Unit Tests (Jest + React Testing Library)

**Components**:

```typescript
// ProgramCard.test.tsx
describe("ProgramCard", () => {
  it("renders program name", () => {
    render(<ProgramCard program={mockProgram} />);
    expect(screen.getByText(mockProgram.name)).toBeInTheDocument();
  });

  it("toggles like on click", async () => {
    const onLike = jest.fn();
    render(<ProgramCard program={mockProgram} onLike={onLike} />);

    const likeButton = screen.getByLabelText(/like/i);
    await userEvent.click(likeButton);

    expect(onLike).toHaveBeenCalledWith(mockProgram.id);
  });

  it("is keyboard accessible", async () => {
    render(<ProgramCard program={mockProgram} />);

    await userEvent.tab(); // Focus card
    await userEvent.keyboard("{Enter}"); // Activate

    expect(mockRouter.push).toHaveBeenCalledWith(`/programs/${mockProgram.id}`);
  });
});
```

**Hooks**:

```typescript
// usePrograms.test.ts
describe("usePrograms", () => {
  it("fetches programs with filters", async () => {
    const { result } = renderHook(() => usePrograms({ query: "camping" }));

    await waitFor(() => {
      expect(result.current.programs).toHaveLength(3);
    });
  });

  it("handles errors gracefully", async () => {
    server.use(
      rest.get("/api/programs", (req, res, ctx) => {
        return res(ctx.status(500));
      })
    );

    const { result } = renderHook(() => usePrograms({}));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
```

### Integration Tests (Playwright)

**User Flows**:

```typescript
// programs-browse.spec.ts
test("browse and filter programs", async ({ page }) => {
  await page.goto("/programs");

  // Search
  await page.fill('input[name="search"]', "camping");
  await page.waitForTimeout(500); // Debounce

  // Verify results
  const cards = await page.locator('[data-testid="program-card"]').count();
  expect(cards).toBeGreaterThan(0);

  // Filter by tag
  await page.click("text=outdoor");
  await page.click('button:has-text("Apply Filters")');

  // Verify filtered results
  const filteredCards = await page
    .locator('[data-testid="program-card"]')
    .count();
  expect(filteredCards).toBeLessThanOrEqual(cards);
});

test("view program detail and add comment", async ({ page }) => {
  await page.goto("/programs");

  // Click first program
  await page.click('[data-testid="program-card"]');

  // Verify detail page
  expect(page.url()).toContain("/programs/");
  await expect(page.locator("h1")).toBeVisible();

  // Add comment
  await page.click("text=Comments");
  await page.fill('textarea[name="comment"]', "Great program!");
  await page.click('button:has-text("Post Comment")');

  // Verify comment appears
  await expect(page.locator("text=Great program!")).toBeVisible();
});
```

### Accessibility Tests (axe-core)

```typescript
// accessibility.test.tsx
import { axe, toHaveNoViolations } from "jest-axe";
expect.extend(toHaveNoViolations);

describe("Accessibility", () => {
  it("ProgramCard has no violations", async () => {
    const { container } = render(<ProgramCard program={mockProgram} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("ProgramFilters has no violations", async () => {
    const { container } = render(<ProgramFilters />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### Performance Tests

**Metrics**:

- **FCP (First Contentful Paint)**: < 1.5s
- **LCP (Largest Contentful Paint)**: < 2.5s
- **CLS (Cumulative Layout Shift)**: < 0.1
- **FID (First Input Delay)**: < 100ms
- **TTI (Time to Interactive)**: < 3.5s

**Tools**:

- Lighthouse CI
- WebPageTest
- Chrome DevTools Performance

---

## Performance Considerations

### 1. Data Fetching

**Pagination**:

- Default: 24 programs per page
- Backend LIMIT/OFFSET queries
- Avoid loading entire dataset

**Caching**:

- SWR cache (60s deduping interval)
- HTTP cache headers (Cache-Control: max-age=300)
- CDN caching for images

**Prefetching**:

- Prefetch next page on hover (link prefetch)
- Prefetch program detail on card hover (optional)

### 2. Images

**Optimization**:

- Use `next/image` for automatic optimization
- Lazy load images (loading="lazy")
- Responsive images (srcset)
- WebP format with fallbacks

**Thumbnails**:

- Generate multiple sizes (150px, 300px, 600px, 1200px)
- Serve appropriate size based on viewport

### 3. Code Splitting

**Route-based**:

- Next.js automatic code splitting per route
- `/programs` vs `/programs/[id]` separate bundles

**Component-based**:

```typescript
// Lazy load heavy components
const ProgramForm = dynamic(() => import("./ProgramForm"), {
  loading: () => <LoadingSpinner />,
});

const CommentsSection = dynamic(() => import("./ProgramComments"), {
  ssr: false, // Client-side only
});
```

### 4. Virtualization

**For large lists** (1000+ items):

```typescript
import { VirtualList } from "react-virtual";

function ProgramGrid({ programs }) {
  return (
    <VirtualList
      items={programs}
      itemHeight={350}
      renderItem={(program) => <ProgramCard program={program} />}
    />
  );
}
```

### 5. Debouncing & Throttling

**Search input**:

```typescript
const debouncedSearch = useMemo(
  () => debounce((query: string) => setSearchQuery(query), 300),
  []
);
```

**Scroll events**:

```typescript
const throttledScroll = useMemo(() => throttle(() => handleScroll(), 200), []);
```

---

## Accessibility Requirements

### WCAG 2.1 Level AA Compliance

#### 1. Keyboard Navigation

**Browse Page**:

- `Tab`: Navigate between cards, filters, search
- `Enter`/`Space`: Activate buttons/links
- `Esc`: Close modals, clear search
- `/`: Focus search input (global shortcut)
- `Arrow Keys`: Navigate within filters

**Detail Page**:

- `Tab`: Navigate sections, tabs, buttons
- `Arrow Keys`: Switch between tabs
- `Esc`: Close modals

#### 2. Screen Reader Support

**Landmarks**:

```html
<nav aria-label="Breadcrumb">...</nav>
<aside aria-label="Filters">...</aside>
<main aria-label="Program List">...</main>
<search role="search">...</search>
```

**ARIA Labels**:

```html
<button aria-label="Like this program">❤️</button>
<button aria-label="Add to favorites">⭐</button>
<img alt="Program thumbnail: {program.name}" />
<input aria-describedby="search-help" />
<div role="status" aria-live="polite">{resultCount} results found</div>
```

**Focus Management**:

- Return focus to trigger after modal close
- Announce filter changes
- Skip links for main content

#### 3. Color Contrast

**Minimum Ratios**:

- Text: 4.5:1 (normal), 3:1 (large text)
- Icons: 3:1
- Focus indicators: 3:1

**Test Tools**:

- Chrome DevTools Accessibility Panel
- axe DevTools extension
- WAVE extension

#### 4. Responsive Text

**Font Sizes**:

- Base: 16px (1rem)
- Support 200% zoom without horizontal scroll
- Relative units (rem, em) for all text

#### 5. Error Handling

**Form Errors**:

```html
<input aria-invalid="true" aria-describedby="name-error" />
<div id="name-error" role="alert">Name is required</div>
```

**Live Regions**:

```html
<div role="alert" aria-live="assertive">
  Failed to save program. Please try again.
</div>
```

---

## API Response Examples

### GET /api/programs (List)

**Request**:

``` text
GET /api/programs?q=camping&tags=outdoor,survival&workspace=abc123&sort=newest&page=1&limit=24
```

**Response**:

```json
{
  "programs": [
    {
      "id": "a3e7b8c9-1234-5678-90ab-cdef12345678",
      "content_type": "program",
      "name": "Wilderness Survival Basics",
      "description": "Learn essential outdoor survival skills including shelter building, fire starting, and navigation.",
      "public": true,
      "like_count": 42,
      "created_at": "2026-01-03T14:30:00Z",
      "author_id": "user-uuid-123",
      "image": "https://cdn.example.com/programs/wilderness.jpg",
      "workspace_id": "workspace-abc123",
      "author": {
        "id": "user-uuid-123",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "workspace": {
        "id": "workspace-abc123",
        "name": "Summer Camp 2026"
      },
      "tags": [
        { "id": "tag-1", "name": "outdoor" },
        { "id": "tag-2", "name": "survival" }
      ],
      "comment_count": 8
    }
    // ... more programs
  ],
  "pagination": {
    "page": 1,
    "perPage": 24,
    "totalPages": 10,
    "totalItems": 237
  }
}
```

### GET /api/programs/:id (Detail)

**Request**:

``` text
GET /api/programs/a3e7b8c9-1234-5678-90ab-cdef12345678
```

**Response**:

```json
{
  "id": "a3e7b8c9-1234-5678-90ab-cdef12345678",
  "content_type": "program",
  "name": "Wilderness Survival Basics",
  "description": "Comprehensive outdoor survival program covering shelter, fire, water, and navigation.\n\nThis program is designed for youth ages 12-17 and takes approximately 2 hours to complete.\n\nLearning Objectives:\n• Understand basic survival priorities (shelter, water, fire, food)\n• Build a basic debris shelter\n• Start fire using multiple methods\n• Navigate using map and compass\n• Recognize edible and poisonous plants\n\nRequired Materials:\n• Tarps (1 per group)\n• Rope/paracord (50 ft per group)\n• Matches, lighters, ferro rods\n• Compasses (1 per person)\n• Local maps\n• First aid kit",
  "public": true,
  "like_count": 42,
  "created_at": "2026-01-03T14:30:00Z",
  "author_id": "user-uuid-123",
  "image": "https://cdn.example.com/programs/wilderness.jpg",
  "workspace_id": "workspace-abc123",
  "author": {
    "id": "user-uuid-123",
    "name": "John Doe",
    "email": "john@example.com",
    "pronouns": "he/him"
  },
  "workspace": {
    "id": "workspace-abc123",
    "name": "Summer Camp 2026",
    "group_id": "group-xyz789"
  },
  "tags": [
    { "id": "tag-1", "name": "outdoor" },
    { "id": "tag-2", "name": "survival" },
    { "id": "tag-3", "name": "skills" }
  ],
  "events": [
    {
      "id": "event-1",
      "name": "Survival Skills Workshop",
      "start_dt": "2026-06-15T09:00:00Z",
      "end_dt": "2026-06-15T11:00:00Z"
    }
  ],
  "comment_count": 8
}
```

### POST /api/programs (Create)

**Request**:

```json
{
  "name": "Beginner Archery",
  "description": "Introduction to archery safety and basic shooting techniques.",
  "public": false,
  "workspace_id": "workspace-abc123",
  "image": "https://cdn.example.com/archery.jpg",
  "tags": ["sports", "skills"]
}
```

**Response**:

```json
{
  "id": "new-program-uuid",
  "content_type": "program",
  "name": "Beginner Archery",
  "description": "Introduction to archery safety and basic shooting techniques.",
  "public": false,
  "like_count": 0,
  "created_at": "2026-01-05T10:15:00Z",
  "author_id": "current-user-uuid",
  "image": "https://cdn.example.com/archery.jpg",
  "workspace_id": "workspace-abc123"
}
```

### GET /api/programs/:id/comments

**Response**:

```json
{
  "comments": [
    {
      "id": "comment-1",
      "body": "Great program! My troop loved the shelter building activity.",
      "created_at": "2026-01-04T15:30:00Z",
      "user_id": "user-456",
      "content_id": "program-123",
      "user": {
        "id": "user-456",
        "name": "Jane Smith"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "totalItems": 8
  }
}
```

---

## Conclusion

This comprehensive implementation guide provides a detailed roadmap for building the Program Browse & Discovery System. It integrates seamlessly with the existing backend data model (Content → Programs inheritance, tags, workspaces, users) and frontend architecture (Next.js, CSS Modules, existing components).

### Next Steps

1. **Review & Validate**: Review this document with stakeholders and development team
2. **Backend Coordination**: Ensure all API endpoints are implemented or planned
3. **Design Mockups**: Create high-fidelity designs based on layouts specified
4. **Development Setup**: Initialize branches, tickets, and project board
5. **Phase 1 Kickoff**: Begin implementation of core browse features

### Success Metrics

- **Engagement**: 80%+ of users browse programs weekly
- **Discovery**: Average 5+ programs viewed per session
- **Contribution**: 20%+ of users create programs
- **Performance**: All Core Web Vitals in "Good" range
- **Accessibility**: Zero critical a11y issues (axe audit)

### Support & Resources

- **Backend Docs**: `/docs/current-state-of-data.md`
- **Frontend Docs**: `/docs/frontend/user-interaction-flow.md`
- **Design System**: `/docs/frontend/DESIGN-TOKEN-STANDARDS.md`
- **API Reference**: (To be created)
- **Component Library**: `/components/`

---

**Document Prepared By**: Development Team  
**For Questions**: Contact project lead or open GitHub discussion
