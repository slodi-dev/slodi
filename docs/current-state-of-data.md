# Current State of Data - Database Architecture

**Generated:** January 5, 2026  
**Database:** PostgreSQL  
**ORM:** SQLAlchemy 2.x  
**Migration Tool:** Alembic

## Executive Summary

The Slodi backend uses a relational database schema centered around a **content hierarchy** (programs, events, tasks) with support for workspaces, groups, user management, and collaborative features. The architecture employs **single table inheritance** for content types and **many-to-many relationships** for memberships and tagging.

---

## Database Schema Overview

### Core Entities

1. **Users** - Authentication and user profiles
2. **Groups** - Organizational units for users
3. **Workspaces** - Main containers for programs and events
4. **Content** (Abstract) - Base for programs, events, and tasks
5. **Programs** - Structured activity plans
6. **Events** - Scheduled occurrences with time/location
7. **Tasks** - Action items within events
8. **Troops** - Participant groups
9. **Tags** - Content categorization
10. **Comments** - User feedback on content
11. **Email List** - Marketing/notification list

---

## Detailed Entity Specifications

### 1. Users Table

**Purpose:** Core user identity and authentication

| Column        | Type         | Constraints                  | Description                                                     |
| ------------- | ------------ | ---------------------------- | --------------------------------------------------------------- |
| `id`          | UUID         | PRIMARY KEY                  | Unique user identifier                                          |
| `auth0_id`    | VARCHAR(255) | UNIQUE, NOT NULL, INDEXED    | Auth0 authentication ID                                         |
| `name`        | VARCHAR(100) | NOT NULL, CHECK (length ≥ 1) | Display name                                                    |
| `pronouns`    | ENUM         | NULL                         | Pronouns (she/her, he/him, they/them, other, prefer not to say) |
| `email`       | VARCHAR(320) | UNIQUE, NOT NULL, INDEXED    | Email address (normalized to lowercase)                         |
| `preferences` | JSONB        | NULL                         | User preferences storage                                        |

**Relationships:**

- **One-to-Many:** `workspace_memberships` (user can be in multiple workspaces)
- **One-to-Many:** `group_memberships` (user can be in multiple groups)
- **One-to-Many:** `authored_content` (user authors multiple content items)
- **One-to-Many:** `comments` (user writes multiple comments)

**Indexes:**

- `ix_users_auth0_id` on `auth0_id`
- `ix_users_email` on `email`

**Domain Constraints:**

- Name: 1-100 characters
- Auth0 ID: 1-255 characters
- Email: max 320 characters (RFC 5321 compliant)

---

### 2. Groups Table

**Purpose:** Organizational units for users (e.g., scout troops, organizations)

| Column  | Type         | Constraints                  | Description             |
| ------- | ------------ | ---------------------------- | ----------------------- |
| `id`    | UUID         | PRIMARY KEY                  | Unique group identifier |
| `name`  | VARCHAR(100) | NOT NULL, CHECK (length ≥ 1) | Group name              |
| `image` | VARCHAR(255) | NULL                         | Group image URL/path    |

**Relationships:**

- **One-to-Many:** `group_memberships` (group has multiple members)
- **One-to-Many:** `workspaces` (group can own multiple workspaces)

**Domain Constraints:**

- Name: 1-100 characters
- Image: max 255 characters

---

### 3. Group Memberships Table (Join Table)

**Purpose:** Many-to-many relationship between users and groups with roles

| Column     | Type | Constraints                                           | Description                         |
| ---------- | ---- | ----------------------------------------------------- | ----------------------------------- |
| `user_id`  | UUID | PRIMARY KEY, FOREIGN KEY → users.id (CASCADE DELETE)  | User reference                      |
| `group_id` | UUID | PRIMARY KEY, FOREIGN KEY → groups.id (CASCADE DELETE) | Group reference                     |
| `role`     | ENUM | NOT NULL                                              | Role (owner, admin, editor, viewer) |

