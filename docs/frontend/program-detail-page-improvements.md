# Program Detail Page - Implementation Plan

> **Last Updated:** 2026-01-08  
> **Status:** Requires Decision on Blocking Issues  
> **Document Type:** Strategic Plan

## 🚨 BLOCKING ISSUES (Must Resolve Before Work Begins)

### Issue #1: Backend/Frontend Data Schema Mismatch

**Decision Deadline:** By end of Week 1  
**Decision Owner:** Tech Lead + Backend Team Lead  
**Blocker Status:** 🔴 CRITICAL - Blocks all feature work

#### Current Problem

**Backend Returns:**

- `author_id` (UUID) - Frontend expects `author: { id, name, email }`
- `workspace_id` (UUID) - Frontend expects `workspace: { id, name }`
- No `comment_count` - Frontend expects this field

#### Decision Options

**Option A: Update Backend Schemas (Recommended)**

```
Pros:
✅ Single API call (better performance)
✅ Matches RESTful best practices
✅ Simplifies frontend logic
✅ Better for mobile/slow connections
✅ Prevents N+1 query problems

Cons:
❌ Requires backend schema changes
❌ Needs repository query updates
❌ May impact other consumers of API
❌ Estimated 2-3 days backend work

Implementation:
1. Add UserNested and WorkspaceNested schemas
2. Update ProgramOut to include nested objects
3. Update repository to eagerly load relationships
4. Add comment_count as computed property
5. Run migrations if needed
```

**Option B: Frontend Fetches Separately**

```
Pros:
✅ No backend changes needed
✅ Can start immediately
✅ More flexible caching strategies

Cons:
❌ Multiple API calls (worse performance)
❌ More complex frontend code
❌ Race conditions possible
❌ Poor user experience on slow networks
❌ Harder to maintain consistency

Implementation:
1. Update Program type to optional nested objects
2. Create fetchUserById and fetchWorkspaceById utilities
3. Fetch in parallel after getting program
4. Handle loading states for each call
5. Cache responses to minimize calls
```

**Recommendation:** Option A (Update Backend)

- **Reasoning:** Better long-term architecture, better UX, aligns with REST principles
- **Timeline:** 3 days backend + 1 day frontend adjustment
- **Fallback:** If backend cannot commit, proceed with Option B as temporary solution

#### Decision Log

- [x] Decision made by: Development Team
- [x] Date decided: 2026-01-08
- [x] Approach chosen: Option A (Update Backend Schemas)
- [x] Estimated completion: 2026-01-08 (Completed)

**Implementation Summary:**
- ✅ Created `UserNested` schema with id, name, email
- ✅ Created `WorkspaceNested` schema with id, name  
- ✅ Updated `ContentOut` to include `author: UserNested` and `comment_count: int`
- ✅ Updated `ProgramOut` to include `workspace: WorkspaceNested`
- ✅ Updated `EventOut` to include `workspace: WorkspaceNested`
- ✅ Updated repository queries to eagerly load `author`, `workspace`, and `comments` relationships
- ✅ Added `comment_count` computed property to Content model
- ✅ All schemas load successfully without errors

**Next Steps:**
- Test API endpoints with actual data
- Verify frontend receives correctly formatted responses
- Update frontend types if any adjustments needed

---

## 🎯 Goals & Success Metrics

### Primary Goal

Transform the program detail page from a static display into a fully interactive content management experience for Slóði scout leaders.

### User Problems We're Solving

1. **For Program Owners:** Cannot edit or manage their programs after creation
2. **For Community Members:** Limited interaction (cannot comment, properly like, or engage)
3. **For All Users:** Poor mobile experience, confusing navigation, lack of visual polish

### Success Metrics

#### Phase 1 (MVP) - Week 1-2

- [ ] **User Satisfaction:** 80% of test users can successfully edit their programs
- [ ] **Performance:** Page load < 2s, edit save < 1s
- [ ] **Functionality:** 95% of edit operations succeed without errors
- [ ] **Accessibility:** Pass aXe audit with 0 critical issues

#### Phase 2 (Enhancement) - Week 3-4

- [ ] **Engagement:** 30% increase in program interactions (likes, comments)
- [ ] **Mobile:** Mobile usability score > 85
- [ ] **Performance:** Lighthouse score > 90 across all metrics

#### Long-term (Post-Launch)

- [ ] **Adoption:** 70% of program creators edit their programs at least once
- [ ] **Quality:** Average program completeness score > 80%
- [ ] **Retention:** Users return to view programs 3x more often

---

## 👥 User Journeys

### Journey 1: Program Owner (Primary Focus)

**Persona:** Sigurður, scout leader, created a "Haustdagskrá 2026" program

