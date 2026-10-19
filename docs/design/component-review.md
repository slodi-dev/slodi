# Component review

A running log of the component-by-component review in Storybook, started 2026-10-19. Each
row is a verdict; anything marked **Lab** gets variations under `Lab/` in Storybook (see
`frontend/stories/lab/Lab.mdx`) before the real component changes.

| Component                          | Verdict         | Notes                                                                                                                                                                                                                                             |
| ---------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alert                              | **Lab**         | Reads as generic AI-product UI (pale fill, coloured left stripe, round corners). Variations in `Lab/Alert`.                                                                                                                                       |
| Modal                              | Keep            | Basic, and it works.                                                                                                                                                                                                                              |
| Button                             | Keep            | Basic, and it works.                                                                                                                                                                                                                              |
| Type badge                         | Keep            |                                                                                                                                                                                                                                                   |
| ActiveChip                         | Keep + **Lab**  | Good. Try variations on the green for different uses, in `Lab/ActiveChip`.                                                                                                                                                                        |
| CollapsibleSection                 | Keep, fixed     | The checkboxes in its story were bare `<input>`s: tick sat high and touched the text. The story now uses the real filter checkbox styles, which centre the tick and leave a gap.                                                                  |
| RangeInput                         | **Lab**         | Number fields too wide and clunky. Try sliders you can drag and type into, with min and max visible, in `Lab/RangeInput`.                                                                                                                         |
| FormControls                       | Keep            |                                                                                                                                                                                                                                                   |
| PatrolBadges                       | Keep + **Lab**  | Good, as long as every colour is accessible. Wants one text colour in both light and dark mode; proposals with light and dark shades per patrol in `Lab/PatrolBadges`.                                                                            |
| MobileMenuButton                   | Fixed (story)   | Looked invisible: it is `display: none` above 767px and its stories rendered at desktop width. The stories now open at phone width.                                                                                                               |
| DashboardLayout                    | **Rename**      | It is the app shell around the side nav, not a dashboard. Rename together with the English Storybook sweep.                                                                                                                                       |
| Side nav (DashboardSidebar)        | **Lab**         | Variations in `Lab/Sidebar`.                                                                                                                                                                                                                      |
| Header                             | **Lab**         | Variations in `Lab/Header`.                                                                                                                                                                                                                       |
| UserManagement                     | **Lab**         | Variations and improvements in `Lab/UserManagement`.                                                                                                                                                                                              |
| TagCreateInput, TagManagement page | **Lab**         | Variations and improvements in `Lab/Tag management`.                                                                                                                                                                                              |
| DevlogClient                       | Fixed + **Lab** | "Needs some love." Fixed: the hidden "Lesa nánar" text showed on every card (no global `sr-only` class; the link already had its label), and a failed "Hlaða inn meira" did nothing (now an error and "Reyna aftur"). Variations in `Lab/Devlog`. |

## Storybook language

Storybook itself is in **English**: sidebar groups, story titles, story names, docs and
descriptions. The component examples are in **Icelandic**, the way users see them. Many
existing titles are Icelandic (`Components/Sameiginlegt/…`, `Components/Útlit/…`,
`Components/Síur/…`) and need a sweep; it renames the visual baselines too.