**Composite Primary Key:** (`user_id`, `group_id`)

**Cascade Behavior:**

- Delete group → delete all memberships
- Delete user → delete all memberships

---

### 4. Workspaces Table

**Purpose:** Main container for programs, events, and troops. Represents a season or organizational unit.

| Column                    | Type         | Constraints                   | Description                                                    |
| ------------------------- | ------------ | ----------------------------- | -------------------------------------------------------------- |
| `id`                      | UUID         | PRIMARY KEY                   | Unique workspace identifier                                    |
| `name`                    | VARCHAR(100) | NOT NULL, CHECK (length ≥ 1)  | Workspace name                                                 |
| `default_meeting_weekday` | ENUM         | NOT NULL                      | Default meeting day (monday-sunday, unknown)                   |
| `default_start_time`      | TIME         | NOT NULL                      | Default meeting start time                                     |
| `default_end_time`        | TIME         | NOT NULL                      | Default meeting end time                                       |
| `default_interval`        | ENUM         | NOT NULL                      | Meeting frequency (weekly, biweekly, monthly, yearly, unknown) |
| `season_start`            | DATE         | NOT NULL                      | Season start date                                              |
| `settings`                | JSONB        | NULL                          | Workspace settings                                             |
| `group_id`                | UUID         | NULL, FOREIGN KEY → groups.id | Owning group (optional)                                        |

**Relationships:**

- **One-to-Many:** `workspace_memberships` (workspace has multiple members)
- **One-to-Many:** `programs` (workspace contains multiple programs)
- **One-to-Many:** `events` (workspace contains multiple events)
- **One-to-Many:** `troops` (workspace contains multiple troops)
- **Many-to-One:** `group` (workspace belongs to one group)

**Cascade Behavior:**

- Delete workspace → delete all programs, events, troops, and memberships

---

### 5. Workspace Memberships Table (Join Table)

**Purpose:** Many-to-many relationship between users and workspaces with roles

| Column         | Type | Constraints                                               | Description                         |
| -------------- | ---- | --------------------------------------------------------- | ----------------------------------- |
| `workspace_id` | UUID | PRIMARY KEY, FOREIGN KEY → workspaces.id (CASCADE DELETE) | Workspace reference                 |
| `user_id`      | UUID | PRIMARY KEY, FOREIGN KEY → users.id (CASCADE DELETE)      | User reference                      |
| `role`         | ENUM | NOT NULL, DEFAULT viewer                                  | Role (owner, admin, editor, viewer) |

**Composite Primary Key:** (`workspace_id`, `user_id`)

**Cascade Behavior:**

- Delete workspace → delete all memberships
- Delete user → delete all memberships

---

### 6. Content Table (Single Table Inheritance)

**Purpose:** Abstract base for all content types (programs, events, tasks)

| Column         | Type                    | Constraints                      | Description                          |
| -------------- | ----------------------- | -------------------------------- | ------------------------------------ |
| `id`           | UUID                    | PRIMARY KEY                      | Unique content identifier            |
| `content_type` | ENUM                    | NOT NULL                         | Discriminator (program, event, task) |
| `name`         | VARCHAR(100)            | NOT NULL, CHECK (length ≥ 1)     | Content name                         |
| `description`  | VARCHAR(1000)           | NULL                             | Content description                  |
| `public`       | BOOLEAN                 | NOT NULL                         | Public visibility flag               |
| `like_count`   | INTEGER                 | NOT NULL, CHECK (≥ 0)            | Number of likes                      |
| `created_at`   | TIMESTAMP WITH TIMEZONE | NOT NULL                         | Creation timestamp                   |
| `author_id`    | UUID                    | NOT NULL, FOREIGN KEY → users.id | Content author                       |

**Relationships:**

- **Many-to-One:** `author` (content authored by one user)
- **One-to-Many:** `comments` (content has multiple comments)
- **One-to-Many:** `content_tags` (content has multiple tags)