1. **Navigate to program** → Sees "Edit" button (only visible to owner)
2. **Click Edit** → Enters edit mode, all fields become editable
3. **Update description** → Sees real-time character count, validation
4. **Upload image** → Drag-drop new image, sees preview
5. **Add tags** → Autocomplete search for tags, adds "útivera", "leikir"
6. **Click Save** → Optimistic update, success notification
7. **View changes** → Exits edit mode, sees updated program immediately

**Pain Points to Solve:**

- No way to fix typos or update outdated information
- Cannot change program visibility (public/private)
- No image management
- Cannot organize with tags

### Journey 2: Community Member (Secondary)

**Persona:** Anna, scout leader from another troop, browsing for ideas

1. **Discover program** → Sees appealing thumbnail and title
2. **Read overview** → Clear description, well-formatted content
3. **View events** → Sees calendar of activities in this program
4. **Like program** → Clicks heart, saved to favorites
5. **Comment** → Asks question about activity logistics
6. **Share** → Copies link to share with their troop

**Pain Points to Solve:**

- Cannot interact with content (passive viewing only)
- Cannot save/bookmark interesting programs
- No way to engage with community

### Journey 3: Public Visitor (Tertiary)

**Persona:** Guðmundur, parent considering joining scouts

1. **Find program** → Via Google search or shared link
2. **Assess quality** → Sees professional layout, clear information
3. **Read details** → Understands what scouts do in this program
4. **See engagement** → Notices likes/comments (social proof)
5. **Contact/Join** → Finds troop information easily

**Pain Points to Solve:**

- Unclear what programs are about
- Poor first impression (emoji-heavy, unpolished)
- Hard to find next steps

---

## 📊 Feature Prioritization (MoSCoW)

### Must Have (MVP - Phase 1) 🔴

**Blocking work if not included**

1. **Authentication & Authorization**

   - Get current user from AuthContext
   - Compare with program author_id
   - Show/hide edit button based on ownership

2. **Basic Edit Mode**

   - Toggle edit/view mode
   - Editable name field (with validation)
   - Editable description textarea
   - Public/private toggle
   - Save button with loading state
   - Cancel button

3. **Core Visual Updates**

   - Remove all emoji decorations
   - Replace with proper icon library (Lucide React)
   - Apply design token system consistently
   - Improve typography hierarchy
   - Basic responsive layout

4. **Error Handling**
   - Program not found (404)
   - Permission denied (403)
   - Save error with rollback
   - Network error handling

**MVP Success Criteria:** Owner can edit their program and see changes immediately

### Should Have (Phase 2) 🟡

**Important but not blocking launch**

1. **Image Upload**

   - Drag-and-drop upload
   - Image preview
   - File validation
   - Progress indicator

2. **Tag Management**

   - Tag selector with search
   - Add/remove tags
   - Tag suggestions

3. **Like System**

   - Integrate with backend API
   - Optimistic UI update
   - Show current state
   - Disable for unauthenticated users

4. **Comment System (Basic)**

   - Display comments
   - Add new comment
   - Delete own comment

5. **Enhanced Layout**
   - Improved tab navigation
   - Better sidebar information
   - Loading skeletons
   - Empty states

### Could Have (Phase 3) 🟢

**Nice to have, but can be deferred**

1. **Rich Comments**

   - Edit comments
   - Threaded replies
   - Markdown support

2. **Share Functionality**

   - Native share API
   - Copy to clipboard
   - Social media links

3. **Advanced Images**

   - Image cropping
   - Multiple images
   - Image gallery

4. **Enhanced Accessibility**
   - Screen reader testing
   - Keyboard shortcut help
   - Focus management

### Won't Have (Out of Scope) ⚪

**Explicitly deferred to future phases**

1. Version history / audit log
2. Real-time collaborative editing
3. AI-powered content suggestions
4. Advanced analytics dashboard
5. Integration with external calendar systems
6. Content moderation workflow

---

## 🗺️ Implementation Roadmap

### Phase 1: Foundation & MVP (Week 1-2) - 10 days with buffer

**User Value:** Program owners can edit and manage their content

**Features Included:**

- ✅ Resolve backend/frontend data mismatch (Days 1-3)
- ✅ Authentication & permission system (Day 4)
- ✅ Basic edit mode with save/cancel (Days 5-7)
- ✅ Visual cleanup: remove emojis, add icons (Days 6-8)
- ✅ Form validation & error handling (Days 8-9)
- ✅ Testing & bug fixes (Day 10)

**Success Criteria:**

- [ ] Owner sees "Edit" button on their programs only
- [ ] Can edit name, description, public/private status
- [ ] Changes save successfully with visual feedback
- [ ] 95% success rate on save operations
- [ ] Product owner approves edit workflow
- [ ] Zero console errors on production

**Dependencies:**

