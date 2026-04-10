# Settings Page - Design & Implementation Plan

## Overview

The Settings page is where users manage their personal preferences, account information, workspace settings, and application behavior. This document outlines the structure and implementation approach for a comprehensive settings experience.

## Current State

The settings page currently shows:

- User account information (avatar, name, email)
- Basic actions (logout, return to home)
- Admin-only email list download

## Proposed Settings Structure

### 1. Account Section

**Purpose**: Manage user identity and authentication

#### Settings:

- **Profile Information** (Read-only from Auth0)
  - Avatar/Profile Picture
  - Display Name
  - Email Address
  - User ID (for debugging)
- **Account Actions**
  - Logout button
  - Delete Account (future - requires backend endpoint)

**Implementation**:

- Current implementation is sufficient
- Display Auth0 profile data as-is
- Add visual indicator for Auth0-managed fields

---

### 2. Appearance & Theme Section

**Purpose**: Customize visual experience

#### Settings:

- **Theme Mode**
  - Light mode
  - Dark mode
  - System preference (auto-switch based on OS)
- **Color Accent** (future enhancement)
  - Choose primary color from predefined palette
  - Preview changes in real-time

**Implementation**:

```typescript
// Storage: localStorage
interface ThemeSettings {
  mode: "light" | "dark" | "system";
  accentColor?: string; // future
}
```

**Technical Details**:

- Use existing `ThemeProvider` context
- Store preference in `localStorage` with key `slodi-theme-settings`
- Apply CSS variables dynamically
- Sync with system preference using `prefers-color-scheme` media query

---

### 3. Notifications & Alerts Section

**Purpose**: Control communication preferences

#### Settings:

- **Email Notifications**
  - Program updates in your workspaces
  - Comments on your programs
  - @mentions in comments
  - Weekly digest
- **In-App Notifications** (future - requires notification system)
  - Real-time alerts
  - Notification sound

**Implementation**:

```typescript
// Storage: Backend database + localStorage cache
interface NotificationSettings {
  emailProgramUpdates: boolean;
  emailComments: boolean;
  emailMentions: boolean;
  emailWeeklyDigest: boolean;
  inAppEnabled: boolean; // future
  soundEnabled: boolean; // future
}
```

**Technical Details**:

- POST to `/api/users/me/notification-settings`
- Cache locally for instant UI updates
- Add unsubscribe token to all emails (already implemented)
- Validate email preferences against user's verified email

---

### 4. Workspace Preferences Section

**Purpose**: Configure default workspace behavior

#### Settings:

- **Default Workspace**
  - Select which workspace to open on login
  - Option: "Remember last visited"
- **Default View**
  - Dashboard
  - Program Bank
  - Planner (future)
- **Language & Region** (future)
  - Interface language (Íslenska/English)
  - Date format (DD.MM.YYYY / MM/DD/YYYY)
  - Week starts on (Monday/Sunday)

**Implementation**:

```typescript
// Storage: localStorage + optional backend sync
interface WorkspacePreferences {
  defaultWorkspaceId: string | null;
  rememberLastVisited: boolean;
  defaultView: "dashboard" | "programs" | "planner";
  language: "is" | "en"; // future
  dateFormat: "DMY" | "MDY"; // future
  weekStartsOn: 0 | 1; // 0=Sunday, 1=Monday
}
```

**Technical Details**:

- Store in `localStorage` for instant access
- Optionally sync to backend for cross-device consistency
- Check permissions before applying workspace defaults

---

### 5. Privacy & Data Section

**Purpose**: Control data visibility and exports

#### Settings:

- **Profile Visibility**
  - Show profile to workspace members
  - Show activity history to workspace members
- **Data Export**
  - Download your programs (JSON)
  - Download your activity log (CSV)
  - Request full data export (GDPR compliance)
- **Data Deletion**
  - Delete all your programs
  - Delete your account

**Implementation**:

```typescript
// Storage: Backend database
interface PrivacySettings {
  profileVisibleToWorkspace: boolean;
  activityHistoryVisible: boolean;
}
```

**Technical Details**:

- All privacy settings stored in backend
- Data export generates files on-demand via API endpoints
- Account deletion requires confirmation modal with password/re-auth
- Implement soft-delete with 30-day grace period

---

### 6. Admin Settings Section

**Purpose**: Workspace and group management (role-restricted)

#### Settings (visible only to workspace/group owners):

- **Email List Management**
  - Download workspace email list (already implemented)
  - Export member list with roles
- **Workspace Analytics** (future)
  - View workspace activity statistics
  - Export analytics reports

