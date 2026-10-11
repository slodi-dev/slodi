/**
 * Fixture data for Storybook. Nothing here talks to a backend: stories render
 * from these objects, and `.storybook/mocks/fetch.ts` serves the same objects to
 * any component that fetches on its own.
 *
 * The content is real Icelandic scout content rather than lorem ipsum, so text
 * length, diacritics and line breaks behave the way they do in the app.
 */
import type { Program, ContentComment } from "@/services/programs.service";
import type { User } from "@/services/users.service";
import type { Tag } from "@/services/tags.service";
import type { Workspace } from "@/services/workspaces.service";

/** An inline SVG placeholder, so image stories never hit the network. */
export function placeholderImage(label: string, hue = 142): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${hue} 45% 55%)"/><stop offset="1" stop-color="hsl(${hue + 20} 45% 30%)"/>
  </linearGradient></defs>
  <rect width="800" height="450" fill="url(#g)"/>
  <path d="M0 360 L160 220 L280 320 L420 160 L580 330 L700 240 L800 300 L800 450 L0 450Z" fill="hsl(${hue} 30% 20% / 0.55)"/>
  <text x="40" y="80" font-family="sans-serif" font-size="36" fill="white">${label}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const userMember: User = {
  id: "u-1",
  auth0_id: "auth0|sb-member",
  email: "sigga@skatar.is",
  name: "Sigríður Jónsdóttir",
  pronouns: "hún",
  preferences: null,
  permissions: "member",
};

export const userModerator: User = {
  ...userMember,
  id: "u-2",
  auth0_id: "auth0|sb-moderator",
  email: "gunnar@skatar.is",
  name: "Gunnar Þór Ólafsson",
  pronouns: "hann",
  permissions: "moderator",
};

export const userAdmin: User = {
  ...userMember,
  id: "u-3",
  auth0_id: "auth0|sb-admin",
  email: "halla@skatar.is",
  name: "Halla Björk Einarsdóttir",
  permissions: "admin",
};

export const users: User[] = [
  userMember,
  userModerator,
  userAdmin,
  {
    ...userMember,
    id: "u-4",
    auth0_id: "auth0|sb-4",
    email: "aron@skatar.is",
    name: "Aron Freyr Kristjánsson",
    pronouns: null,
    permissions: "viewer",
  },
];

export const workspace: Workspace = {
  id: "ws-1",
  name: "Skátafélagið Vífill",
  group_id: null,
};

export const tags: Tag[] = [
  { id: "t-1", name: "útivist" },
  { id: "t-2", name: "leikur" },
  { id: "t-3", name: "hópefli" },
  { id: "t-4", name: "rötun" },
  { id: "t-5", name: "náttúra" },
  { id: "t-6", name: "skyndihjálp" },
  { id: "t-7", name: "innileikur" },
  { id: "t-8", name: "sköpun" },
];

const author = { id: userMember.id, name: userMember.name, email: userMember.email };
const ws = { id: workspace.id, name: workspace.name };

export const comments: ContentComment[] = [
  {
    id: "c-1",
    body: "Prófuðum þetta með Drekaskátum í gær, þau elskuðu þetta!",
    created_at: "2026-09-14T18:30:00Z",
    user_id: "u-4",
    content_id: "p-1",
    author_name: "Aron Freyr Kristjánsson",
  },
  {
    id: "c-2",
    body: "Gott að hafa auka bönd með, þau slitna auðveldlega.",
    created_at: "2026-09-20T10:05:00Z",
    user_id: "u-2",
    content_id: "p-1",
    author_name: "Gunnar Þór Ólafsson",
  },
];

export const programKotturinn: Program = {
  id: "p-1",
  content_type: "program",
  name: "Kötturinn og músin",
  description:
    "Klassískur hlaupaleikur þar sem hópurinn myndar hring og köttur eltir mús inn og út úr hringnum. Frábær upphitun í byrjun fundar.",
  public: true,
  like_count: 12,
  liked_by_me: false,
  created_at: "2026-09-02T17:00:00Z",
  author_id: author.id,
  author_name: author.name,
  image: placeholderImage("Kötturinn og músin"),
  workspace_id: ws.id,
  author,
  workspace: ws,
  tags: [tags[1], tags[2]],
  comment_count: 2,
  instructions:
    "1. Allir mynda hring og haldast í hendur.\n2. Einn er köttur, annar mús.\n3. Hringurinn hjálpar músinni með því að lyfta höndum en hindrar köttinn.\n4. Þegar kötturinn nær músinni skipta þau um hlutverk.",
  equipment: [],
  duration_min: 10,
  duration_max: 20,
  prep_time_min: 0,
  prep_time_max: 5,
  age: ["Drekaskátar", "Fálkaskátar"],
  location: "Íþróttasalur eða tún",
  count_min: 10,
  count_max: 30,
  price: 0,
  media: null,
  comments,
  review_state: "approved",
  review_note: null,
  hidden_at: null,
};

