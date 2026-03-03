"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./TeamSection.module.css";

interface Contributor {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

interface ContributorsResponse {
  contributors: Contributor[];
  cached?: boolean;
  error?: string;
}

export default function TeamSection() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchContributors() {
      try {
        const response = await fetch("/api/contributors");
        const data: ContributorsResponse = await response.json();

        if (data.error) {
          setError(data.error);
        }

        if (data.contributors) {
          setContributors(data.contributors);
        }
      } catch (err) {
        setError("Gat ekki sótt upplýsingar um framlög");
        console.error("Error fetching contributors:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchContributors();
  }, []);

  return (
    <section className={styles.teamSection} aria-labelledby="team-heading">
      <div className={styles.container}>
        <h2 id="team-heading" className={styles.heading}>
          Hver er að vinna að þessu?
        </h2>

        <p className={styles.introduction}>
          Slóði er samstarfsverkefni sem hefur þróast með aðstoð frá:
        </p>

        <div className={styles.leadersSection}>
          <h3 className={styles.subheading}>Aðalverkefnisstjórar</h3>
          <div className={styles.leadersList}>
            <div className={styles.leader}>
              <strong>Halldór Valberg Aðalbjargarson</strong> - Forritun og hönnun
            </div>
            <div className={styles.leader}>
              <strong>Signý Kristín Sigurjónsdóttir</strong> - Bakendi og gagnagrunnshönnun
            </div>
          </div>
        </div>

        <div className={styles.contributorsSection}>
          <h3 className={styles.subheading}>Framlög á GitHub</h3>

          {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner} aria-label="Hleður..." />
              <p>Sæki upplýsingar um framlagsaðila...</p>
            </div>
          )}

          {error && !loading && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}

          {!loading && contributors.length > 0 && (
            <div className={styles.contributorsGrid}>
              {contributors.map((contributor) => (
                <a
                  key={contributor.login}
                  href={contributor.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.contributorCard}
                  aria-label={`${contributor.login} á GitHub`}
                >
                  <Image
                    src={contributor.avatar_url}
                    alt={`${contributor.login} avatar`}
                    className={styles.avatar}
                    width={80}
                    height={80}
                  />
                  <div className={styles.contributorInfo}>
                    <div className={styles.contributorName}>@{contributor.login}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className={styles.callToAction}>
          <h3 className={styles.ctaHeading}>Þú getur orðið hluti af teyminu!</h3>
          <p className={styles.ctaText}>
            Við erum alltaf að leita að fólki sem vill hjálpa til - hvort sem það er með hugmyndum,
            kóða, hönnun, eða bara að prófa verkfærið.
          </p>
        </div>
      </div>
    </section>
  );
}
