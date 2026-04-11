"use client";

import { Calendar } from "lucide-react";
import styles from "./TimelineSection.module.css";

interface TimelineEvent {
  title: string;
  date: string;
  targetDate: Date;
  location?: string;
  notes: string[];
}

export default function TimelineSection() {
  const now = new Date();

  const events: TimelineEvent[] = [
    {
      title: "Kynning á verkefni",
      date: "Janúar 2026",
      targetDate: new Date(2026, 0, 10),
      location: "Neisti",
      notes: ["Smiðja um dagskrárgerð og safna endurgjöf frá foringjum"],
    },
    {
      title: "Útgáfa á lágmarksafurð",
      date: "Apríl 2026",
      targetDate: new Date(2026, 3, 12),
      location: "Skátaþing (frestað frá mars vegna veðurs)",
      notes: [
        "Markmiðið er að kynna lágmarksafurðina fyrir sjálfboðaliðum skátahreyfingarinnar.",
        "Vinnuópar endurnýjaðir",
      ],
    },
    {
      title: "Kynning á verkefni",
      date: "Ágúst 2026",
      targetDate: new Date(2026, 7, 31),
      location: "Kveikja",
      notes: ["Kynna verkfærið fyrir stjórnum og foringjum félagas", "Vinnuópar endurnýjaðir"],
    },
    {
      title: "Opinber útgáfa",
      date: "Apríl 2027",
      targetDate: new Date(2027, 3, 30),
      notes: ["Vinnuhópar ljúka störfum"],
    },
  ];

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        <Calendar className={styles.sectionIcon} />
        Tímalína
      </h2>
      <div className={styles.timeline}>
        {events.map((event, index) => {
          const hasPassed = now > event.targetDate;
          return (
            <div key={index} className={styles.timelineItem}>
              <div
                className={`${styles.timelineDot} ${!hasPassed ? styles.timelineDotFuture : ""}`}
              ></div>
              <div className={styles.timelineContent}>
                <h3 className={styles.timelineTitle}>{event.title}</h3>
                <time className={styles.timelineDate}>{event.date}</time>
                {event.location && <p className={styles.timelineLocation}>{event.location}</p>}
                {event.notes.map((note, noteIndex) => (
                  <p key={noteIndex} className={styles.timelineNote}>
                    {note}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
