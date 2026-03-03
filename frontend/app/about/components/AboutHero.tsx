"use client";

import styles from "./AboutHero.module.css";

export default function AboutHero() {
  return (
    <section className={styles.hero} aria-labelledby="about-heading">
      <div className={styles.container}>
        <div className={styles.content}>
          <h1 id="about-heading" className={styles.heading}>
            Um Slóði
          </h1>

          <p className={styles.subheading}>
            Opinn hugbúnaður fyrir skipulega dagskrárgerð í skátastarfi
          </p>

          <p className={styles.description}>
            Slóði er verkfæri sem getur hjálpað skátaforingjum að skipuleggja fjölbreytta og
            markvissa dagskrá. Verkefnið er byggt af skátaforingjum, fyrir skátaforingja, og er
            opinn hugbúnaður sem allir geta notað og stuðlað að.
          </p>
        </div>

        <figure className={styles.visual} aria-label="Skátamerki">
          <div className={styles.iconWrapper}>
            <svg
              className={styles.icon}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              role="img"
              aria-label="Áttaviti tákn"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>

            <div className={styles.badgeWrapper}>
              <div className={styles.badge}>
                <span className={styles.badgeText}>Opinn hugbúnaður</span>
              </div>
              <div className={styles.badge}>
                <span className={styles.badgeText}>Ókeypis</span>
              </div>
              <div className={styles.badge}>
                <span className={styles.badgeText}>Fyrir alla</span>
              </div>
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
}
