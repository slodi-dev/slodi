"use client";

import styles from "./OriginStory.module.css";

export default function OriginStory() {
  const challenges = [
    {
      id: 1,
      title: "Tímapressan",
      description:
        "Foringjar eru oft í fullu starfi eða fullu námi sem þau stunda foringjastörf samhliða. Því getur verið erfitt að finna sér tíma til að skipuleggja metnaðarfulla dagskrá.",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      id: 2,
      title: "Hugmyndaleysið",
      description:
        "Stundum er erfitt að láta sér detta í hug nýjar og spennandi hugmyndir fyrir skátafundi.",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      ),
    },
    {
      id: 3,
      title: "Fjölbreytni",
      description:
        "Hvernig veit ég hvort starfið mitt sé að uppfylla allar kröfur metnaðarfulls skátastarfs?",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
    {
      id: 4,
      title: "Samstarfserfiðleikar",
      description:
        "Erfitt að deila og geyma dagskrárhugmyndir á milli sveita og félaga ár eftir ár.",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    {
      id: 5,
      title: "Óskipulagt safn",
      description:
        "Google Drive möppur, tölvupóstar, möppur fullar (eða hálf tómar) af gamalli útprentaðri dagskrá",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      id: 6,
      title: "Reynsla týnist",
      description:
        "Þegar foringjar hætta eða skipta um sveit hverfur oft öll þeirra reynsla og þekking með þeim.",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      ),
    },
  ];

  return (
    <section className={styles.originStory} aria-labelledby="origin-heading">
      <div className={styles.container}>
        <h2 id="origin-heading" className={styles.heading}>
          Hvaðan kom hugmyndin?
        </h2>

        <p className={styles.introduction}>
          Slóði sprettur út frá þörf sem margir skátaforingjar hafa upplifað:
        </p>

        <div className={styles.challengeGrid}>
          {challenges.map((challenge) => (
            <div key={challenge.id} className={styles.challengeCard}>
              <div className={styles.iconWrapper} aria-hidden="true">
                {challenge.icon}
              </div>
              <h3 className={styles.challengeTitle}>{challenge.title}</h3>
              <p className={styles.challengeDescription}>{challenge.description}</p>
            </div>
          ))}
        </div>

        <div className={styles.conclusion}>
          <p className={styles.conclusionText}>
            Við vildum búa til verkfæri sem gerir dagskrárgerð <strong>einfaldari</strong>,
            <strong> skemmtilegri</strong> og <strong>markvissari</strong>.
          </p>
        </div>
      </div>
    </section>
  );
}
