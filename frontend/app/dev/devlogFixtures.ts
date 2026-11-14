import type { DevlogMeta } from "@/lib/devlogs";

/** Story fixtures for the devlog list and post. Newest first, as lib/devlogs.ts returns them. */

/** "Today" for the stories, so the "Nýtt" marker doesn't drift as the calendar moves. */
export const TODAY = "2026-10-12";

export const LONG_TITLE_POST: DevlogMeta = {
  slug: "langt",
  title:
    "Mjög langur titill á þróunarfærslu sem lýsir öllum breytingunum á dagskrárbankanum, síunum og yfirferðinni í einu",
  date: "2026-09-05",
  author: "Guðmundur Hrafnkell Þorvaldsson Kjerúlf",
  tags: ["dagskrárbanki", "síur", "yfirferð", "aðgengi", "afköst", "hönnunarkerfi"],
  summary:
    "Þessi samantekt er viljandi löng til að sjá hvernig kortið brotnar þegar textinn nær yfir margar línur og fer langt út fyrir það sem venjuleg færsla myndi innihalda.",
};

export const POSTS: DevlogMeta[] = [
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
];

/** An older page, as `/api/devlogs` returns it. */
export const OLDER_POSTS: DevlogMeta[] = [
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

/** A post body in Markdown, for the post view. */
export const POST_MARKDOWN = `Frá og með deginum í dag fer ný dagskrá ekki beint í bankann. Hún fer fyrst til Dagskrárstjórnarteymisins, sem les hana yfir, gefur ábendingar og samþykkir hana þegar hún er tilbúin.

## Af hverju yfirferð?

Bankinn á að vera staður sem þú getur treyst. Þegar þú finnur ratleik fyrir Drekaskáta viltu vita að einhver hefur lesið öryggisleiðbeiningarnar og að aldursbilið stemmi.

- Þú sérð stöðuna á þinni dagskrá á yfirlitinu þínu.
- Ábendingar birtast við dagskrána sjálfa, ekki í tölvupósti.
- Drög eru áfram þín eigin þar til þú sendir þau í yfirferð með \`Senda í yfirferð\`.

> Markmiðið er ekki að stoppa hugmyndir, heldur að hjálpa þeim alla leið.

## Hvað kemur næst?

Næst tengjum við yfirferðina við [leikjatorgið](https://slodi.is/leikir), svo leikir fari sömu leið og önnur dagskrá.
`;
