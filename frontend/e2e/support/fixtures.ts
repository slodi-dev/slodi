/**
 * The seeded data the journeys rely on.
 *
 * This is the other half of `backend/scripts/seed_e2e.py`: the ids and names
 * here must match it exactly. Change both in the same commit.
 */

export type Persona = {
  /** The token `sub`, which the backend stores as `auth0_id`. */
  sub: string;
  name: string;
  email: string;
};

export const PERSONAS = {
  programOwner: {
    sub: "e2e|program-owner",
    name: "Sigurður Prófari",
    email: "owner@e2e.example.com",
  },
  communityMember: {
    sub: "e2e|community-member",
    name: "Anna Prófari",
    email: "member@e2e.example.com",
  },
  reviewer: {
    sub: "e2e|reviewer",
    name: "Rýnir Prófari",
    email: "reviewer@e2e.example.com",
  },
  /** Platform member and an editor of the bank; owns the "Sveitin Prófun" workspace. */
  editor: {
    sub: "e2e|editor",
    name: "Edda Prófari",
    email: "editor@e2e.example.com",
  },
  /** Platform admin. */
  admin: {
    sub: "e2e|admin",
    name: "Ari Prófari",
    email: "admin@e2e.example.com",
  },
} satisfies Record<string, Persona>;

export const BANK_WORKSPACE_ID = "00000000-0000-4000-8000-0000000000b0";

export const OWNER_TASK = {
  id: "00000000-0000-4000-8000-0000000000a1",
  name: "Fánaleikur í myrkri",
  instructionSteps: [
    "Skiptið hópnum í tvö lið.",
    "Hvort lið fær eitt vasaljós.",
    "Liðið sem finnur fánann fyrst vinnur.",
  ],
  documentName: "Leikreglur.pdf",
} as const;

export const LIKEABLE_TASK = {
  id: "00000000-0000-4000-8000-0000000000a2",
  name: "Hnútakeppni",
} as const;

export const UNREVIEWED_TASK = {
  id: "00000000-0000-4000-8000-0000000000a3",
  name: "Óyfirfarin hugmynd",
} as const;

/** Rows the route crawler (e2e/crawl/) opens `/programs/[id]` and friends with. */
export const CRAWL = {
  programId: "00000000-0000-4000-8000-0000000000a4",
  eventId: "00000000-0000-4000-8000-0000000000a5",
  /** Hidden by a moderator; authored by the community member. */
  hiddenTaskId: "00000000-0000-4000-8000-0000000000a6",
  editorWorkspaceId: "00000000-0000-4000-8000-0000000000b1",
  /** Heiðursorðla round 1, whose migration-made id the seed pins. */
  puzzleId: "00000000-0000-4000-8000-0000000000c1",
} as const;
