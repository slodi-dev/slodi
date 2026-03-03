"use client";

import styles from "./HowItWorks.module.css";

interface Feature {
  icon: React.ReactNode;
  title: string;
  items: string[];
}

const features: Feature[] = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
    ),
    title: "Hugmyndabankinn",
    items: [
      "Leitaðu í safni af dagskrárhugmyndum",
      "Merktar með aldurshópum, hæfniþáttum og þemum",
      "Bættu við þínum eigin hugmyndum",
      "Vistaðu uppáhalds",
    ],
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
    title: "Dagskrárgerðin",
    items: [
      "Settu saman heildardagskrár úr hugmyndum",
      "Sjáðu tímaskipulag og yfirlitsáætlanir",
      "Deildu með teyminu þínu",
      "Prentaðu út eða sendu í tölvupósti",
    ],
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
    title: "Greiningin",
    items: [
      "Sjáðu myndrænt yfirlit yfir dagskrárval",
      "Fylgstu með fjölbreytni eftir hæfniþáttum",
      "Fáðu ráðleggingar um hvar má bæta",
      "Sjáðu framfarir með tímanum",
    ],
  },
];

export default function HowItWorks() {
  return (
    <section className={styles.howItWorks} aria-labelledby="how-it-works-heading">
      <div className={styles.container}>
        <h2 id="how-it-works-heading" className={styles.heading}>
          Hvernig virkar Slóði?
        </h2>

        <div className={styles.featuresGrid}>
          {features.map((feature, index) => (
            <div
              key={index}
              className={styles.featureCard}
              role="article"
              aria-label={`Eiginleiki: ${feature.title}`}
            >
              <div className={styles.cardIcon} aria-hidden="true">
                {feature.icon}
              </div>
              <h3 className={styles.cardTitle}>{feature.title}</h3>
              <ul className={styles.featureList}>
                {feature.items.map((item, itemIndex) => (
                  <li key={itemIndex} className={styles.featureItem}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