**Implementation**:

- Current email download feature stays as-is
- Add permission checks: `user.role === 'owner' || user.role === 'admin'`
- Link to full admin dashboard for advanced management

---

## UI/UX Design Principles

### Layout Structure

```
┌─────────────────────────────────────┐
│  Stillingar (Settings)              │
├─────────────────────────────────────┤
│                                     │
│  [Tab Navigation]                   │
│  Aðgangur | Útlit | Tilkynningar   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Section Title               │   │
│  │                             │   │
│  │ [Setting Card]              │   │
│  │ Label         [Control]     │   │
│  │ Description text            │   │
│  │                             │   │
│  │ [Setting Card]              │   │
│  │ ...                         │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Save Changes Button]              │
└─────────────────────────────────────┘
```

### Component Structure

- Use tabbed interface for major sections
- Group related settings in cards (similar to current implementation)
- Each setting row: Label + Control + Optional description
- Show save status: "Saved" / "Saving..." / "Error"
- Auto-save for non-critical settings
- Require "Save Changes" button for critical settings

### Design Tokens

- Follow existing Slóði design system
- Use `slodi-tokens.css` variables
- Maintain accessibility (ARIA labels, keyboard navigation)
- Mobile-responsive with stacked layout on small screens

---

## Implementation Phases

### Phase 1: Essential Settings (MVP)

**Timeline**: Immediate

- [x] Account information display (already done)
- [x] Theme toggle (Light/Dark/System)
- [x] Logout functionality (already done)

### Phase 2: User Preferences

**Timeline**: Sprint 2

- [ ] Email notification preferences
- [ ] Default workspace selection
- [ ] Default view preference

### Phase 3: Privacy & Data

**Timeline**: Sprint 3

- [ ] Profile visibility controls
- [ ] Data export (programs JSON)
- [ ] Account deletion flow

### Phase 4: Advanced Features

**Timeline**: Future

- [ ] Color accent customization
- [ ] Language selection
- [ ] In-app notifications
- [ ] Admin analytics dashboard

---

## API Endpoints Needed

### GET `/api/users/me/settings`

Returns all user settings (merged from backend + defaults)

**Response**:

```typescript
{
  theme: { mode: 'system' },
  notifications: {
    emailProgramUpdates: true,
    emailComments: true,
    emailMentions: true,
    emailWeeklyDigest: false
  },
  workspace: {
    defaultWorkspaceId: null,
    rememberLastVisited: true,
    defaultView: 'dashboard'
  },
  privacy: {
    profileVisibleToWorkspace: true,
    activityHistoryVisible: true
  }
}
```

### PATCH `/api/users/me/settings`

Update user settings (partial updates allowed)

**Request Body**:

```typescript
{
  notifications?: Partial<NotificationSettings>,
  workspace?: Partial<WorkspacePreferences>,
  privacy?: Partial<PrivacySettings>
}
```

### POST `/api/users/me/export`

Generate data export package

**Request Body**:

```typescript
{
  exportType: "programs" | "activity" | "full";
}
```

**Response**: File download or job ID for async processing

### DELETE `/api/users/me`

Delete user account (requires confirmation)

**Request Body**:

```typescript
{
  confirmation: 'DELETE',
  password?: string // if required
}
```

---

## Technical Considerations

### State Management

- Use React Context for theme state (already exists)
- Consider SWR for fetching/caching settings
- Optimistic updates for better UX

### Form Handling

- Use controlled components
- Debounce auto-save to reduce API calls
- Show visual feedback for all state changes

### Error Handling

- Toast notifications for save errors
- Inline validation for inputs
- Graceful degradation if backend unavailable

### Performance

- Lazy load admin sections
- Code-split by tab to reduce initial bundle
- Cache settings in localStorage as fallback

### Accessibility

- Keyboard navigation between settings
- Screen reader announcements for state changes
- Sufficient color contrast in all themes
- Focus management in modal dialogs

---

## Open Questions

1. Should theme preference be synced across devices via backend?
2. Do we need granular email notification controls, or just on/off?
3. Should workspace defaults override user preferences?
4. What's the data retention policy for deleted accounts?
5. Should we support exporting data in multiple formats (JSON, CSV, PDF)?

---

## Related Documents

- [Functional Requirements](../functional_requirements.md) - Section 4.1 (Authentication and Accounts)
- [Design Token Standards](./DESIGN-TOKEN-STANDARDS.md) - For consistent styling
- [User Interaction Flow](./user-interaction-flow.md) - Authentication and session management