**Inheritance Pattern:**

- **Single Table Inheritance** using `content_type` discriminator
- Subtypes: `Program`, `Event`, `Task`

**Domain Constraints:**

- Name: 1-100 characters
- Description: max 1000 characters
- Like count: non-negative

---

### 7. Programs Table (Extends Content)

**Purpose:** Structured activity plans or curricula

| Column         | Type         | Constraints                                            | Description            |
| -------------- | ------------ | ------------------------------------------------------ | ---------------------- |
| `id`           | UUID         | PRIMARY KEY, FOREIGN KEY → content.id (CASCADE DELETE) | Inherits from content  |
| `image`        | VARCHAR(255) | NULL                                                   | Program image URL/path |
| `workspace_id` | UUID         | NOT NULL, FOREIGN KEY → workspaces.id (CASCADE DELETE) | Parent workspace       |

**Unique Constraint:** (`workspace_id`, `id`)

**Relationships:**

- **Inherits:** All content relationships
- **Many-to-One:** `workspace` (program belongs to one workspace)
- **One-to-Many:** `events` (program contains multiple events)

**Cascade Behavior:**

- Delete workspace → delete all programs
- Delete program → delete all related events

---

### 8. Events Table (Extends Content)

**Purpose:** Scheduled occurrences with time and location

| Column         | Type                    | Constraints                                            | Description               |
| -------------- | ----------------------- | ------------------------------------------------------ | ------------------------- |
| `id`           | UUID                    | PRIMARY KEY, FOREIGN KEY → content.id (CASCADE DELETE) | Inherits from content     |
| `start_dt`     | TIMESTAMP WITH TIMEZONE | NOT NULL                                               | Event start datetime      |
| `end_dt`       | TIMESTAMP WITH TIMEZONE | NULL                                                   | Event end datetime        |
| `location`     | VARCHAR(255)            | NULL                                                   | Event location            |
| `workspace_id` | UUID                    | NOT NULL, FOREIGN KEY → workspaces.id (RESTRICT)       | Parent workspace          |
| `program_id`   | UUID                    | NULL, FOREIGN KEY → programs.id                        | Parent program (optional) |

**Special Constraints:**

- **Composite Foreign Key:** (`workspace_id`, `program_id`) → (`programs.workspace_id`, `programs.id`)
- Ensures event and program belong to same workspace
- Foreign key is DEFERRABLE, INITIALLY DEFERRED

**Relationships:**

- **Inherits:** All content relationships
- **Many-to-One:** `workspace` (event belongs to one workspace)
- **Many-to-One:** `program` (event belongs to one program, optional)
- **One-to-Many:** `tasks` (event contains multiple tasks)
- **One-to-Many:** `troop_participations` (event has multiple troop participants)

**Cascade Behavior:**

- Delete workspace → RESTRICT (cannot delete workspace with events)
- Delete event → delete all tasks
- Delete program → RESTRICT (cannot delete program with events)

**Domain Constraints:**

- Location: max 255 characters

---

### 9. Tasks Table (Extends Content)

**Purpose:** Action items or activities within an event

| Column               | Type    | Constraints                                            | Description            |
| -------------------- | ------- | ------------------------------------------------------ | ---------------------- |
| `id`                 | UUID    | PRIMARY KEY, FOREIGN KEY → content.id (CASCADE DELETE) | Inherits from content  |
| `equipment`          | JSONB   | NULL                                                   | Equipment requirements |
| `media`              | JSONB   | NULL                                                   | Media attachments      |
| `event_id`           | UUID    | NOT NULL, FOREIGN KEY → events.id (CASCADE DELETE)     | Parent event           |
| `estimated_duration` | INTEGER | NULL                                                   | Duration in minutes    |
| `participant_min`    | INTEGER | NULL                                                   | Minimum participants   |
| `participant_max`    | INTEGER | NULL                                                   | Maximum participants   |