export const programRatleikur: Program = {
  ...programKotturinn,
  id: "p-2",
  content_type: "event",
  name: "Ratleikur um hverfið",
  description:
    "Skátarnir fá kort og áttavita og leysa þrautir á stöðvum víðs vegar um hverfið. Hentar vel til að æfa kortalestur.",
  like_count: 34,
  liked_by_me: true,
  created_at: "2026-08-21T12:00:00Z",
  image: placeholderImage("Ratleikur um hverfið", 177),
  tags: [tags[0], tags[3], tags[4]],
  equipment: ["Kort af hverfinu", "Áttavitar", "Blýantar", "Þrautablöð"],
  duration_min: 60,
  duration_max: 90,
  prep_time_min: 30,
  prep_time_max: 60,
  age: ["Fálkaskátar", "Dróttskátar"],
  location: "Hverfið í kringum skátaheimilið",
  count_min: 6,
  count_max: 40,
  price: 500,
  media: {
    images: [{ name: "kort.svg", url: placeholderImage("Kort", 177) }],
    documents: [
      { name: "Þrautablað.pdf", url: "#thrautablad", content_type: "application/pdf" },
      { name: "Kort-af-hverfinu.pdf", url: "#kort", content_type: "application/pdf" },
    ],
  },
  review_state: "unreviewed",
};

export const programSkyndihjalp: Program = {
  ...programKotturinn,
  id: "p-3",
  content_type: "task",
  name: "Skyndihjálparstöðvar",
  description:
    "Fjórar stöðvar þar sem skátarnir æfa stöðugar hliðarlegur, umbúðir, endurlífgun og að hringja í 112.",
  like_count: 5,
  image: null,
  tags: [tags[5]],
  equipment: ["Sjúkrakassi", "Teygjubindi", "Æfingadúkka"],
  duration_min: 45,
  duration_max: 45,
  age: ["Dróttskátar", "Rekkaskátar"],
  location: "Skátaheimilið",
  count_min: 8,
  count_max: 24,
  price: null,
  review_state: "rejected",
  review_note: "Vantar öryggisleiðbeiningar fyrir endurlífgunarstöðina.",
};

export const programLongText: Program = {
  ...programKotturinn,
  id: "p-4",
  name: "Næturganga um Heiðmörk með vasaljósum, stjörnuskoðun og sögum af álfum og huldufólki við varðeldinn",
  description:
    "Löng lýsing sem prófar hvernig textinn brotnar. Við göngum frá Elliðavatni inn í Heiðmörk eftir að skyggja tekur, stöðvum við Hjallaflatir þar sem hver flokkur segir eina þjóðsögu, skoðum stjörnumerkin þegar heiðskírt er og endum við varðeld með heitu kakói. Gangan hentar eldri skátum og krefst þess að foringjar hafi kynnt sér leiðina í dagsbirtu.",
  like_count: 1048,
  image: placeholderImage("Næturganga", 220),
  tags: tags.slice(0, 7),
  age: ["Dróttskátar", "Rekkaskátar", "Róverskátar", "Vættaskátar"],
  location: "Heiðmörk, upphaf við bílastæðið hjá Elliðavatnsbæ",
  price: 2500,
};

export const programs: Program[] = [
  programKotturinn,
  programRatleikur,
  programSkyndihjalp,
  programLongText,
  {
    ...programKotturinn,
    id: "p-5",
    name: "Hnútakeppni",
    description: "Flokkarnir keppa í að hnýta pelastikk, réttan hnút og hestahnút á tíma.",
    image: placeholderImage("Hnútakeppni", 30),
    tags: [tags[1]],
    like_count: 8,
  },
  {
    ...programKotturinn,
    id: "p-6",
    name: "Kvöldvaka með söngvum",
    description: "Skátasöngvar, skemmtiatriði frá hverjum flokki og kakó.",
    image: placeholderImage("Kvöldvaka", 270),
    tags: [tags[7]],
    like_count: 21,
  },
];
