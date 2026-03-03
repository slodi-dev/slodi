# Slóði

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.10+-brightgreen.svg)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![GitHub issues](https://img.shields.io/github/issues/slodi-dev/slodi)](https://github.com/slodi-dev/slodi/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/slodi-dev/slodi)](https://github.com/slodi-dev/slodi/pulls)
[![Last commit](https://img.shields.io/github/last-commit/slodi-dev/slodi)](https://github.com/slodi-dev/slodi/commits/main)

Slóði er Gilwell-verkefni sem [Halldór Valberg Aðalbjargarson](https://github.com/halldorvalberg) og [Signý Kristín Sigurjónsdóttir](https://github.com/signyk) sjá um. Það er opinn hugbúnaður sem er hannaður til að auðvelda dagskrárgerð fyrir skátaforingja. Kerfið styður foringja og hópa við að búa til, deila og stjórna viðfangsefnum og tryggir um leið að skátar fái fjölbreytta og vel samsetta dagskrá.

## Efnisyfirlit

- [Hvernig Slóði virkar](#hvernig-slóði-virkar)
- [Framtíðarsýn](#framtíðarsýn)
- [Helstu eiginleikar](#helstu-eiginleikar)
- [Tæknistaflinn](#tæknistaflinn)
- [Uppsetning](#uppsetning)
- [Tímalína](#tímalína)
- [Framlög](#framlög)
- [Samfélag](#samfélag)
- [Vefsíða verkefnisins](#vefsíða-verkefnisins)
- [Leyfi](#leyfi)

## Hvernig Slóði virkar

Slóði er byggt í kringum þrjár meginhugtök: **hópa**, **vinnusvæði** og **dagskrárbankann**.

**Hópar** eru skipulagseiningurnar — til dæmis skátafélag eða -sveit. Foringjar í sama hópi geta unnið saman að dagskrárgerð og deilt vinnusvæðum.

**Vinnusvæði** eru þar sem dagskrárgerðin á sér stað. Hvert vinnusvæði geymir forrit, viðburði og verkefni sem tilheyra tilteknum hópi eða tímabili — til dæmis einn vetrarvertíð. Efni er skipulagt í þrjú stig:

**Dagskrárbankinn** er sameiginlegt opið vinnusvæði þar sem foringjar geta skoðað og nýtt sér viðfangsefni sem aðrir hafa lagt til. Þú getur afritað viðfangsefni úr bankanum yfir í þitt eigið vinnusvæði og sérsniðið þau, eða birt viðfangsefni úr þínu vinnusvæði í bankann til að deila þeim með öðrum foringjum.

## Framtíðarsýn

Markmið verkefnisins er að styðja við skátaforingja með því að bjóða upp á verkfæri sem gera dagskrárgerð einfaldari, snjallari og samvinnuþýðari. Með því að geyma viðfangsefni, gera kleift að búa til skipulagða dagskrá og veita innsýn í fjölbreytni dagskrárinnar tryggir Slóði að allir skátar njóti góðs af ríkulegri og fjölbreyttri reynslu.

## Helstu eiginleikar

### Dagskrárbankinn

Miðlægt safn verkefna og leikja með skýrum leiðbeiningum, aldursviðmiðum, nauðsynlegum búnaði, tímaáætlun og ábendingum frá öðrum foringjum.

### Dagskrárgerð

„Drag-and-drop“ verkfæri til að setja saman heildardagskrár (fundi, útilegur eða mót) úr viðfangsefnum. Hægt er að skipuleggja dagskrár eftir tíma, þema eða flokkum.

### Sniðmát og dæmi (fyrirhugað)

Tilbúin sniðmát fyrir algenga skátaviðburði eins og vikulega fundi, færnimerkjadagskrár og útilegur. Foringjar geta notað þau beint eða sérsniðið þau að sínum þörfum.

### Samvinnuverkfæri

Möguleiki á að deila dagskrám og viðfangsefnum með öðrum foringjum, flokkum eða sveitum. Inniheldur stuðning við athugasemdir, tillögur og endurnotkun á sameiginlegum áætlunum.

### Leit og merking

Ítarleg leitarverkfæri með töggum og síum sem gera foringjum kleift að finna viðfangsefni eftir aldurshópi, erfiðleikastigi, staðsetningu, búnað eða þema.

### Greiningartæki fyrir dagskrá

Verkfæri til að fara yfir liðna viðburði og greina fjölbreytni dagskrár. Hjálpar foringjum að tryggja að skátar fái jafna blöndu af viðfangsefnum, svo sem eftir ÆSKA og þroskasviðum.

## Tæknistaflinn

**Bakendi:** Python 3.10+ með FastAPI, SQLAlchemy 2.0 og Alembic

**Framendi:** Next.js 15 (React 19, TypeScript)

**Gagnagrunnur:** PostgreSQL 16

**Auðkenning:** Auth0

**Tölvupóstur:** Resend

**Skyndiminni:** aiocache (Redis)

**Uppsetning:** Docker Compose (bakendi), Vercel (framendi)

## Uppsetning

Slóði er skipulagt í tvo meginþætti: bakenda og framenda. Ítarlegar leiðbeiningar um þróunarumhverfið eru í undirmöppunum:

- [backend/README.md](backend/README.md) — Python/FastAPI bakendi og PostgreSQL gagnagrunnur
- [frontend/README.md](frontend/README.md) — Next.js framendi

### Forsendur

- [Docker](https://www.docker.com/) og Docker Compose
- [Node.js](https://nodejs.org/) 20+
- [Python](https://www.python.org/) 3.10+ og [`uv`](https://docs.astral.sh/uv/)
- Auth0 reikningur (sjá `.env.example` í hvorum þætti)

### Skjótt í gang

```bash
# Bakendi — ræsir PostgreSQL og vefþjón
cd backend
cp .env.example .env        # Fylltu inn Auth0 og gagnagrunnsstillingar
make docker-run

# Framendi — í nýju skipanagluggaflipa
cd frontend
cp .env.example .env.local  # Fylltu inn Auth0 stillingar
npm install
npm run dev
```

Framendinn keyrir á `http://localhost:3000` og bakendinn á `http://localhost:8000`.

## Tímalína

**Kynning á verkefni:** janúar 2026 á viðburðinum Neista. ✅

- Smiðja um dagskrárgerð og safna endurgjöf frá foringjum.

**Kynning og útgáfa á lágmarksafurð:** mars 2026 á Skátaþingi. ✅

- Markmiðið er að kynna lágmarksafurðina fyrir sjálfboðaliðum skátahreyfingarinnar.

- Vinnuhópar endurnýjaðir.

**Kynning á verkefni:** ágúst 2026 á Kveikju.

- Kynna verkfærið fyrir stjórnum og foringjum félags.

- Vinnuhópar endurnýjaðir.

**Opinber útgáfa:** apríl 2027.

- Vinnuhópar ljúka störfum.

## Framlög

Slóði er samfélagsdrifið verkefni. Framlög frá forriturum, hönnuðum og skátum sem vilja bæta verkfæri til dagskrárgerðar eru vel þegin.

1. Búðu til afrit (e. fork) af safninu (e. repository)

2. Búðu til nýja grein (e. feature branch)

3. Sendu inn sameiningarbeiðni (e. pull request)

Sjá [docs/git-branch-naming-conventions.md](docs/git-branch-naming-conventions.md) fyrir leiðbeiningar um nafnagjöf á greinar.

Ítarlegri leiðbeiningum fyrir framlög verður bætt við síðar.

## Samfélag

Slóði er þróaður fyrir og með skátasamfélaginu.

- Taktu þátt í umræðunum á [GitHub Discussions](https://github.com/slodi-dev/slodi/discussions)
- Tilkynntu villur og óskaðu eftir nýjum eiginleikum í [Issues](https://github.com/slodi-dev/slodi/issues)
- Leggðu til hugmyndir, þýðingar eða dagskrárefni

## Vefsíða verkefnisins

Þú getur fylgst með verkefninu og nálgast vefsíðuna á:

- [www.slodi.is](https://slodi.is)

Á vefsíðunni verða birtar uppfærslur, leiðbeiningar og að lokum endanleg útgáfa af Slóða.

## Leyfi

Þetta verkefni er með GPLv3-leyfi, sem tryggir að Slóði verði áfram opinn og í eigu samfélagsins.
