# Slóði Requirements Specification v0.1

## 1. Scope and Objectives

Slóði is an open-source web platform where scout leaders can plan meetings, catalog and share program ideas, assemble full programs, and review activity balance. It is designed for collaborative use within scouting groups and workspaces, with structured access controls, content sharing, and analytics for program diversity and participation.

## 2. Primary Objectives

- Provide a central Program Bank with searchable activities including clear instructions, age range, equipment, duration, and peer feedback.
- Deliver a drag-and-drop Planner for assembling and scheduling events and meetings.
- Offer ready-to-use Templates for common event types that can be customized and reused.
- Enable collaboration and sharing across workspaces and groups with comments and versioning.
- Support search and tagging across programs, events, and tasks using structured metadata.
- Include an Admin Dashboard for analytics, workspace management, and user roles.
- Provide Program Analytics and Participation Tracking to assess balance and troop engagement.

## 3. Stakeholders and Roles

- Scout Leader – Primary end-user; creates and manages programs, events, and tasks.
- Group Administrator – Manages group membership, workspace creation, and analytics.
- Workspace Admin/Owner – Manages workspace settings, memberships, and permissions.
- Contributor – Adds or edits public content (activities, templates).
- Maintainer – Oversees repository, security, and versioning for the open-source project.

## 4. Functional Requirements

### 4.1 Authentication and Accounts

- FR-A1: Users authenticate via email or federated identity (e.g., OAuth provider).
- FR-A2: Each user profile stores name, pronouns, email, and preferences.
- FR-A3: Users can belong to multiple groups and workspaces with roles derived from membership tables.
- FR-A4: Role-based access controls (RBAC) are enforced across both group and workspace contexts.
- FR-A5 A workshop has to contain at least a single user that has the role owner

### 4.2 Groups and Workspaces

- FR-G1: Groups act as organizational containers containing users.
- FR-G2: Workspaces define the operational scope for programs, events, tasks, and troops.
- FR-G3: Workspace settings include default weekday, start/end times, and scheduling interval.
- FR-G4: Memberships are tracked separately for groups and workspaces with defined role enums (owner, admin, editor, viewer).
- FR-G5: Access to any data entity must be validated through workspace membership or public visibility.

### 4.3 Program Bank

- FR-B1: Programs belong to a workspace and represent collections of related events.
- FR-B2: Users can create, update, duplicate, or archive programs (soft delete).
- FR-B3: Programs are private, and 'public' programs are displayed in the super workspace (a single workspace we designate as the "public" facing workspace)
- FR-B4: Each program may have multiple events; deletion rules ensure data consistency.
- FR-B5: Each program’s metadata includes name, description, and optional image.
- FR-B6: A user can copy from the super workspace to their own workspace, creating a new instance of that progam/event/task
- FR-B7: A user can 'publish' to the super workspace by making a copy from their own workspace to the super workspace.

### 4.4 Events

