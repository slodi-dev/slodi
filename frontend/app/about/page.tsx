import styles from "./about.module.css";
import AboutHero from "./components/AboutHero";
import OriginStory from "./components/OriginStory";
import VisionMission from "./components/VisionMission";
import HowItWorks from "./components/HowItWorks";
import OpenSource from "./components/OpenSource";
import TeamSection from "./components/TeamSection";
import FeaturesSection from "./components/FeaturesSection";
import TimelineSection from "./components/TimelineSection";

export default function AboutPage() {
  return (
    <div className={styles.page}>
      {/* Introduction */}
      <div className={styles.intro}>
        <p className={styles.paragraph}>
          Slóði er Gilwell-verkefni sem <strong>Halldór Valberg Aðalbjargarson</strong> og{" "}
          <strong>Signý Kristín Sigurjónsdóttir</strong> sjá um. Kerfið styður foringja og hópa við
          að búa til, deila og stjórna viðfangsefnum og tryggir um leið að skátar fái fjölbreytta og
          vel samsetta dagskrá.
        </p>
      </div>

      {/* Hero Section */}
      <AboutHero />

      {/* Origin Story */}
      <OriginStory />

      {/* Vision & Mission */}
      <VisionMission />

      {/* How It Works */}
      <HowItWorks />

      {/* Open Source */}
      <OpenSource />

      {/* Team Section */}
      <TeamSection />

      {/* Features Section */}
      <FeaturesSection />

      {/* Timeline Section */}
      <TimelineSection />

      {/* Call to Action */}
      <div className={styles.cta}>
        <h2 className={styles.ctaTitle}>Viltu vera hluti af verkefninu?</h2>
        <p className={styles.ctaParagraph}>
          Slóði er opinn hugbúnaður og við tökum á móti öllum sem vilja leggja sitt af mörkum. Hvort
          sem þú ert forritari, hönnuður, skátaformaður eða hefur bara áhuga á verkefninu, þá ertu
          velkomin/n í hópinn!
        </p>
        <div className={styles.ctaButtons}>
          <a
            href="https://github.com/slodi-project"
            className={styles.ctaButtonPrimary}
            target="_blank"
            rel="noopener noreferrer"
          >
            Skoða á GitHub
          </a>
          <a href="mailto:slodi@slodi.is" className={styles.ctaButtonSecondary}>
            Hafa samband
          </a>
        </div>
      </div>
    </div>
  );
}