```
Backend Data Schema (Days 1-3)
        ↓
    Auth Context (Day 4)
        ↓
    Edit Mode UI (Days 5-7)
    ↓           ↓
Validation  Visual Cleanup
(Days 8-9)  (Days 6-8)
    ↓           ↓
    Testing & Polish (Day 10)
```

**Risks & Mitigations:**
| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Backend schema changes delayed | 🔴 High | Medium | Have Option B ready (frontend fetches) |
| Auth integration complex | 🟡 Medium | Low | Use existing AuthContext, keep it simple |
| Form validation edge cases | 🟡 Medium | High | Start with basic validation, iterate |
| Timeline slips | 🟡 Medium | Medium | Cut visual cleanup if needed (move to Phase 2) |

**Rollback Plan:**

- Feature flag: `ENABLE_PROGRAM_EDIT` (off by default)
- Can disable edit mode without deployment
- Validation errors don't break viewing experience

---

### Phase 2: Enhancement & Polish (Week 3-4) - 10 days with buffer

**User Value:** Rich interaction and professional appearance

**Features Included:**

- ✅ Image upload with drag-drop (Days 1-3)
- ✅ Tag management with autocomplete (Days 2-4)
- ✅ Like system integration (Days 4-5)
- ✅ Basic comment system (Days 6-8)
- ✅ Responsive design improvements (Days 5-7)
- ✅ Loading skeletons & empty states (Days 8-9)
- ✅ Performance optimization (Day 9)
- ✅ Testing & UAT (Day 10)

**Success Criteria:**

- [ ] Image upload works on mobile and desktop
- [ ] Like count updates instantly (optimistic UI)
- [ ] Users can post and view comments
- [ ] Mobile usability score > 85
- [ ] Lighthouse performance > 90
- [ ] Stakeholders approve for production release

**Dependencies:**

```
Phase 1 Complete & Deployed
        ↓
    ┌───┴───┬───────────┐
    ↓       ↓           ↓
  Image   Tags       Comments
  Upload  (Days 2-4) (Days 6-8)
  (Days 1-3)  ↓
    ↓       Like System
    ↓       (Days 4-5)
    ↓           ↓
  Responsive Design (Days 5-7)
            ↓
    Performance (Day 9)
            ↓
    Testing (Day 10)
```

**Risks & Mitigations:**
| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Image upload complexity | 🟡 Medium | High | Use proven library (react-dropzone) |
| Comment spam/abuse | 🟡 Medium | Medium | Start with authenticated users only |
| Performance degradation | 🔴 High | Low | Monitor bundle size, lazy load heavy components |
| Browser compatibility | 🟡 Medium | Low | Test on Safari, Firefox, Chrome mobile |

**Rollout Strategy:**

1. Deploy to staging with select scout troops (Beta testing)
2. Collect feedback for 3 days
3. Fix critical issues
4. Gradual rollout: 10% → 50% → 100% over 1 week
5. Monitor error rates and performance metrics

---

### Phase 3: Community Features (Week 5-6) - Future Enhancement

**User Value:** Community engagement and discovery

**Features:**

- Threaded comments with replies
- Share to social media
- Improved search and filtering
- User notifications
- Activity feed

**Timeline:** TBD based on Phase 1-2 outcomes

---

## 🔧 Technical Architecture

### Architectural Decisions

#### ADR-001: CSS Modules vs Tailwind

**Decision:** Continue with CSS Modules  
**Rationale:** Already established pattern in codebase, design tokens defined in `slodi-tokens.css`  
**Trade-off:** Slightly more verbose than Tailwind, but better encapsulation

#### ADR-002: State Management

**Decision:** React Context + useState for now  
**Rationale:** Simple enough for current scope, avoid premature optimization  
**Future:** Consider Zustand if state complexity grows

#### ADR-003: Form Handling

**Decision:** React Hook Form + Zod validation  
**Rationale:** Type-safe validation, good DX, standard in Next.js ecosystem  
**Alternative considered:** Formik (older, less TS support)

#### ADR-004: Icon Library

