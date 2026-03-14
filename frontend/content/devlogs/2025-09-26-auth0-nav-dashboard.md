---
title: "Auth0 v4.10 innleiðing, farsímavalmynd og /dev bloggsíða"

date: 2025-09-26

author: "Halldór"

tags: ["devlog", "auth"]

summary: "Fínstillt auðkenning með Auth0 v4.10, betrumbætt UX í farsímavalmynd og ný /dev síða með óendanlegri flettingu."
---

## Markmið

- Uppfæra auðkenningu yfir á Auth0 v4.10 og einfalda leiðslur (middleware-first).
- Hönnun og innleiðing á notendavænni farsímavalmynd með íslenskum hnöppum „Skrá inn“ / „Skrá út“.
- Setja upp `/dev` yfirlitssíðu fyrir devlog-færslur með óendanlegri flettingu.
- Bæta devlog-síðu með haus (titill, dagsetning, höfundur, samantekt), leiðsögn (Til baka, Fyrri, Næsta) og betra lestrarsniði án utanaðkomandi Markdown-bókasafna.

## Aðgerðir

- **Auth0 v4.10**
  - Nýttum `auth0.middleware()` og hreinsuðum sérhæfðar route-handlers.
  - Uppfærðum Callback og Logout URLs fyrir dev og prod.
  - Leystum prod redirect villu með stillingu á `APP_BASE_URL`.

- **Farsímavalmynd**
  - Bætt notendaupplifun: Efst birtist notendaprófíll þegar innskráður, fellur niður þegar ekki.
  - Stærri texti í valmyndaratriðum, engin litabreyting á texta.
  - GitHub-hlekkur undirstrikaður með ytri táknmynd á eftir texta.
  - „Skrá inn“ / „Skrá út“ hnappur festur neðst í valmynd.

- **/dev yfirlit og devlog-síða**
  - Lesum markdown-færslur af skráarkerfi og sýnum 10 færslur í senn með óendanlegri flettingu.
  - Byggðum léttan Markdown-þýðanda (`mdToHtmlLite`) fyrir haus, lista, kóða og tilvitnanir.
  - Bætt haus á færslusíðu: **Titill**, **Dags:** dagsetning, **Höfundur:** höfundur, **Samantekt**.
  - Bætt leiðsögn með hnöppum: **Til baka**, **Fyrri**, **Næsta**.
  - Lágmarks Tailwind-stílar í `.md-content` til að líta út sem snyrtileg bloggfærsla.

## Niðurstöður

- Inn- og útskráning virkar á dev og prod með réttri tilvísun.
- Ný farsímavalmynd með íslenskum hnöppum og einfaldara flæði.
- `/dev` sýnir devlog-færslur snyrtilega og hleður fleiri mjúklega.
- Devlog-síður sýna haus og innihald á lesvænan hátt og bjóða upp á flakk milli færslna.

## Athugasemdir

- Leystum helstu villur: `APP_BASE_URL` í prod og `params` await í Next 15.
- Gott að íhuga stuðning við myndir og töflur í markdown-lite í framtíðinni.
- Muna að flytja devlogs inn í verkefnið eða bæta build-skriftum til að afrita þau fyrir Vercel.
