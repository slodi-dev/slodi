import { BookOpen, Hammer, ClipboardList, Users, Search, BarChart3 } from "lucide-react";
import styles from "../about.module.css";

export default function FeaturesSection() {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Helstu eiginleikar</h2>
      <div className={styles.featureGrid}>
        <div className={styles.featureCard}>
          <BookOpen className={styles.featureIcon} />
          <h3 className={styles.featureTitle}>Dagskrárbankinn</h3>
          <p className={styles.featureText}>
            Miðlægt safn verkefna og leikja með skýrum leiðbeiningum, aldursviðmiðum, nauðsynlegum
            búnaði, tímaáætlun og ábendingum frá öðrum foringjum.
          </p>
          <span className={`${styles.statusBadge} ${styles.statusInProgress}`}>Í vinnslu</span>
        </div>

        <div className={styles.featureCard}>
          <Hammer className={styles.featureIcon} />
          <h3 className={styles.featureTitle}>Dagskrárgerð</h3>
          <p className={styles.featureText}>
            &ldquo;Drag-and-drop&rdquo; verkfæri til að setja saman heildardagskrár (fundi, útilegur
            eða mót) úr viðfangsefnum. Hægt er að skipuleggja dagskrár eftir tíma, þema eða flokkum.
          </p>
          <span className={`${styles.statusBadge} ${styles.statusPlanned}`}>Fyrirhugað</span>
        </div>

        <div className={styles.featureCard}>
          <ClipboardList className={styles.featureIcon} />
          <h3 className={styles.featureTitle}>Sniðmát og dæmi</h3>
          <p className={styles.featureText}>
            Tilbúin sniðmát fyrir algenga skátaviðburði eins og vikulega fundi, færnimerkjadagskrár
            og útilegur. Foringjar geta notað þau beint eða sérsniðið þau að sínum þörfum.
          </p>
          <span className={`${styles.statusBadge} ${styles.statusPlanned}`}>Fyrirhugað</span>
        </div>

        <div className={styles.featureCard}>
          <Users className={styles.featureIcon} />
          <h3 className={styles.featureTitle}>Samvinnuverkfæri</h3>
          <p className={styles.featureText}>
            Möguleiki á að deila dagskrám og viðfangsefnum með öðrum foringjum, flokkum eða sveitum.
            Inniheldur stuðning við athugasemdir, tillögur og endurnotkun á sameiginlegum áætlunum.
          </p>
          <span className={`${styles.statusBadge} ${styles.statusPlanned}`}>Fyrirhugað</span>
        </div>

        <div className={styles.featureCard}>
          <Search className={styles.featureIcon} />
          <h3 className={styles.featureTitle}>Leit og merking</h3>
          <p className={styles.featureText}>
            Ítarleg leitarverkfæri með töggum og síum sem gerir foringjum kleift að finna
            viðfangsefni eftir aldurshópi, erfiðleikastigi, staðsetningu, búnað eða þema.
          </p>
          <span className={`${styles.statusBadge} ${styles.statusPlanned}`}>Fyrirhugað</span>
        </div>

        <div className={styles.featureCard}>
          <BarChart3 className={styles.featureIcon} />
          <h3 className={styles.featureTitle}>Greiningartæki fyrir dagskrá</h3>
          <p className={styles.featureText}>
            Verkfæri til að fara yfir liðna viðburði og greina fjölbreytni dagskrár. Hjálpar
            foringjum að tryggja að skátar fái jafna blöndu af viðfangsefnum, svo sem eftir ÆSKA og
            þroskasviðum.
          </p>
          <span className={`${styles.statusBadge} ${styles.statusPlanned}`}>Fyrirhugað</span>
        </div>
      </div>
    </section>
  );
}
