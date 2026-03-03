"use client";

import styles from "./VisionMission.module.css";

interface VisionCard {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const visionCards: VisionCard[] = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
        />
      </svg>
    ),
    title: "Aðgengi",
    description: "Gera gæðadagskrár aðgengilegar öllum foringjum, óháð reynslu eða tíma.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
        />
      </svg>
    ),
    title: "Fjölbreytni",
    description:
      "Hjálpa foringjum að skapa fjölbreytta og vel ígrunduð skátastarf sem nær yfir alla hæfniþætti.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
    title: "Samfélag",
    description: "Byggja upp samfélag þar sem foringjar geta lært hver af öðrum og deilt reynslu.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
    title: "Gagnsæi",
    description: "Vera opinn og aðgengilegur hugbúnaður sem er í eigu skátasamfélagsins.",
  },
];

export default function VisionMission() {
  return (
    <section className={styles.visionMission} aria-labelledby="vision-heading">
      <div className={styles.container}>
        <h2 id="vision-heading" className={styles.heading}>
          Markmið okkar
        </h2>

        <div className={styles.cardsGrid}>
          {visionCards.map((card, index) => (
            <div
              key={index}
              className={styles.visionCard}
              role="article"
              aria-label={`Markmið: ${card.title}`}
            >
              <div className={styles.cardIcon} aria-hidden="true">
                {card.icon}
              </div>
              <h3 className={styles.cardTitle}>{card.title}</h3>
              <p className={styles.cardDescription}>{card.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