**Relationships:**

- **Inherits:** All content relationships
- **Many-to-One:** `event` (task belongs to one event)

**Cascade Behavior:**

- Delete event → delete all tasks

---

### 10. Troops Table

**Purpose:** Groups of participants (e.g., patrols, teams)

| Column         | Type         | Constraints                                            | Description             |
| -------------- | ------------ | ------------------------------------------------------ | ----------------------- |
| `id`           | UUID         | PRIMARY KEY                                            | Unique troop identifier |
| `name`         | VARCHAR(100) | NOT NULL                                               | Troop name              |
| `workspace_id` | UUID         | NOT NULL, FOREIGN KEY → workspaces.id (CASCADE DELETE) | Parent workspace        |

**Relationships:**

- **Many-to-One:** `workspace` (troop belongs to one workspace)
- **One-to-Many:** `troop_participations` (troop participates in multiple events)

**Cascade Behavior:**

- Delete workspace → delete all troops
- Delete troop → delete all participations

---

### 11. Troop Participation Table (Join Table)

**Purpose:** Many-to-many relationship between troops and events

| Column     | Type | Constraints                                           | Description     |
| ---------- | ---- | ----------------------------------------------------- | --------------- |
| `troop_id` | UUID | PRIMARY KEY, FOREIGN KEY → troops.id (CASCADE DELETE) | Troop reference |
| `event_id` | UUID | PRIMARY KEY, FOREIGN KEY → events.id (CASCADE DELETE) | Event reference |

**Composite Primary Key:** (`troop_id`, `event_id`)

**Cascade Behavior:**

- Delete troop → delete all participations
- Delete event → delete all participations

---

### 12. Tags Table

**Purpose:** Content categorization and filtering

| Column | Type        | Constraints                          | Description           |
| ------ | ----------- | ------------------------------------ | --------------------- |
| `id`   | UUID        | PRIMARY KEY                          | Unique tag identifier |
| `name` | VARCHAR(50) | NOT NULL, UNIQUE, CHECK (length ≥ 1) | Tag name              |

**Relationships:**

- **One-to-Many:** `content_tags` (tag applied to multiple content items)

**Domain Constraints:**

- Name: 1-50 characters, globally unique

---

### 13. Content Tags Table (Join Table)

**Purpose:** Many-to-many relationship between content and tags

| Column       | Type | Constraints                                            | Description       |
| ------------ | ---- | ------------------------------------------------------ | ----------------- |
| `content_id` | UUID | PRIMARY KEY, FOREIGN KEY → content.id (CASCADE DELETE) | Content reference |
| `tag_id`     | UUID | PRIMARY KEY, FOREIGN KEY → tags.id (CASCADE DELETE)    | Tag reference     |

**Composite Primary Key:** (`content_id`, `tag_id`)

**Cascade Behavior:**

- Delete content → delete all tag associations
- Delete tag → delete all content associations

---

### 14. Comments Table

**Purpose:** User feedback and discussions on content

| Column       | Type                    | Constraints                                         | Description               |
| ------------ | ----------------------- | --------------------------------------------------- | ------------------------- |
| `id`         | UUID                    | PRIMARY KEY                                         | Unique comment identifier |
| `body`       | VARCHAR(5000)           | NOT NULL, CHECK (length ≥ 1)                        | Comment text              |
| `created_at` | TIMESTAMP WITH TIMEZONE | NOT NULL                                            | Creation timestamp        |
| `user_id`    | UUID                    | NOT NULL, FOREIGN KEY → users.id                    | Comment author            |
| `content_id` | UUID                    | NOT NULL, FOREIGN KEY → content.id (CASCADE DELETE) | Target content            |

**Relationships:**

- **Many-to-One:** `user` (comment written by one user)
- **Many-to-One:** `content` (comment on one content item)

**Indexes:**

