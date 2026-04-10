# Slóði — System Vision Overview

> Slóði aims to be the digital operating system for program planning in Icelandic Scouting: open, modular, community-driven, and volunteer friendly.

## Table of Contents

1. [Core Purpose](#1-core-purpose-of-the-system)
2. [Platform Pillars](#2-pillars-of-the-slóði-platform)
   - [Program Bank](#a-program-bank-dagskrárbankinn)
   - [Program Builder](#b-program-builder-dagskrárgerðarverkfæri)
   - [Templates & Examples](#c-templates-and-examples-sniðmát-og-dæmi)
   - [Collaboration Layer](#d-collaboration-layer-samvinnuverkfæri)
   - [Search & Tagging](#e-search-and-tagging-leit-og-merking)
   - [Program Analytics](#f-program-analytics-greiningartæki-fyrir-dagskrá)
   - [Admin Dashboard](#g-admin-dashboard-stjórnendastjórnborð)
   - [Social Feed](#h-social-feed-félagslegur-straumur)
3. [Architectural Vision](#3-architectural-vision)
4. [Development & Contribution Workflow](#4-development--contribution-workflow)
5. [User Experience Principles](#5-user-experience-principles)
6. [Governance & Community Engagement](#6-governance-and-community-engagement)
7. [Outcome & Value Proposition](#7-outcome--value-proposition)
8. [User Interaction Flow](#8-user-interaction-flow)



## 1. Core Purpose of the System

Slóði operationalizes program creation across scouting units by providing an intuitive, centralized platform where leaders can plan activities, collaborate, and ensure alignment with the scouting method and developmental goals.

**Design mantra:** Reduce friction, increase quality, and enable leaders to focus on actual scouting instead of administrative overhead.



## 2. Pillars of the Slóði Platform

High-level functional domains shaping the full system vision.

### A. Program Bank (Dagskrárbankinn)

The hub of reusable, well-documented program ideas.

**Key Capabilities:**

- Rich activity entries: instructions, materials, prep time, safety notes, tips.
- Age ranges and difficulty categorization.
- Community-driven tagging: theme, equipment, location, season, etc.
- Peer insight: ratings, comments, recommendations.
- Version-controlled content evolution.

### B. Program Builder (Dagskrárgerðarverkfæri)

Visual environment for assembling meetings, weekends, and camps.

**Functional Expectations:**

- Timeline-based and category-based planning modes.
- Automatic time allocation checks (prevent overbooking).
- Real-time aggregation of required gear, leaders, resources.
- Support for symbolic frameworks and themed programs.
- Reusable templates for recurring events.

### C. Templates and Examples (Sniðmát og Dæmi)

Accelerators for new or less experienced leaders.

**Examples Include:**

- Weekly meeting structures.
- Age-tailored discovery cycles.
- Badge requirement flows.
- Campfire and weekend program templates.

**Template Requirements:** editable, exportable, sharable.

### D. Collaboration Layer (Samvinnuverkfæri)

Community contribution is core to the mission.

**Collaboration Features:**

- Share programs/activities with individuals, patrols, or units.
- Commenting, suggestion mode, and remixing.
- Public and private creation spaces.
- Reuse/adaptation history for organizational insight.

### E. Search and Tagging (Leit og Merking)

High-performance search enabling frictionless discovery.

**Capabilities:**

- Faceted filtering: age, duration, indoor/outdoor, developmental domain (ÆSKA), difficulty, equipment.
- Smart suggestions based on prior selections.
- Full-text search across instructions, comments, tags.

### F. Program Analytics (Greiningartæki fyrir Dagskrá)

Decision-support suite for leaders and administrators.

**Insight Capabilities:**

- Balance analysis across developmental domains.
- Track diversity of activities over time.
- Identify underrepresented activity types.
- Exportable reports for troop leadership.

### G. Admin Dashboard (Stjórnendastjórnborð)

Management cockpit for unit and national oversight.

**Key Modules:**

- Usage analytics & adoption metrics.
- Program diversity & quality indicators.
- Support triggers for resource gaps.
- Content moderation workflows.

### H. Social Feed (Félagslegur Straumur)

Persistent, lightweight social layer fostering reflection, sharing, and cross‑unit inspiration. Bridges planning (Program Builder) and community (Collaboration Layer) by surfacing real program usage and experiential insights.

**Objectives:**

- Increase engagement and knowledge transfer through informal sharing.
- Provide reflective space after activities (what worked, improvements, outcomes).
- Highlight exemplary programs and emerging practices.

**Core Features:**

- Activity & Program Posts: share finished agendas, adaptations, photos (with permissions), and post‑event reflections.
- Reflection Prompts: structured fields (outcomes, challenges, skills developed) encouraging quality retrospectives.
- Scoped Visibility: private (troop), friends/peer leaders, district, national, or public (open-source showcase).
- Lightweight Reactions: scouting‑themed badges (e.g., "Trailblazer", "Teamwork", "Skill Boost").
- Follow Model: follow units, leaders, tags, or program authors to personalize feed.
- Tag & Link Integration: posts auto-link to related Program Bank entries, enabling quick reuse.
- Inline Diff View: show changes between original template and executed program for learning.
- Post Moderation & Flagging: integrate with Admin Dashboard workflows.
- Notification Hooks: comments, mentions, reuse of your shared program.
- Weekly Highlights: automated summary ("Top Adapted Activities", "Emerging Themes").

**Data for Analytics:**

- Engagement signals (views, adaptations) enrich Program Analytics.
- Reflection metadata feeds quality indicators and improvement loops.

**Governance & Safety Considerations:**

- Role-based media permissions (youth protection & privacy compliance).
- Opt-in sharing defaults; explicit consent for images.
- Clear archival policies (stale posts auto-archived for focus & performance).

**Future Extensions:**

- Cross-troop challenge threads.
- Seasonal inspiration campaigns (winter skills, nature stewardship).
- Achievement unlocks tied to balanced program execution.

This feed remains additive—not a distraction—emphasizing actionable reflection over generic social chatter.



## 3. Architectural Vision

Designed for horizontal scaling and external contribution.

**Principles:**

- Modular backend: Program Bank, Planner, Analytics, Collaboration as separable services.
- API-first design enabling mobile apps & third-party integrations.
- Open-source GitHub repository encouraging community contributions.
- Fully containerized deployment for reproducibility.



## 4. Development & Contribution Workflow

Modern developer experience built in.

**Workflow Elements:**

- GitHub Actions for CI, testing, preview environments.
- Docker Compose-based dev environment.
- Infrastructure-as-Code for consistent deployments.
- Contribution guidelines & governance model.



## 5. User Experience Principles

Leader-centric, time-aware design.

**UX Expectations:**

- Minimal learning curve; intuitive interfaces.
- Templates & presets to boost productivity.
- Mobile-first for field usage.
- Accessibility compliance (inclusive participation).



## 6. Governance and Community Engagement

Slóði as a community asset.

**Includes:**

- Feedback loops with active leaders.
- Regular user testing cycles.
- Evolving requirements driven by real-world use.



## 7. Outcome & Value Proposition

Multi-level value delivery.

**For Leaders:**

- Faster, higher-quality program planning.
- Better resource management.
- Increased creativity & collaboration.

**For Units:**

- Consistent program quality.
- Improved oversight & continuity.
- Shared knowledge across leaders & age groups.

**For the National Movement:**

- Unified digital backbone for program development.
- Data-driven insights into activity trends.
- Flagship open-source contribution to global scouting.

*Version: Initial structured Markdown draft (2025-11-20).*


## 8. User Interaction Flow

This section has been extracted into a dedicated document for clarity and iterative expansion.

➡️ See: [Front-End User Interaction Flow](frontend/user-interaction-flow.md)

Summary: Provides Mermaid diagrams for journey and component architecture, state boundaries, and enhancement roadmap.

