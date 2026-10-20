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

- **RangeInput → C2 · Tap to edit.** Two handles with their values on them; tapping a value
  opens a popover (a bottom sheet on phones) with a field, −/+ and "Í lagi". Tested with iPhone
  emulation and real touch: dragging never scrolls the page, the keyboard never covers the
  field, no iOS zoom, 48px steppers with a 400ms hold before repeating. Changes are reported on
  release. Filters: 0–180 mín, 0–120 mín, 1–60.
- **Header → A2 · Wordmark + logo**, with a skip link, 48px targets, focus rings, aria-current,
  labelled navs, and the Storybook Auth0 leak fixed.

- **PlanCalendar → D4 · Stimplar.** The month is a stamp book: a ready fundur is stamped in ink
  with its theme's picture, a draft is a dashed, pencilled frame, an unsure one a dotted sketch
  with "?", an undecided one an empty dotted box; the past fades to a small grey "LOKIÐ" and a
  fundur that falls out is crossed out. One mild ink texture for every stamp. The month reads as
  a rhythm plus exceptions: "Fundir vikunnar" prints each flokkur's usual evening once, the
  usual fundur is one quiet line, exceptions say why ("Fært frá mið."), multi-day events are one
  strip across their days, and week notes run along their row. Below 40rem days become buttons
  with a day list under the grid. The today circle is centred and uses the primary colour.
  Stamps live in `components/plan/calendar/`, shared with the PlanGrid and SplitGrid labs.
  _Contract (sc-646):_ optional `ends_at`, `cancelled` and `Patrol.name_genitive` are added to
  the frontend types as proposals; the rhythm and "moved from" are derived.
- **BlockPalette → C · Card grid with C2 · Covers.** Cards with a picture/icon tile instead of
  the coloured side stripe, the built-in sources (Allt, Félagið, Færnimerki, Sveitin mín) as
  tabs, and the leader's own **möppur** (folders) as covers: a 2 × 2 mosaic of the blocks
  inside, with create, rename, delete with Afturkalla and "Setja í möppu…" on every card. The
  user-facing word is "mappa", never "albúm". _Backend:_ möppur live in memory
  (`hooks/useFolders.ts`, fixtures in mock mode) until sc-620.

- **Side nav (DashboardSidebar) → B · Groups, and `DashboardLayout` is now `AppShell`.**
  Headings Skipuleggja / Bankinn / Umsjón / Mínar síður, a sliding active pill, animations off
  under reduced motion; rationale on the AppShell docs page. Fixed: "Slóði" was `aria-current`
  on every page; the collapse button's text and name now match ("Minnka/Stækka valmynd");
  unbuilt items show "Kemur síðar" and say it to screen readers and in the collapsed tip; the
  badge count is read out; collapsed tips show on focus too; 768–1199px starts as icons and the
  toggle overrides it with a truthful `aria-expanded`; `100dvh`; the skip link comes first, on a
  token layer, and goes to `#efni` like the public pages'; `--sl-touch-target` (48px) is now a
  token and the menu button uses it.

- **UserManagement → C · Split**, on today's API only (sc-640). List and panel: search that
  ignores accents, permission chips with counts, `?q=&rettindi=&sida=&notandi=` in the URL; in
  the panel the platform permission and the bank role each save on their own button, only when
  changed, with a confirm for promotions (umsjónarmaður dagskrár, bank admin) and "Afturkalla"
  after; delete behind a named dialog; own row and platform admins read-only with the reason;
  Icelandic errors chosen from the status, "Reyna aftur"; 44px targets, 48px on a phone. It
  now loads every user (pages of 200), not one page of 20. Rationale on its docs page. _Backend
  follow-ups (sc-640):_ freeze/reinstate, join and last-seen dates and the change history are
  left out until the API has them.

## Picked, to promote

Nothing waiting.

## In the Lab

- **PlanGrid**: A with A1–A4, plus **A5 · Stimplar**, which reuses the real calendar's stamp kit
  so the grid and calendar are one family (see "Grid next to calendar").
- **SplitGrid → a new row, K1–K4: bank cards you can edit.** The S1–S4 styles are scrapped
  (2026-10-20). Each liður is the BlockPalette card it came from (picture tile and kind line
  shared through `components/plan/bench/BlockCard.tsx`), and the card is where a foringi changes
  it for one flokkur: length, status, who leads, adaptation, búnaður, another block, remove with
  Afturkalla, and back to the sveit's version. K1 on the card, K2 flip it over, K3 editor panel,
  K4 follows the sveit (edit one flokkur or every flokkur that follows). Time grid, moves and the
  honest merge are unchanged. _Needs backend:_ block link, leader, note, gear and the sveit's
  version on a lane liður (sc-646).
- **FundurSheet + LidurRow**: the current form, functions and interactions stay; variations are
  styles only. F0 is the current sheet with its 13 problems fixed (kind stripe, fit only in the
  footer, shouting title, rows not as tall as their time, spreadsheet rules, look-alike statuses,
  three "Skipta á flokka" pills, 28px glyph buttons, endurmat in a tooltip, misleading footer,
  "—" on undated rows, phone wrapping, generic card); F1 quiet, F2 stamped (the calendar's
  stamps), F3 run sheet (prints), F4 patrol colour (needs the fundur's flokkur from the API).

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

- **Storybook in English.** Storybook itself (sidebar groups, story titles and names, docs) is in
  English; component examples are in Icelandic. Many existing titles are Icelandic
  (`Components/Sameiginlegt/…`, `Components/Útlit/…`, `Components/Síur/…`) and need a sweep,
  which also renames the visual baselines.