- `ix_comments_content_id_created_at` on (`content_id`, `created_at`)
- `ix_comments_user_id_created_at` on (`user_id`, `created_at`)

**Cascade Behavior:**

- Delete content → delete all comments

**Domain Constraints:**

- Body: 1-5000 characters

---

### 15. Email List Table

**Purpose:** Marketing and notification subscription list

| Column  | Type         | Constraints         | Description   |
| ------- | ------------ | ------------------- | ------------- |
| `email` | VARCHAR(320) | PRIMARY KEY, UNIQUE | Email address |

**Note:** Simple standalone table with no relationships

---

## Entity Relationship Diagram

``` text
┌─────────────┐
│   USERS     │
└─────────────┘
      │
      ├───────────────┐
      │               │
      ▼               ▼
┌─────────────┐ ┌─────────────┐
│   GROUP     │ │  WORKSPACE  │
│ MEMBERSHIPS │ │ MEMBERSHIPS │
└─────────────┘ └─────────────┘
      │               │
      ▼               ▼
┌─────────────┐ ┌─────────────┐
│   GROUPS    │ │ WORKSPACES  │◄───┐
└─────────────┘ └─────────────┘    │
      │               │             │
      └───────────────┤             │
                      ▼             │
            ┌───────────────┐       │
            │   PROGRAMS    │       │
            └───────────────┘       │
                      │             │
                      ▼             │
            ┌───────────────┐       │
            │    EVENTS     │◄──────┤
            └───────────────┘       │
                      │             │
            ┌─────────┴─────────┐   │
            │                   │   │
            ▼                   ▼   │
      ┌──────────┐        ┌─────────────┐
      │  TASKS   │        │   TROOP     │
      └──────────┘        │PARTICIPATION│
                          └─────────────┘
                                │
                                ▼
                          ┌─────────────┐
                          │   TROOPS    │
                          └─────────────┘

      ┌─────────────┐
      │   CONTENT   │◄──────┐
      │  (Abstract) │       │
      └─────────────┘       │
            │               │
            ├───────────────┼───────────┐
            │               │           │
            ▼               │           │
      ┌──────────┐          │           │
      │ COMMENTS │          │           │
      └──────────┘          │           │
                            │           │
                            ▼           ▼
                      ┌─────────┐ ┌─────────┐
                      │CONTENT  │ │  TAGS   │
                      │  TAGS   │ └─────────┘
                      └─────────┘

      ┌─────────────┐
      │ EMAIL LIST  │  (standalone)
      └─────────────┘
```

---

## Key Design Patterns

### 1. Single Table Inheritance (Content)

All content types (programs, events, tasks) share a common base table with a discriminator column:

- **Base Table:** `content`
- **Discriminator:** `content_type` ENUM ('program', 'event', 'task')
- **Subtype Tables:** `programs`, `events`, `tasks`
- **Benefits:**
  - Polymorphic queries across all content
  - Shared columns (name, description, author, likes, comments, tags)
  - Consistent API across content types

### 2. Many-to-Many with Roles

Membership tables include role columns:

- `workspace_memberships`: user ↔ workspace (owner, admin, editor, viewer)
- `group_memberships`: user ↔ group (owner, admin, editor, viewer)
- **Benefits:**
  - Fine-grained access control
  - Auditable role changes

### 3. Cascade Deletion Strategy

Carefully designed cascades protect data integrity:

- **CASCADE:** workspace → programs, events, troops, memberships
- **CASCADE:** content → comments, tags
- **CASCADE:** event → tasks
- **RESTRICT:** workspace deletion blocked if events exist
- **RESTRICT:** program deletion blocked if events exist

### 4. Composite Foreign Keys

Event-to-Program relationship enforces workspace consistency:

```sql
FOREIGN KEY (workspace_id, program_id)
REFERENCES (programs.workspace_id, programs.id)
```

Ensures events cannot reference programs from different workspaces.

### 5. JSONB Storage

