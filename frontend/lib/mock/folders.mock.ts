/**
 * The leader's own möppur (folders) in the bank rail, as fixtures. Nothing behind them exists in
 * the API yet: sc-620 is the backend (the proposed `folder` / `folder_item` tables and
 * `/folders` endpoints are on the BlockPalette docs page). Until then the rail keeps them in
 * memory, seeded from here in mock mode.
 *
 * A mappa is a named list of *references* to bank blocks, in the order the leader keeps them.
 * It holds no copies: editing a block in the bank changes it in every mappa.
 */

/** The icons a mappa can wear. Kept apart from the type and theme icons on purpose. */
export const FOLDER_ICON_NAMES = [
  "BookMarked",
  "Star",
  "CloudRain",
  "Leaf",
  "Snowflake",
  "Flame",
] as const;

export type FolderIconName = (typeof FOLDER_ICON_NAMES)[number];

export type LibraryFolder = {
  id: string;
  name: string;
  icon: FolderIconName;
  /** Shared with the sveit (owned by the workspace), or the leader's own (owned by the user). */
  shared: boolean;
  /** Bank block ids, in the leader's order. */
  blockIds: string[];
};

export const LIBRARY_FOLDERS: LibraryFolder[] = [
  {
    id: "mappa-1",
    name: "Uppáhalds leikir",
    icon: "Star",
    shared: false,
    blockIds: ["lb-1", "lb-2", "lb-3"],
  },
  {
    id: "mappa-2",
    name: "Rigningardagar",
    icon: "CloudRain",
    shared: true,
    blockIds: ["lb-10", "lb-4", "lb-7"],
  },
  {
    id: "mappa-3",
    name: "Útilega haust",
    icon: "Leaf",
    shared: true,
    blockIds: ["lb-6", "lb-8", "lb-13", "lb-5"],
  },
  {
    id: "mappa-4",
    name: "Fyrir Drekaskáta",
    icon: "BookMarked",
    shared: false,
    blockIds: ["lb-1", "lb-2", "lb-9", "lb-11"],
  },
  { id: "mappa-5", name: "Jólafundur", icon: "Snowflake", shared: false, blockIds: [] },
];
