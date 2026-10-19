# Component review

A running log of the component-by-component review in Storybook, started 2026-10-19. Anything
marked **Lab** gets variations under `Lab/` in Storybook (see `frontend/stories/lab/Lab.mdx`);
once a variation is picked it is **promoted** into the real component and its lab folder deleted.

## Promoted

- **Alert → E · Stamp.** The old one read as generic AI-product UI (pale fill, coloured left
  stripe, round corners). Now a dashed frame in the status colour on its subtle tint, a status
  icon, an uppercase title in the status colour and the message in body text. Same props.
  _Follow-up:_ the app has 24 hand-made `role="alert"` messages; the page-level ones should use
  Alert.
- **PatrolBadges → set A.** Six vivid hues: Drekar yellow, Fálkar red, Drótt green, Rekkar blue,
  Róver orange, Aðrir purple (Drótt and Rekkar used to be 9° apart and read as the same teal).
  Dark text on every badge in both modes; each patrol is -500 in light and -400 in dark, hover
  and active step lighter. White text was rejected: on bright yellow it can never reach AA, so
  yellow turns mustard. The story now fails CI on any badge under AA.
- **ActiveChip → tones.** `active` (default), `selected`, `suggested`, `status`, `deep`, plus
  the existing `hidden`, and a `count` bubble. Same shape for every tone.
- **Tag management → A · Find or create.** One field searches as you type and creates on Enter;
  "Er til" on an exact match; inline, announced duplicate error; counter from 45/50; rename in
  place; `?q=&page=` in the URL; skeleton, error with Reyna aftur, empty and no-match states;
  "merkimiði" throughout. The field keeps focus while saving (sc-637). Delete is a named
  confirmation dialog because the backend delete is permanent. Also fixed: only the first 50
  tags were ever listed, and usage counts came from a 24-row page. _Backend follow-ups:_ sc-639.
- **Devlog (Verkbók) → D · Magazine.** Cover cards (a tint per slug without an image), newest
  wide, a header with the post count and latest date, "Nýtt" up to 14 days, a `?merki=` tag
  filter, and a 65ch single post with tag links, Nýrri/Eldri neighbours and a back link to the
  reader's list. Also fixed: hidden "Lesa nánar" text showed on every card; a failed load-more did
  nothing; inline code rendered its backticks.

## Picked, to promote

- **Side nav (DashboardSidebar) → B · Groups.** Group headings Skipuleggja / Bankinn / Umsjón /
  Mínar síður, a sliding active pill, animations off under reduced motion. Bugs to fix on
  promotion: "Slóði" is `aria-current` on every page (`startsWith("/")`); the collapse button
  says "Fela valmynd" but is labelled "Loka valmynd"; unbuilt items have a tooltip-only reason;
  the badge count is hidden from screen readers; collapsed labels are hover-only; 768–1199px is
  forced to icons while the toggle still flips `aria-expanded`; `100vh`; the skip link comes
  after the nav at `z-index: 9999`; `--sl-touch-target` is referenced by the UX doc but not
  defined.
- **UserManagement → C · Split.** List and detail panel: role with save only when changed and a
  confirm for promotion, freeze with a reason and date, a history timeline. Problems in the
  current page: promotion saves on `<select>` change with no confirm; no undo or success
  feedback; delete is the only access action; no permission filter and nothing in the URL;
  raw English errors; 24–28px targets. _Needs backend:_ status, freeze, join/last-seen and
  history fields don't exist in the API yet. _Open wording:_ "Frystur"/"Virkur" is masculine.

## In the Lab

- **RangeInput → C · Values on the handles, being refined.** The values on the handles can be
  typed into; next, variations on how the number is entered.
- **Header → A, A2, B, B2.** A2 and B2 add the logo (green mark in light, white in dark; B2's band
  stays deep green in dark so the white logo reads). Logo as big as the wordmark; B's tagline is
  "Meira en bara dagskrárvefur". The green gradient behind the headers is gone. Problems in the
  current header: no skip link, 40px menu buttons and ~28px links, no focus styles, literal
  `rgba` scrim, no `aria-current`, unlabelled desktop `<nav>`, Github opens a new tab silently,
  ☰/✕ as text glyphs. Storybook's Auth0 mock leaks the signed-in state between stories.

## Kept as they are

- **PlanShell (Vinnubekkur) layout**: as intended. Top left is the collections (Allt, Sveitin
  mín, Félagið, Færnimerki), bottom left is the items in the chosen collection, and the main
  body is the plan.
- **PlanCalendar grid**: no issues. The today circle is now centred on the number and uses the
  primary colour (fixed on #194). Day entries: **D · Staða** picked (the month as a
  planning-status map); the other looks are scrapped and `Lab/PlanCalendar` now explores Staða
  variations with playful icons and badges. Design input: a month is a regular weekly fundur per
  flokkur (same weekday and time) plus exceptions — fös–sun útilegur as one spanning bar,
  single-day events, cancelled or moved fundir.
- **PlanGrid**: the grid itself is good. The ATH and INNKAUP columns came from a spreadsheet and
  are in `Lab/PlanGrid`: ATH becomes the week's endurmat or a reminder, INNKAUP becomes the
  week's collected búnaður with owned/needed ticks.

- **Modal**, **Button**: basic, and they work.
- **Type badge**, **FormControls**: good.
- **CollapsibleSection**: good. Its story used bare `<input>` checkboxes (tick high, touching the
  text); it now uses the real filter checkbox styles.
- **MobileMenuButton**: looked invisible because it is `display: none` above 767px and its stories
  rendered at desktop width. The stories now open at phone width.

- **SeasonSwitcher**: works for now. It switches between the term plan ("Starfsárið") and the
  undated scratchpad ("Krot og krass"); later, between years. The "(GERVIGÖGN)" suffix on the
  fixture season names is gone (#194); the sticky banner still labels fixture data.
- **Bench (PlanBench)**: good as a whole; it is a collection of the parts getting variations.

## To do

- **Rename `DashboardLayout` → `AppShell`.** It is the app shell around the side nav, not a
  dashboard. Do it with the side-nav promotion.
- **Storybook in English.** Storybook itself (sidebar groups, story titles and names, docs) is in
  English; component examples are in Icelandic. Many existing titles are Icelandic
  (`Components/Sameiginlegt/…`, `Components/Útlit/…`, `Components/Síur/…`) and need a sweep,
  which also renames the visual baselines.