Flexible schema for:

- `users.preferences` - user settings
- `workspaces.settings` - workspace configuration
- `tasks.equipment` - equipment lists
- `tasks.media` - media attachments

---

## Database Constraints Summary

### Check Constraints

| Table      | Constraint             | Rule                |
| ---------- | ---------------------- | ------------------- |
| users      | ck_users_name_min      | name length ≥ 1     |
| users      | ck_users_auth0_min     | auth0_id length ≥ 1 |
| groups     | ck_group_name_min      | name length ≥ 1     |
| workspaces | ck_users_name_min      | name length ≥ 1     |
| content    | ck_content_name_min    | name length ≥ 1     |
| content    | ck_content_like_nonneg | like_count ≥ 0      |
| comments   | ck_comment_body_min    | body length ≥ 1     |
| tags       | ck_tag_name_min        | name length ≥ 1     |

### Unique Constraints

| Table     | Columns          | Purpose                     |
| --------- | ---------------- | --------------------------- |
| users     | auth0_id         | One Auth0 account per user  |
| users     | email            | One email per user          |
| tags      | name             | Global tag uniqueness       |
| programs  | workspace_id, id | Program scoped to workspace |
| emaillist | email            | No duplicate subscriptions  |

### Foreign Key Constraints

All foreign keys use UUID references with appropriate `ondelete` behavior:

- **CASCADE:** Delete parent → delete children
- **RESTRICT:** Block parent deletion if children exist
- **NULL:** Allow orphaning (rare)

---

## Enumerations

### User Enums

```python
Pronouns: she/her, he/him, they/them, other, prefer not to say
```

### Group Enums

```python
GroupRole: owner, admin, editor, viewer
```

### Workspace Enums

```python
WorkspaceRole: owner, admin, editor, viewer
Weekday: monday, tuesday, wednesday, thursday, friday, saturday, sunday, unknown
EventInterval: weekly, biweekly, monthly, yearly, unknown
```

### Content Enums

```python
ContentType: program, event, task
```

---

## Indexing Strategy

### Primary Indexes (Automatically Created)

All tables have UUID primary keys with B-tree indexes.

### Secondary Indexes

| Table    | Index                             | Columns                | Purpose                         |
| -------- | --------------------------------- | ---------------------- | ------------------------------- |
| users    | ix_users_auth0_id                 | auth0_id               | Fast authentication lookup      |
| users    | ix_users_email                    | email                  | Fast email lookup               |
| comments | ix_comments_content_id_created_at | content_id, created_at | Chronological comment retrieval |
| comments | ix_comments_user_id_created_at    | user_id, created_at    | User activity timeline          |

---

## Data Integrity Rules

### 1. Workspace-Program-Event Consistency

Events must belong to the same workspace as their parent program (enforced via composite FK).

### 2. Membership Exclusivity

Each user-group and user-workspace pair has exactly one role (enforced via composite PK).

### 3. Content Ownership

All content requires an author (non-nullable `author_id`).

### 4. Positive Metrics

Like counts must be non-negative (check constraint).

### 5. Non-Empty Strings

All name/text fields require minimum length of 1 character.

---

## Migration History

### Current Revision: 3474eca8787a

**Title:** Initial schema  
**Date:** 2025-11-08 14:58:59  
**Status:** Applied

**Includes:**

- All 15 tables created
- All constraints and indexes
- All enumerations
- All foreign key relationships

**Previous Revision:** None (initial migration)

---

## Repository Pattern Implementation

The backend uses a repository pattern for data access:

