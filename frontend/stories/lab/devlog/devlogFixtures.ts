import type { DevlogLabPost } from "./DevlogLab";

/**
 * The fixture posts from app/dev/DevlogClient.stories.tsx, plus a few more in the same voice so
 * the timeline has several months to group. Newest first, as lib/devlogs.ts returns them.
 */

/** "Today" for the stories, so the "Nýtt" marker doesn't drift as the calendar moves. */
export const TODAY = "2026-10-12";

export const LONG_TITLE_POST: DevlogLabPost = {
  slug: "langt",
  title:
    "Mjög langur titill á þróunarfærslu sem lýsir öllum breytingunum á dagskrárbankanum, síunum og yfirferðinni í einu",
  date: "2026-09-05",
  author: "Guðmundur Hrafnkell Þorvaldsson Kjerúlf",
  tags: ["dagskrárbanki", "síur", "yfirferð", "aðgengi", "afköst", "hönnunarkerfi"],
  summary:
    "Þessi samantekt er viljandi löng til að sjá hvernig kortið brotnar þegar textinn nær yfir margar línur og fer langt út fyrir það sem venjuleg færsla myndi innihalda.",
};

export const POSTS: DevlogLabPost[] = [
  {
    slug: "yfirferd-komin",
    title: "Yfirferð er komin í loftið",
    date: "2026-10-02",
    author: "Halldór Valberg",
    tags: ["yfirferð", "útgáfa"],
    summary: "Dagskrárstjórnarteymið getur nú farið yfir nýjar hugmyndir í bankanum.",
  },
  {
    slug: "leikir",
    title: "Leikjatorgið opnar",
    date: "2026-09-14",
    author: "Signý Kristín",
    tags: ["leikir"],
    summary: "Heiðursorðla, Hörpuhopp, Arnór-Clicker og Laddí-bird á einum stað.",
    cover: "/leikir/laddi-bird/img/BG.png",
  },
  LONG_TITLE_POST,
  {
    slug: "dokkt-thema",
    title: "Dökkt þema og sveitarlitir",
    date: "2026-08-30",
    summary: "Veldu þema og lit þinnar sveitar í stillingum.",
  },
  {
    slug: "sveitasidur",
    title: "Sveitirnar fá sína eigin síðu",
    date: "2026-07-21",
    author: "Signý Kristín",
    tags: ["sveitir", "útgáfa"],
    summary: "Hver sveit heldur nú utan um sína dagskrá og sína foringja á einum stað.",
  },
  {
    slug: "hradari-leit",
    title: "Leitin í bankanum er orðin hraðari",
    date: "2026-06-03",
    author: "Halldór Valberg",
    tags: ["dagskrárbanki", "afköst"],
    summary: "Niðurstöðurnar birtast á meðan þú skrifar, líka á hægri tengingu í símanum.",
  },
  {
    slug: "fyrsta-faersla",
    title: "Fyrsta færslan: af hverju Slóði?",
    date: "2026-01-10",
    author: "Halldór Valberg",
    tags: ["saga"],
    summary: "Gamli dagskrárvefurinn var kominn til ára sinna.",
  },
];

/** The server has more than the first page: the list offers older posts. */
export const TOTAL_WITH_MORE = POSTS.length + 5;
