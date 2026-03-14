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

        <figure className={styles.visual} aria-label="Slóði merki">
          <svg
            className={styles.logo}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 204.3 186.3"
            fill="currentColor"
            role="img"
            aria-label="Slóði"
          >
            <path d="m151 186.3-11.7-.1 2.9-2.3c18-14.4 25.7-31.2 20.7-45-3-8.1-10.8-16-22.1-22.1-7.8-4.2-14.4-6.9-33.6-13.5-12-4.1-18.9-7.4-21.6-10.3-2.2-2.4-2.4-4.2-.9-7.3 2.7-5.3 12.6-12.5 22.7-16.4l2.6-1-2 .2c-2.6.2-10.4 1.5-13.2 2.2-14.6 3.7-26.8 9.2-33.3 14.8-6.8 6-7.7 12.7-2.4 18.7 4.2 4.6 8.3 7.4 23.2 15.2 4.5 2.4 10.4 5.8 12.8 7.4 1.3.9 3.6 2.8 5.1 4.3 2.2 2.2 2.8 3 3.7 4.8.9 1.9 1 2.4 1.1 4.7.2 4.8-1.7 8.7-6.6 14-8.1 8.8-26.3 19.3-51.7 30-4 1.7-6.2 2-8.2 1.3-1.2-.5-3-2-3.5-3.1-.2-.4-8.2-24.1-17.7-52.8C1 81 0 77.8 0 76.1c0-2.2.6-3.6 2.2-5.1.5-.5 5-3.9 10-7.4 4.9-3.6 12.6-9.1 17-12.4 8.3-6 13-9.4 15.8-11.4.9-.6 8.5-6.2 16.9-12.3 8.4-6.2 16.4-12 17.7-12.9 1.3-1 3-2.2 3.8-2.8 11.2-8.1 15.3-11 16.2-11.4 1.3-.4 3.4-.5 4.8-.1.5.1 2.6 1.5 4.7 3 2 1.5 6 4.4 8.8 6.4 2.8 2 7.1 5.1 9.5 6.9 2.4 1.8 5.2 3.8 6.2 4.5 1.9 1.4 16 11.6 20.8 15.1 5.2 3.8 22.4 16.3 25.5 18.6 10 7.2 21.3 15.5 22.1 16.2 2.4 2.3 2.9 4.7 1.8 8.4-3.2 10.2-33.9 102-34.6 103.3-1 1.9-2.9 3.2-5.2 3.6-.7.1-6.5.1-13 0z" />
          </svg>
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