| Repository           | Model(s)                       | Primary Operations              |
| -------------------- | ------------------------------ | ------------------------------- |
| UsersRepository      | User                           | CRUD, authentication lookup     |
| GroupsRepository     | Group, GroupMembership         | CRUD, membership management     |
| WorkspacesRepository | Workspace, WorkspaceMembership | CRUD, membership management     |
| ProgramsRepository   | Program                        | CRUD, workspace scoping         |
| EventsRepository     | Event                          | CRUD, workspace/program scoping |
| TasksRepository      | Task                           | CRUD, event scoping             |
| TroopsRepository     | Troop, TroopParticipation      | CRUD, event participation       |
| TagsRepository       | Tag, ContentTag                | CRUD, content tagging           |
| CommentsRepository   | Comment                        | CRUD, content commenting        |
| EmailListRepository  | EmailList                      | Subscription management         |

---

## Known Design Considerations

### 1. Program Nullability in Events

`events.program_id` is nullable, allowing standalone events not part of any program.

### 2. Group Ownership of Workspaces

`workspaces.group_id` is nullable, supporting both group-owned and independent workspaces.

### 3. Event Deletion Protection

Events use `RESTRICT` on workspace deletion, requiring manual cleanup before workspace removal.

### 4. Single Table Inheritance Trade-offs

**Pros:**

- Polymorphic queries
- Shared functionality (comments, tags, likes)
- Consistent API

**Cons:**

- Nullable columns in subtype tables
- Larger table size
- Potential for sparse data

### 5. JSONB Flexibility vs. Type Safety

JSONB columns provide schema flexibility but lack compile-time type checking. Application layer must validate structure.

---

## Future Considerations

Based on the current schema, potential enhancements could include:

1. **Full-text search indexes** on content names/descriptions
2. **Audit tables** for tracking changes to critical entities
3. **Soft deletion** flags instead of hard deletes
4. **Media/file attachment** tables instead of JSONB
5. **User activity logs** for analytics
6. **Scheduled task execution** tracking
7. **Event recurrence patterns** (currently handled at application layer)
8. **Notification preferences** table
9. **Content versioning** for edit history
10. **Advanced permissions** beyond roles

---

## Technology Stack

- **Database:** PostgreSQL 13+
- **ORM:** SQLAlchemy 2.x
- **Migration Tool:** Alembic
- **Python Version:** 3.11+
- **Type System:** Full type hints with Mapped types
- **Validation:** Pydantic schemas (separate from models)

---

## Database Configuration

Connection managed via:

- `backend/app/core/db.py` - Database session management
- `backend/app/settings.py` - Database URL configuration
- `backend/alembic/env.py` - Migration environment

---

## Summary Statistics

| Metric             | Count |
| ------------------ | ----- |
| Total Tables       | 15    |
| Core Entities      | 11    |
| Join Tables        | 4     |
| Enumerations       | 6     |
| Check Constraints  | 8     |
| Unique Constraints | 5     |
| Foreign Keys       | 22    |
| Indexes (explicit) | 4     |
| JSONB Columns      | 5     |

---

## Relationships Summary

### One-to-Many Relationships: 13

1. User → Workspace Memberships
2. User → Group Memberships
3. User → Authored Content
4. User → Comments
5. Group → Group Memberships
6. Group → Workspaces
7. Workspace → Workspace Memberships
8. Workspace → Programs
9. Workspace → Events
10. Workspace → Troops
11. Program → Events
12. Event → Tasks
13. Content → Comments

### Many-to-Many Relationships: 4

1. Users ↔ Groups (via group_memberships)
2. Users ↔ Workspaces (via workspace_memberships)
3. Troops ↔ Events (via troop_participation)
4. Content ↔ Tags (via content_tags)

---

## Conclusion

The Slodi database architecture provides a robust, scalable foundation for managing scout programs, events, and collaborative planning. The design emphasizes:

- **Data integrity** through comprehensive constraints
- **Flexibility** via JSONB and nullable relationships
- **Performance** through strategic indexing
- **Maintainability** through clear separation of concerns
- **Scalability** through UUID-based distributed ID generation

The single table inheritance pattern for content enables powerful polymorphic queries while maintaining type-specific attributes. The role-based membership system provides fine-grained access control across groups and workspaces.