- FR-E1: Events represent scheduled meetings, outings, or activities.
- FR-E2: Each event belongs to one workspace and may optionally be linked to a program.
- FR-E3: Event data includes name, description, location, and start/end timestamps.
- FR-E4: Deleting an event cascades deletion to its tasks and troop participation records.
- FR-E5: Event creation automatically applies workspace defaults for time and duration when not explicitly provided.
- FR-E6: Events carry a `type` discriminator (`skipulags`/`sveitar`/`flokks`/`uppskeru`/`útilega`/`dagsferð`/`mót`) that drives default slot sets and behaviour. (Workshop change — ADR-002; #15, #57)
- FR-E7: Events carry a `scope` (`troop-wide` vs `per-flokkur`): troop-wide events span all grid columns, per-flokkur events occupy a single patrol's column, allowing parallel flokksfundir in the same period. (Workshop change — ADR-002; #19, #25, #11)

### 4.5 Tasks

- FR-T1: Tasks belong to events and represent concrete activities.
- FR-T2: Fields include name, description, estimated duration, participant ranges, equipment, and media JSON objects.
- FR-T3: Tasks are ordered within an event using order_index.
- FR-T4: The planner validates total duration and overlap warnings.
- FR-T5: Tasks carry a `status` (`tentative`/`draft`/`confirmed`) plus a first-class `?`/to-fill marker for undecided content, supporting progressive detailing of a plan. (Workshop change — ADR-002; #19, #23, #24)
- FR-T6: Tasks carry a venue/location that can differ per meeting (rotating venues). (Workshop change — ADR-002; #23)
- FR-T7: A task/element may span multiple weeks (e.g. badge Part 1/Part 2, multi-meeting projects) rather than being confined to one event. (Workshop change — ADR-002; #19, #90)
- FR-T8: A task/element carries its context envelope — theme, markmið, ÆSKA/þroskasvið, and underlying learning — not just the bare activity. (Workshop change — ADR-002; #52, #27, #5)

### 4.6 Content and Comments

- FR-CN1: Every program, event, or task that is publicly visible has a matching content record with content_type and ref_id.
- FR-CN2: Content is used for search, tagging, and public sharing.
- FR-CN3: Comments can be added to content items by users with appropriate access.
- FR-CN4: Content deletion cascades to comments and tag associations.
- FR-CN5: Like counts are managed server-side and cannot be directly modified by clients.

### 4.7 Tags and Search

- FR-S1: Tags apply to content and are stored in a many-to-many relationship via content_tags.
- FR-S2: Tag names are case-insensitive and unique (per workspace if scoped).
- FR-S3: Search indexes content.name and content.description for full-text queries.
- FR-S4: Users can filter by tag, content type, or creation date.

### 4.8 Troops and Participation

- FR-TP1: Troops are sub-units within a workspace and can be linked to events.
- FR-TP2: troop_participation represents event attendance by troops.
- FR-TP3: Each troop name must be unique within its workspace.
- FR-TP4: Participation records are unique per (event, troop) pair.

### 4.9 Administration and Analytics

- FR-ADM1: Admin dashboard provides metrics on usage, troop activity, and popular content.
- FR-ADM2: Audit log records workspace-level administrative actions.
- FR-ADM3: Analytics data can be exported as CSV for offline analysis.

### 4.10 Phase-2 Planner (dagskrárgerð)

Requirements from the phase-2 needs-analysis workshop (1 June 2026). Each is traceable
to a user story (`docs/tharfagreining2/user-stories.md`) and the raw ábendingar (`#N`,
`docs/tharfagreining2/meeting-notes.md`), and prioritised with MoSCoW aligned to the
capped build-first set (A · J · B · C · E) and the non-goals in
`docs/tharfagreining2/prioritisation.md`. This is a volunteer project (a ~15-person
team, ≈5 developers); the cap of five build-first clusters is deliberate and the
non-goals are explicit permission to cut.

#### 4.10.1 Temporal hierarchy above Program (ADR-001)

- FR-P1 (Must): A multi-level temporal hierarchy sits above the meeting level —
  `WorkYear → Cycle → Event{type, scope} → Task(+context)`. The `Cycle`
  (cycle/term) is a first-class entity that subsumes today's `Program` at term scale.
  (US A2/A4; ADR-001; #15, #19)
- FR-P2 (Must): `WorkYear` (work year / heildarmynd) is the top-level container holding
  year-level goals and the assembled master view. (US A5/A6; ADR-001; #15, #1)
- FR-P3 (Should): A `Cycle` is copyable as an annual scaffold — last year's
  cycle layout can be cloned and re-peopled, only changing the flokkar. (US A2/B5; ADR-001; #22)
- FR-P4 (Could): Slóði can generate the félag's annual `starfsáætlun` as a by-product of
  the content already entered. (US A6/I2; #1, #15)
- FR-P5 (Should): The upper levels (WorkYear, Cycle) are optional — a casual,
  low-frequency leader can work at the meeting level alone without being forced through
  the full hierarchy. (ADR-001 kill caveat; #15)

#### 4.10.2 Shared master plan / one source of truth (Cluster A — build-first #1)

- FR-P6 (Must): The plan is one authoritative dataset that every co-leader works from,
  replacing scattered Excel/Sheets/Drive/whiteboard copies. (US A1; #38, #16, #18, #82, #94, #11)
- FR-P7 (Must): A `Cycle` is stored once as a 2-D grid (weeks Y × flokkar X)
  plus utility columns (ATH/notes, Innkaup/procurement). (US A2/A3; ADR-002; #19, #25)
- FR-P8 (Must): The single dataset is rendered as three projections — grid (weeks × flokkar),
  per-flokkur timeline, and month calendar — that are filters/views, not separate tools or
  duplicated data. (US A4; ADR-002; #19, #21, #23)
- FR-P9 (Should): A grid-like, Sheets-style editing UX lets leaders edit per-fundur,
  per-flokkur cells fast enough to beat the Excel/Sheets workflow it replaces. (US A3; #82, #19, #25)
- FR-P10 (Should): A rolling "next-N-meetings" working window (per flokkur) is available,
  not only the whole-year view. (US A7; #28, #19, #21)
- FR-P11 (Could): The plan supports version history so leaders can see how it evolved and
  recover earlier states. (US X2; #77, #35)

#### 4.10.3 Roles, access tiers & sharing (Cluster J — build-first #2)

- FR-P12 (Must): Co-leaders (samforingjar) can be granted edit access to a dagskrá so a
  team co-edits one plan. Builds on the existing `owner/admin/editor/viewer` RBAC. (US J1; #67, #30, #94)
- FR-P13 (Must): A "view + receive tasks" tier lets an aðstoðarforingi see the plan and
  receive their assigned tasks/fyrirmæli without full edit rights. (US J2; #68, #30, #33)
- FR-P14 (Should): A foringi can grant a partial view (some of the plan, not all) so the
  plan can be shared without exposing innri mál. (US J3; #69, #20, #97)
- FR-P15 (Should): The dagskrá (programme only — not innri mál: planning notes, endurmat,
  assignments, council) can be shared as a read-only link with older youth and parents.
  **No technical age lock (D8)** — age-appropriateness is honour-system guidance to the
  leader; the content boundary is enforced. Youth/parents are never account-holding users.
  (US G1/J4; #97, #20, #69, #79, D8)
- FR-P16 (Should): A `starfsráð` (staff council) access tier lets the council work directly
  inside Slóði instead of a separate starfsráðsmappa. (US J6; #93, #15, #46)
- FR-P17 (Must): Member, badge-progress, and personal data are visible only inside the félag,
  never to outsiders — the safeguarding-compatible line that lets programs/ideas be shared
  openly while keeping people's data private. (US J8/K1; #79, #78, #72, #71)
- FR-P18 (Could): Each person has an individual profile and can view the master plan. (US J5; #80, #38)

#### 4.10.4 Templates / sniðmát — copy-and-edit blocks (Cluster B — build-first #3)

- FR-P19 (Must): Reusable blocks behave as composable "legó" — typed slots assembled into a
  plan, copy-and-edit (clone-and-tweak), never frozen. (US B1/B4; ADR-002; #6, #24, #51, #56)
- FR-P20 (Must): A meeting starts from a fixed slot skeleton (beinagrind:
  setning → dagskrá → leikur → slit → endurmat) into which activities are puzzled. (US B1/B13; #6, #24, #17)
- FR-P21 (Should): A type-aware "create…" launcher ("hvað viltu gera í dag?" → búa til fund /
  útilegu / mót) loads the right slot skeleton and templates per event type. (US B2; #65, #6, #61)
- FR-P22 (Should): A generic base block can be re-skinned by a theme parameter to produce many
  variants without re-authoring (parametrised templates). (US B6; #62, #61, #57)
- FR-P23 (Should): A whole event (útilega / mót / kvöldvaka) can be saved as a template and
  cloned next time ("same camp, swap the theme"). (US B5; #55, #61, #54)
- FR-P24 (Could): Færnimerki are available as runnable, adaptable program templates with their
  leiðbeiningar, addable to a fundur/dagskrá, with completion trackable. (US B8/B9; #60, #3, #92)
- FR-P25 (Could): Program elements (liðir) can be linked/related into series or dependencies
  (e.g. badge Part 1 → Part 2), supporting multi-week projects (see FR-T7). (US B10; #90, #66, #19)

#### 4.10.5 Assign & notify ahead (Cluster C — build-first #4, pain pick)

- FR-P26 (Must): A foringi can assign tasks/roles per meeting to co-leaders and push the plan
  to them with lead time, killing the "5 minutes before the meeting" scramble. (US C1/C3; #33, #30, #40, #68)
- FR-P27 (Should): An aðstoðarforingi has a glanceable "your role/tasks today" view for the
  next fundur. (US C2; #68, #30, #33)
- FR-P28 (Should): A procurement/innkaup worklist is derived from the plan (the Innkaup column)
  rather than free-typed, and can be sent to the staff buyer with lead time. (US C4/I2; ADR-002; #39, #19, #15)

#### 4.10.6 Activity / games bank + search (Cluster E — build-first #5)

- FR-P29 (Must): A searchable activity/games bank lets a foringi find activities to pull from
  when planning or when scouts get stuck. (US E1/E2; #29, #10, #85)
- FR-P30 (Should): The bank is usable on mobile for in-the-moment quick-grab use (filter by
  duration, energy, age, gear). (US E1/X1; #53, #29, #88)
- FR-P31 (Should): Bank content has rich tags (filling gaps like "eldur") and good search/filter.
  (US E3; #73, #53, #29)
- FR-P32 (Should): Users can bookmark/favourite programs and activities for quick retrieval.
  (US E4; #81, #53, #87)
- FR-P33 (Could): The bank models scouting-specific content types (hróp, kvöldvökur, songs,
  ceremonies), ready-made and editable, not just generic activities. (US E6; #54, #53, #29)
- FR-P34 (Could): The bank prevents/curates duplicate entries as community contributions grow.
  (US E5; #89, #84, #87)

#### 4.10.7 Endurmat loop — bundled-lightweight (Cluster D)

- FR-P35 (Should): A written endurmat note can attach to a block / fundur / event / cycle, is
  retained, and resurfaces when the same thing is planned again (clone-last-year carries its
  lessons). Implemented on the block/event data model (FR-T8, FR-P19), not as a standalone
  feature. (US D1/D2/D3; #45, #48, #46)
- FR-P36 (Could): Endurmat is scale-appropriate — quick/optional for routine fundir, structured
  for events (filed to the council archive), prompting both "hvað gekk vel" and "hvað hefði mátt
  fara betur". (US D4; #46, #47, #49)

#### 4.10.8 ÆSKA coverage — latent (Cluster F)

- FR-P37 (Could): ÆSKA/þroskasvið is modelled as the envelope around the plan (not a single
  field; see FR-T8); a coverage/balance view over the cycle's tagged data can be added later.
  Tags can be captured now, the view added cheaply later. (US F1; #27, #60, #92)

#### 4.10.9 Outputs / generation (Cluster I)

- FR-P38 (Could): Leaders can print/export fundir, the starfsáætlun, and templates as paper
  artifacts. Flagged "mikilvægt" but small; derived worklists are covered by FR-P28. (US I1; #96, #10, #1)

#### 4.10.10 Cross-cutting constraints

- FR-P39 (Must): Slóði is a leaders' tool. Youth and parents are never account-holding users;
  youth get view-only access to the dagskrá only. **No technical age lock (D8)** — leaders are
  asked (not forced) to share with older youth (drótt/rekar) and not drekar/fálkar. No
  minor-account or youth-edit system in v1. (RESOLVED #97, D8; US G1/G4; #97, #20, #69, #79)
- FR-P40 (Must): Safeguarding is a guardrail on every youth-facing or sharing feature: minors'
  persónuvernd is protected, there are no open youth-to-youth channels, and neteinelti is
  prevented. Gates FR-P13–FR-P15. (US K1; #71, #13, #79, #97)
- FR-P41 (Should): The planner is mobile-usable (in-the-moment use is phone; planning may be
  desktop). Confirm native-app vs responsive-web/PWA intent. (US X1; #88, #53, #82)

> **Phase-2 non-goals (explicit — do not silently re-smuggle into scope).** Youth accounts /
> youth-as-users (RESOLVED #97); real-time Google-Docs co-editing (shared-read of one source
> may suffice — #16); full equipment registry + inter-félag lending and resource clash detection
> (a later `Resource` entity — #11/#12); mót planning as a dedicated target (útilega is an Event
> type; mót is not a phase-2 planner target); gamification / leader engagement (cluster L —
> #74/#75/#95); a rich parent portal (parents "skoða lítið" — #20); community / cross-org
> discovery as a build-first item (cluster M — biggest surface, target phase 2.5/3, needs A/B/J
> first — #76/#83/#84); integrations (cluster N — Drive/BÍS/Abler, later — #91/#82/#83). See
> `docs/tharfagreining2/prioritisation.md` §(d).

## 5. Non-Functional Requirements

### 5.1 Performance and Reliability

- API responses under 200 ms for common queries; page loads under 2 s (p50).
- Planner drag operations maintain 60 fps on modern browsers.
- Nightly backups of changes

### 5.2 Security and Privacy

- All traffic over TLS; JWT-based session tokens.
- RBAC enforced both at API and database layer.
- Audit log for admin actions.
- Input validation on all JSON fields.

### 5.3 Accessibility and Internationalization

- WCAG 2.1 AA for all user interfaces.
- Multilingual text system via externalized translation keys.
- Keyboard navigation and ARIA labeling throughout Planner.

### 5.4 Operability and Maintainability

- CI pipeline with linting, type checks, and test automation.
- Logs and metrics exposed for operational dashboards.
- Documentation covering setup, schema, and contribution.

### 5.5 Compatibility

- Support for latest versions of Chromium, Firefox, Safari, and mobile equivalents.
- Graceful degradation for limited connectivity environments.

## 6. Data Model Reference

Enums: pronouns_enum, group_role_enum, workspace_role_enum, workspace_weekday_enum, workspace_event_interval_enum, content_type_enum.

## 7. User Stories (Selected)

### US-1: Search and Filter Activities

As a Scout Leader, I want to search and filter content by tags, equipment, and duration so I can quickly find suitable activities.

### US-2: Build a Meeting Plan

As a Scout Leader, I want to assemble a meeting timeline using drag-and-drop tasks so I can design complete events.

### US-3: Share a Program for Feedback

As a Scout Leader, I want to share a draft with my workspace so others can comment before finalizing.

### US-4: Track Troop Participation

As a Group Admin, I want to see which troops participated in events to ensure equitable engagement.

## 8. MVP Scope

### In Scope

- Authentication and user roles
- Core Program Bank and Planner
- Search and tagging
- Workspace and membership management
- Basic sharing and comments
- Initial analytics (usage, participation)

### Out of Scope

- Offline mode
- Mobile app clients
- Complex moderation workflows
- External calendar integrations (abler)

## 9. Success Metrics

- At least one unit in 80% of all scout groups have created an account by the general assembly 2027 (12 month period since official release)
- 40% of programs have multiple collaborators by month 6.
- Growth in active workspaces and shared content month-over-month.

## 10. Constraints and Open Questions

### Constraints

- One workspace belongs to one group; content cannot span workspaces.
- Public content visible system-wide but editable only by owners.

### Open Questions

- Should tags be global or workspace-scoped?
- Program deletion semantics with linked events?
- Identity provider lineup for production (Auth0, Google, email)?
- programs: High-level program templates or collections
- events: Scheduled meetings or occurrences (optionally linked to programs)
- tasks: Concrete activities within events
- content: Public-facing mirror of program/event/task for sharing and tagging
- comments: User comments on content
- tags: Labels for content
- content_tags: Many-to-many join of content and tags
- troops: Sub-units that can participate in events
- troop_participation: Many-to-many join of events and troops

### Relationships summary

- users 1..N group_memberships, users 1..N workspace_memberships, users 1..N comments, users 1..N created_by and updated_by across domain tables
- groups 1..N workspaces, groups 1..N group_memberships
- workspaces 1..N programs, events, troops, workspace_memberships
- programs 1..N events
- events 1..N tasks and 1..N troop_participation
- content mirrors programs or events or tasks one-to-one via (content_type, ref_id)
- content 1..N comments, content M..N tags via content_tags
- troops M..N events via troop_participation

### Enums

- pronouns_enum: values to be defined
- group_role_enum: owner, admin, editor, viewer
- workspace_role_enum: owner, admin, editor, viewer
- workspace_weekday_enum: monday to sunday
- workspace_event_interval_enum: weekly, biweekly, monthly
- content_type_enum: program, event, task

### Operational notes

- Set cascade deletes carefully. Recommended: deleting an event cascades tasks and troop_participation. Deleting a program either restricts if events exist or sets events.program_id to null. Deleting content cascades comments and content_tags.
- Add indexes: all FK columns; events(start_dt); content(public, content_type, created_at); trigram on content name (Postgres); content_tags(content_id) and (tag_id); workspace_memberships(workspace_id, user_id).

## 6. Example User Stories with Acceptance Criteria

### US-1: Search and filter activities

As a Scout Leader, I want to find activities by age range, duration, and equipment so that I can quickly assemble a program.

Acceptance Criteria

- AC-1: Search field returns results matching title or description.
- AC-2: Filters for age range, duration buckets, and equipment can be combined.
- AC-3: Results update in under 500 ms after filter changes.

### US-2: Build a meeting with drag and drop

As a Scout Leader, I want to drag activities into a timeline so that I can build a complete meeting plan by time.

Acceptance Criteria

- AC-1: Activities can be dropped into time slots with automatic total duration calculation.
- AC-2: Overbooked timelines show a clear warning and suggested fixes.
- AC-3: Program can be saved as Draft and later Published.

### US-3: Share a program for feedback

As a Scout Leader, I want to share a draft program with my group so that I can collect comments before finalizing.

Acceptance Criteria

- AC-1: Share dialog allows selecting users or groups with view or comment access.
- AC-2: Commenters can add inline notes anchored to activities.
- AC-3: Program owner gets notifications on new comments.

### US-4: Analyze balance after an event

As a Group Admin, I want to review the balance of activities in a finished program so that I can ensure variety across development domains.

Acceptance Criteria

- AC-1: Completed programs display a balance report with domain coverage.
- AC-2: Export to CSV is available for further analysis.

## 7. MVP Cut

## In scope for MVP

- Authentication and role basics
- Program Bank: create and view activities with core fields
- Planner: drag and drop, duration validation, save and publish
- Search and filtering by age, duration, equipment, theme
- Simple sharing via link to authenticated users
- Basic admin controls for users and tags
- Initial analytics: usage counters and a minimal balance view

## Out of scope for MVP

- Full offline mode
- Mobile apps
- Complex workflow approvals
- Advanced moderation queues
- External calendar integrations

## 8. Success Metrics

- Time to first program created by a new user under 15 minutes
- At least 30 percent of programs created from templates within 3 months
- 2+ collaborators on 40 percent of programs by month 6
- Weekly active leaders and retention rates trending up month over month

## 9. Constraints and Assumptions

- Open source on GitHub with transparent issue tracking and contribution process.
- User-centered design practices drive prioritization and iterations.
- Content and taxonomy will evolve; tagging must be editable and versioned.

## 10. Open Questions

- Which identity providers do we support at launch?
- Exact taxonomy for domains used in balance analytics?
- Data retention policy for archived programs and comments?
- Minimum browser versions and mobile breakpoints?