**Decision:** Lucide React  
**Rationale:** Lightweight (tree-shakeable), modern, good Icelandic character support  
**Alternative considered:** Heroicons (Tailwind-native, but we're not using Tailwind)

#### ADR-005: Image Storage

**Decision:** TBD - Requires infrastructure decision  
**Options:**

- Local filesystem (simple, but not scalable)
- S3-compatible storage (scalable, requires setup)
- Cloudinary (easy, but cost implications)

### Performance Targets

| Metric                   | Target  | Current | Action if Missed                     |
| ------------------------ | ------- | ------- | ------------------------------------ |
| Page Load (3G)           | < 3s    | Unknown | Code splitting, image optimization   |
| Time to Interactive      | < 3s    | Unknown | Reduce JS bundle, defer non-critical |
| Edit Save Operation      | < 1s    | N/A     | Optimistic UI, background sync       |
| Lighthouse Performance   | > 90    | Unknown | Performance budget enforcement       |
| Bundle Size (First Load) | < 200kb | Unknown | Analyze with webpack-bundle-analyzer |

### API Contracts

#### GET /programs/{id}

```typescript
Response: ProgramOut {
  id: UUID
  name: string
  description: string | null
  public: boolean
  like_count: number
  created_at: datetime
  author_id: UUID
  author: {  // ← Requires backend update
    id: UUID
    name: string
    email: string
  }
  workspace_id: UUID
  workspace: {  // ← Requires backend update
    id: UUID
    name: string
  }
  image: string | null
  tags: Array<{ id: UUID, name: string }>
  comment_count: number  // ← Requires backend update
}
```

#### PATCH /programs/{id}

```typescript
Request: ProgramUpdate {
  name?: string
  description?: string
  public?: boolean
  image?: string
  tags?: UUID[]
}

Response: ProgramOut (full object)
```

#### POST /programs/{id}/like

```typescript
Request: {} (empty body)
Response: { liked: boolean, like_count: number }
```

---

## ⚠️ Risk Assessment

### High-Impact Risks

#### Risk 1: Backend Team Cannot Update Schema in Timeline

**Impact:** 🔴 Critical - Blocks entire project  
**Likelihood:** Medium (30%)  
**Mitigation:**

- Start conversation immediately
- Have Option B (frontend fetching) fully specced
- If needed, implement Option B in Phase 1, refactor in Phase 2

#### Risk 2: Performance Degrades with Real Data

**Impact:** 🔴 High - Poor user experience  
**Likelihood:** Medium (40%)  
**Mitigation:**

- Load test with 100+ programs
- Implement pagination early
- Set up performance monitoring from Day 1
- Use React.lazy() for heavy components

#### Risk 3: Mobile Experience Breaks Edge Cases

**Impact:** 🟡 Medium - Limits user base  
**Likelihood:** High (60%)  
**Mitigation:**

- Mobile-first development approach
- Test on real devices (not just browser devtools)
- Use touch-friendly UI elements (44px minimum)

### Medium-Impact Risks

#### Risk 4: Scope Creep from Stakeholders

**Impact:** 🟡 Medium - Timeline slip  
**Likelihood:** High (70%)  
**Mitigation:**

- Clear MoSCoW prioritization document
- Weekly check-ins with product owner
- Change request process for any new features

#### Risk 5: Browser Compatibility Issues

**Impact:** 🟡 Medium - Some users affected  
**Likelihood:** Low (20%)  
**Mitigation:**

- Target last 2 versions of major browsers
- Polyfills for critical features
- Graceful degradation for nice-to-haves

---

## 📋 Testing Strategy

### Critical Path Testing (Must Pass Before Deploy)

**User Story:** As a program owner, I can edit my program

1. **Authentication Test**

   - Given I am logged in as the program author
   - When I visit my program page
   - Then I see the "Edit" button

2. **Edit Workflow Test**

   - Given I click "Edit"
   - When I change the name and description
   - And click "Save"
   - Then changes are saved to backend
   - And I see success notification
   - And edit mode closes
   - And I see my changes immediately

3. **Permission Test**

   - Given I am logged in as a different user
   - When I visit someone else's program
   - Then I do NOT see the "Edit" button

4. **Validation Test**
   - Given I am in edit mode
   - When I clear the name field
   - And click "Save"
   - Then I see validation error
   - And changes are NOT saved

### Smoke Tests (Run on Every Deploy)

- [ ] Can load program detail page
- [ ] Can authenticate user
- [ ] Can save edit (happy path)
- [ ] 404 page works for invalid program ID
- [ ] Mobile layout renders correctly

### Regression Tests (Run Weekly)

- All critical path tests
- All smoke tests
- Performance benchmarks
- Accessibility audit (aXe)
- Cross-browser testing

### Testing Tools

- **Unit:** Jest + React Testing Library
- **Integration:** Playwright
- **E2E:** Cypress (if needed)
- **Accessibility:** aXe DevTools
- **Performance:** Lighthouse CI

---

## 🔄 Maintenance & Operations Plan

### Post-Launch Monitoring

#### Week 1-2 After Launch (Intensive Monitoring)

- **Metrics to Watch:**

  - Error rate (target: < 0.1%)
  - Edit save success rate (target: > 95%)
  - Page load time (target: < 2s p95)
  - User engagement (likes, comments)

- **Daily Actions:**
  - Check Sentry for errors
  - Review user feedback
  - Monitor performance dashboards
  - Quick hotfix deployment if needed

#### Week 3+ (Steady State)

- **Weekly Review:**
  - Performance metrics trend
  - User adoption rate
  - Feature usage analytics
  - Backlog prioritization

### Bug Triage Process

| Severity      | Response Time | Examples                                       |
| ------------- | ------------- | ---------------------------------------------- |
| P0 - Critical | < 1 hour      | Cannot save edits, data loss                   |
| P1 - High     | < 1 day       | Edit button not showing, validation broken     |
| P2 - Medium   | < 1 week      | UI glitch, minor formatting issue              |
| P3 - Low      | < 1 month     | Nice-to-have improvement, minor UX enhancement |

### On-Call Rotation

- **Primary:** Frontend lead (Week 1-2 post-launch)
- **Secondary:** Full-stack engineer
- **Escalation:** Tech lead

### User Feedback Loop

1. **Collect:** In-app feedback button, support email, user interviews
2. **Triage:** Product owner reviews weekly
3. **Prioritize:** Against roadmap using MoSCoW
4. **Implement:** Batched in 2-week sprints
5. **Communicate:** Release notes in Icelandic

---

## 📚 Appendices

### Appendix A: Detailed Component Specifications

See separate document: `program-detail-components-spec.md` (to be created)

### Appendix B: API Documentation

See: `api-contracts.md` in backend repository

### Appendix C: Design Mockups

Location: Figma (link TBD)

### Appendix D: Performance Budget

| Resource   | Budget          | Current | Status |
| ---------- | --------------- | ------- | ------ |
| JavaScript | 150kb (gzipped) | TBD     | 🟡     |
| CSS        | 20kb (gzipped)  | TBD     | 🟡     |
| Images     | 500kb total     | TBD     | 🟡     |
| Fonts      | 50kb (woff2)    | TBD     | 🟡     |

### Appendix E: Dependencies to Install

```bash
# Phase 1
npm install lucide-react react-hook-form zod @hookform/resolvers

# Phase 2
npm install react-dropzone date-fns

# Testing
npm install -D @testing-library/react @testing-library/jest-dom \
  @axe-core/react playwright
```

---

## ✅ Pre-Implementation Checklist

Before starting Phase 1:

- [ ] **BLOCKING ISSUE RESOLVED:** Data schema approach decided and communicated
- [ ] **Stakeholder Buy-in:** Product owner approves MVP scope
- [ ] **Team Capacity:** Engineers allocated (Frontend + Backend if needed)
- [ ] **Design Assets:** Icons and visual direction confirmed
- [ ] **Backend Coordination:** If Option A, backend work scheduled
- [ ] **Monitoring Setup:** Error tracking (Sentry) and analytics configured
- [ ] **Feature Flag:** Create `ENABLE_PROGRAM_EDIT` flag in config
- [ ] **Testing Environment:** Staging environment ready with test data
- [ ] **Definition of Done:** All stakeholders agree on success criteria

---

## 📞 Key Contacts & Decision Makers

| Role          | Name | Responsibility                        | Contact |
| ------------- | ---- | ------------------------------------- | ------- |
| Product Owner | TBD  | Final arbiter on scope and priorities | -       |
| Tech Lead     | TBD  | Technical decisions, architecture     | -       |
| Backend Lead  | TBD  | API changes, schema updates           | -       |
| Frontend Lead | TBD  | Implementation, code reviews          | -       |
| Designer      | TBD  | UI/UX, visual direction               | -       |
| QA Lead       | TBD  | Test strategy, acceptance criteria    | -       |

---

## 🔄 Document History

| Date       | Version | Changes                             | Author |
| ---------- | ------- | ----------------------------------- | ------ |
| 2026-01-08 | 2.0     | Major restructure based on feedback | Team   |
| 2026-01-08 | 1.0     | Initial comprehensive plan          | Team   |

---

**Next Steps:**

1. Schedule decision meeting on blocking issue (within 2 days)
2. Assign decision owners and contacts
3. Update this document with decisions made
4. Break down Phase 1 into tickets
5. Start implementation once blocking issue resolved

### 1.1 Implement User Context

- [ ] Integrate with `AuthContext` to get current user
- [ ] Compare `currentUser.id` with `program.author_id` to determine ownership
- [ ] Add permission checks for workspace membership
- [ ] Handle unauthenticated users (read-only access)

### 1.2 Permission Levels

Define three permission tiers:

- **Owner** (author): Full edit rights
- **Workspace Member**: Can view, comment, like
- **Public User**: Can view public programs only

**Files to update:**

- `app/programs/[id]/page.tsx`
- Create: `lib/permissions.ts` (utility functions)

---

## 2. Edit Mode Implementation

### 2.1 Edit Mode Toggle

- [ ] Add "Edit" button (visible only to owner)
- [ ] Toggle between view and edit modes
- [ ] Preserve state when switching modes
- [ ] Add "Save" and "Cancel" buttons in edit mode

### 2.2 Editable Fields

- [ ] Program name (inline editing with validation)
- [ ] Description (rich text editor or textarea)
- [ ] Tags (tag selector with autocomplete)
- [ ] Public/private toggle
- [ ] Image upload/change
- [ ] Location (if applicable)

### 2.3 Form Validation

- [ ] Name: Required, min 3 chars, max 100 chars
- [ ] Description: Optional, max 500 chars
- [ ] Image: File type validation (jpg, png, webp)
- [ ] Image: File size validation (max 5MB)
- [ ] Real-time validation feedback

### 2.4 Save Functionality

- [ ] API call to PATCH `/programs/{id}`
- [ ] Optimistic UI updates
- [ ] Error handling with rollback
- [ ] Success notification
- [ ] Auto-save draft (optional)

**Files to create:**

- `app/programs/[id]/components/ProgramDetailEdit.tsx`
- `app/programs/[id]/components/EditModeToolbar.tsx`

**Files to update:**

- `app/programs/[id]/page.tsx`
- `services/programs.service.ts` (add update function)

---

## 3. Visual Design Improvements

### 3.1 Remove All Emojis

Current emoji usage:

- Replace with proper icons from icon library
- Use semantic HTML elements
- Add proper ARIA labels

**Recommended Icon Library:**

- Lucide React (lightweight, tree-shakeable)
- Heroicons (Tailwind-native)

### 3.2 Typography & Spacing

- [ ] Implement consistent heading hierarchy (h1 → h2 → h3)
- [ ] Use design tokens for spacing (from `slodi-tokens.css`)
- [ ] Improve line height for readability (1.5-1.7 for body text)
- [ ] Add proper text truncation with tooltips
- [ ] Ensure WCAG AA contrast ratios (4.5:1 for text)

### 3.3 Color System

- [ ] Use CSS custom properties from `slodi-tokens.css`
- [ ] Implement semantic color naming:
  - `--color-primary`: Main brand color
  - `--color-secondary`: Accent color
  - `--color-success`: Positive actions
  - `--color-warning`: Caution states
  - `--color-danger`: Destructive actions
  - `--color-text-primary`: Main text
  - `--color-text-secondary`: Muted text
  - `--color-background`: Page background
  - `--color-surface`: Card/panel background
  - `--color-border`: Dividers and borders

### 3.4 Layout Improvements

- [ ] Ensure responsive design (mobile, tablet, desktop)
- [ ] Add max-width containers for readability (65-75ch for text)
- [ ] Implement sticky header for quick actions
- [ ] Add loading skeletons (not just spinners)
- [ ] Improve grid system for sidebar layout

**Files to update:**

- `app/programs/[id]/program-detail.module.css`
- `app/programs/components/ProgramDetailHero.module.css`

---

## 4. Component Refactoring

### 4.1 ProgramDetailHero

**Current Issues:**

- Static action buttons
- No conditional rendering based on permissions
- Missing author information display

**Improvements:**

- [ ] Display author name and avatar (fetch from author_id if needed)
- [ ] Show creation/update timestamps
- [ ] Conditional action buttons based on auth state
- [ ] Add "Edit" button for owners
- [ ] Improve like button interaction (disable when not authenticated)
- [ ] Add share functionality with copy-to-clipboard fallback

**File:** `app/programs/components/ProgramDetailHero.tsx`

### 4.2 ProgramDetailTabs

**Current Issues:**

- Limited tab functionality
- Missing content sections

**Improvements:**

- [ ] **Overview Tab**: Full description with markdown support
- [ ] **Events Tab**: List all events in this program
- [ ] **Activity Tab**: Comments, likes, recent changes
- [ ] **Settings Tab**: Only visible to owner (edit, delete, privacy)
- [ ] Add URL hash navigation (#overview, #events, etc.)
- [ ] Keyboard navigation support

**File:** `app/programs/components/ProgramDetailTabs.tsx`

### 4.3 ProgramQuickInfo

**Current Issues:**

- Static display
- No interactive elements

**Improvements:**

- [ ] Display workspace name (fetch from workspace_id if needed)
- [ ] Show event count with link to events
- [ ] Display like count with icon
- [ ] Show comment count
- [ ] Add "Created" and "Last Updated" dates
- [ ] Show public/private status badge
- [ ] Tags as clickable filter links

**File:** `app/programs/components/ProgramQuickInfo.tsx`

---

## 5. Interactive Features

### 5.1 Like System

- [ ] Integrate with backend API endpoint: `POST /programs/{id}/like`
- [ ] Show current like state (liked by current user)
- [ ] Optimistic UI update
- [ ] Error handling
- [ ] Disable for unauthenticated users with tooltip

**Files to create:**

- `hooks/useLikes.ts`

**Files to update:**

- `app/programs/[id]/page.tsx`
- `services/programs.service.ts`

### 5.2 Comment System

- [ ] Display existing comments
- [ ] Add comment input (authenticated users only)
- [ ] Real-time comment updates (optional: websockets)
- [ ] Edit/delete own comments
- [ ] Reply to comments (threaded)
- [ ] Pagination for comments (load more)

**Files to create:**

- `app/programs/components/CommentSection.tsx`
- `app/programs/components/CommentItem.tsx`
- `app/programs/components/CommentInput.tsx`
- `services/comments.service.ts`
- `hooks/useComments.ts`

### 5.3 Share Functionality

- [ ] Native share API for mobile
- [ ] Copy link to clipboard fallback
- [ ] Social media share buttons (optional)
- [ ] Generate shareable preview card (Open Graph tags)

---

## 6. Error Handling & Edge Cases

### 6.1 Error States

- [ ] Program not found (404)
- [ ] No permission to view (403)
- [ ] Server error (500)
- [ ] Network error (offline)
- [ ] Custom error messages in Icelandic

### 6.2 Loading States

- [ ] Initial page load skeleton
- [ ] Action loading states (saving, liking, etc.)
- [ ] Progressive image loading with blur-up
- [ ] Optimistic UI updates

### 6.3 Empty States

- [ ] No events yet
- [ ] No comments yet
- [ ] No tags assigned
- [ ] No image uploaded

**Files to create:**

- `components/ErrorState.tsx`
- `components/EmptyState.tsx`
- `components/LoadingSkeleton.tsx`

---

## 7. Image Handling

### 7.1 Image Display

- [ ] Responsive image sizing
- [ ] Lazy loading with intersection observer
- [ ] Blur placeholder while loading
- [ ] Fallback placeholder for missing images
- [ ] Lightbox/modal for full-size view

### 7.2 Image Upload (Edit Mode)

- [ ] Drag-and-drop upload
- [ ] File input fallback
- [ ] Image preview before upload
- [ ] Crop/resize functionality (optional)
- [ ] Upload progress indicator
- [ ] Compression before upload

**Files to create:**

- `components/ImageUpload.tsx`
- `lib/image-utils.ts`

---

## 8. Accessibility (a11y)

### 8.1 ARIA Labels

- [ ] Add proper ARIA labels to all interactive elements
- [ ] Use semantic HTML (`<nav>`, `<main>`, `<aside>`)
- [ ] Add `role` attributes where needed
- [ ] Ensure form inputs have associated labels

### 8.2 Keyboard Navigation

- [ ] Tab order follows visual order
- [ ] All actions accessible via keyboard
- [ ] Escape key closes modals/dropdowns
- [ ] Focus indicators visible and clear
- [ ] Skip to content link

### 8.3 Screen Reader Support

- [ ] Announce state changes (saving, saved, error)
- [ ] Provide context for icon-only buttons
- [ ] Use `aria-live` regions for dynamic content
- [ ] Test with NVDA/JAWS/VoiceOver

---

## 9. Performance Optimization

### 9.1 Code Splitting

- [ ] Lazy load edit mode components
- [ ] Lazy load comment section
- [ ] Dynamic imports for heavy dependencies

### 9.2 Data Fetching

- [ ] Implement SWR or React Query for caching
- [ ] Prefetch related data (events, comments)
- [ ] Implement pagination for large datasets
- [ ] Debounce search/filter inputs

### 9.3 Image Optimization

- [ ] Use Next.js Image component
- [ ] Serve WebP with JPEG fallback
- [ ] Implement responsive images (`srcset`)
- [ ] CDN integration for image hosting

---

## 10. Testing Strategy

### 10.1 Unit Tests

- [ ] Test permission utilities
- [ ] Test form validation logic
- [ ] Test data transformation functions
- [ ] Test custom hooks

### 10.2 Integration Tests

- [ ] Test edit workflow
- [ ] Test like/unlike flow
- [ ] Test comment CRUD operations
- [ ] Test authentication flows

### 10.3 E2E Tests (Playwright/Cypress)

- [ ] Owner can edit their program
- [ ] Non-owner cannot see edit button
- [ ] Public users can view public programs
- [ ] Like system works correctly
- [ ] Comment system works correctly

**Files to create:**

- `app/programs/[id]/__tests__/page.test.tsx`
- `app/programs/[id]/__tests__/edit-mode.test.tsx`

---

## 11. Internationalization (i18n)

### 11.1 Text Content

- [ ] Extract all hardcoded strings
- [ ] Create Icelandic translation file
- [ ] Use i18n library (next-intl or react-i18next)
- [ ] Format dates using Icelandic locale
- [ ] Handle pluralization correctly

**Files to create:**

- `locales/is/program-detail.json`

---

## 12. SEO & Metadata

### 12.1 Meta Tags

- [ ] Dynamic page title: `{program.name} - Slóði`
- [ ] Meta description from program description
- [ ] Open Graph tags for social sharing
- [ ] Twitter Card metadata
- [ ] Canonical URL

### 12.2 Structured Data

- [ ] JSON-LD schema for Event/Program
- [ ] Breadcrumb structured data
- [ ] Author structured data

**File to update:**

- `app/programs/[id]/page.tsx` (add `generateMetadata` export)

---

## Implementation Priority

### Phase 0: Data Alignment (Critical First Step)

**Must resolve backend/frontend schema mismatch**

- [ ] Decision: Update backend to include nested objects OR update frontend to fetch separately
- [ ] If backend: Add `UserNested`, `WorkspaceNested` schemas and update queries
- [ ] If frontend: Create utility functions to fetch author/workspace data by ID
- [ ] Add `comment_count` to backend response (computed property)

### Phase 1: Critical (Week 1)

1. Resolve data alignment issue
2. Implement authentication context
3. Add permission checks
4. Remove emojis and improve visual design
5. Basic edit mode implementation

### Phase 2: Core Features (Week 2)

1. Complete edit form with validation
2. Image upload functionality
3. Like system integration
4. Error handling and loading states
5. Responsive design improvements

### Phase 3: Enhanced UX (Week 3)

1. Comment system
2. Tab navigation with content
3. Share functionality
4. Empty states and error messages
5. Accessibility improvements

### Phase 4: Polish (Week 4)

1. Performance optimization
2. Testing (unit + integration)
3. SEO and metadata
4. i18n implementation
5. Final UI polish

---

## Technical Debt to Address

### Current Issues in Codebase

1. **Backend/Frontend schema mismatch**: Frontend expects nested objects not provided
2. **Mixing client and server components**: Ensure proper use of "use client"
3. **Direct state management**: Consider Zustand or Context API for complex state
4. **No API error handling strategy**: Implement consistent error handling
5. **CSS modules scattered**: Consider consolidating styles
6. **No component documentation**: Add JSDoc comments
7. **Missing TypeScript strict mode**: Enable and fix type errors

### Refactoring Opportunities

- Extract common UI components (Button, Card, Badge, etc.)
- Create a design system package
- Implement compound component pattern for complex UIs
- Use composition over prop drilling

---

## Success Metrics

### User Experience

- [ ] Page load time < 2 seconds
- [ ] Time to interactive < 3 seconds
- [ ] Lighthouse score > 90
- [ ] Zero console errors/warnings

### Functionality

- [ ] All edit operations complete in < 1 second
- [ ] 100% of owner actions work correctly
- [ ] Mobile usability score > 85
- [ ] Accessibility score (aXe) passes with 0 violations

### Code Quality

- [ ] Test coverage > 80%
- [ ] No ESLint errors
- [ ] TypeScript strict mode enabled
- [ ] All components documented

---

## Resources & Dependencies

### NPM Packages to Install

```bash
# Icons
npm install lucide-react

# Forms
npm install react-hook-form zod @hookform/resolvers

# Rich Text (if needed)
npm install @tiptap/react @tiptap/starter-kit

# Image handling
npm install react-dropzone

# Dates
npm install date-fns

# Testing
npm install -D @testing-library/react @testing-library/jest-dom
```

### Design Resources

- [Slóði Design Tokens](../../frontend/app/slodi-tokens.css)
- [Icelandic Design Guidelines](https://www.stjornarradid.is/verkefni/upplysingathroun/stafraent-islands/)

---

## Questions to Resolve

1. **Backend Schema**: Should we add nested objects to backend or fetch separately in frontend?
2. **Image Storage**: Where should program images be stored? (S3, Cloudinary, local)
3. **Rich Text**: Do we need markdown or WYSIWYG editor for descriptions?
4. **Real-time Updates**: Should we use WebSockets for live updates (comments, likes)?
5. **Versioning**: Should we track version history of edits?
6. **Moderation**: Do we need content moderation for comments/programs?
7. **Analytics**: What user interactions should we track?

---

## Notes

- All user-facing text should be in Icelandic
- Follow existing design token system in `slodi-tokens.css`
- Maintain consistency with other pages (dashboard, program list)
- Consider mobile-first approach for all features
- Test on real devices, not just browser dev tools
- **Priority:** Resolve backend/frontend data mismatch before starting Phase 1

---

**Last Updated:** 2026-01-08  
**Document Owner:** Development Team  
**Status:** Living Document
