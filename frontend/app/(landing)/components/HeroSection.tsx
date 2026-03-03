"use client";

import Link from "next/link";
import styles from "./HeroSection.module.css";

interface HeroSectionProps {
  onEmailSignupClick?: () => void;
}

export default function HeroSection({ onEmailSignupClick }: HeroSectionProps) {
  const scrollToContent = () => {
    window.scrollTo({
      top: window.innerHeight,
      behavior: "smooth",
    });
  };

  return (
    <section className={styles.hero} aria-label="Aðalkynning">
      <div className={styles.container}>
        <div className={styles.content}>
          <h1 className={styles.heading}>
            Slóði
            <span className={styles.subtitle} aria-label="Undirtitill">
              Meira en bara dagskrárvefur
            </span>
          </h1>

          <p className={styles.subheading}>
            Markmið Slóða er að styðja við foringja í skátastarfi með því að gera dagskrárgerð{" "}
            <strong>einfaldari</strong>, <strong>markvissari</strong> og{" "}
            <strong>skipulagðari</strong>.
          </p>

          <p className={styles.description}>
            Slóði er opinn hugbúnaður sem hjálpar skátaforingjum að skipuleggja dagskrár, deila
            hugmyndum og fylgjast með fjölbreytni í starfinu. Sameiginlegur hugmyndabanki og
            verkfæri til að gera dagskrárgerð einfaldari og markvissari.
          </p>

          <nav className={styles.cta} aria-label="Aðalverkefni">
            <button
              className={styles.primaryButton}
              onClick={onEmailSignupClick}
              type="button"
              aria-label="Skráðu þig á póstlista til að fá fréttir"
            >
              Skráðu þig á póstlista
            </button>

            <Link
              href="/programs"
              className={styles.secondaryButton}
              aria-label="Skoða hugmyndabanka forritanna"
            >
              Skoða hugmyndabankann
              <svg
                className={styles.arrowIcon}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
          </nav>
        </div>

        <figure className={styles.visual} aria-label="Skátalíkan">
          {/* Placeholder for hero image or illustration */}
          <div className={styles.placeholder}>
            <svg
              className={styles.placeholderIcon}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              role="img"
              aria-label="Kort tákn"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </div>
        </figure>
      </div>

      <button
        className={styles.scrollIndicator}
        onClick={scrollToContent}
        type="button"
        aria-label="Skruna niður til að sjá meira efni"
        title="Skruna niður"
      >
        <svg
          className={styles.chevronIcon}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </section>
  );
}
