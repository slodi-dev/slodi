"use client";

import React, { useState, useMemo } from "react";
import styles from "./ProgramDetailTabs.module.css";
import type { ContentItem } from "@/services/content.service";
import type { Event } from "@/services/events.service";
import type { Task } from "@/services/tasks.service";
import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import Image from "next/image";

type TabId = "overview" | "instructions" | "materials" | "children" | "comments";

interface Tab {
  id: TabId;
  label: string;
  count?: number;
}

interface ProgramDetailTabsProps {
  program: ContentItem;
}

export default function ProgramDetailTabs({ program }: ProgramDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const isProgram = program.content_type === "program";
  const isEvent = program.content_type === "event";
  const programItem = program as ContentItem & { events?: Event[]; tasks?: Task[] };
  const eventItem = program as ContentItem & { tasks?: Task[] };

  const events = useMemo(
    () => (programItem.events ?? []).slice().sort((a, b) => a.position - b.position),
    [programItem.events]
  );
  const tasks = useMemo(
    () =>
      (isProgram ? (programItem.tasks ?? []) : (eventItem.tasks ?? []))
        .slice()
        .sort((a, b) => a.position - b.position),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isProgram, programItem.tasks, eventItem.tasks]
  );

  // For programs: merge events and tasks into a single list ordered by position
  const programChildren = useMemo(
    () =>
      isProgram
        ? [
            ...events.map((ev) => ({ ...ev, childType: "event" as const })),
            ...tasks.map((t) => ({ ...t, childType: "task" as const })),
          ].sort((a, b) => a.position - b.position)
        : [],
    [isProgram, events, tasks]
  );

  const hasChildren = (isProgram && programChildren.length > 0) || (isEvent && tasks.length > 0);

  const childrenLabel = "Dagskrárliðir";
  const childrenCount = isProgram ? programChildren.length : tasks.length;

  const tabs: Tab[] = [
    { id: "overview", label: "Yfirlit" },
    { id: "instructions", label: "Leiðbeiningar" },
    { id: "materials", label: "Búnaður" },
    ...(isProgram || isEvent
      ? [{ id: "children" as TabId, label: childrenLabel, count: childrenCount }]
      : []),
    { id: "comments", label: "Athugasemdir", count: program.comment_count },
  ];

  return (
    <div className={styles.container}>
      {/* Tab Navigation */}
      <nav className={styles.tabNav} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ""}`}
          >
            {tab.label}
            {tab.count !== undefined && <span className={styles.count}>{tab.count}</span>}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === "overview" && (
          <div
            role="tabpanel"
            id="panel-overview"
            aria-labelledby="tab-overview"
            className={styles.panel}
          >
            <h2 className={styles.panelTitle}>
              Um {isProgram ? "dagskrána" : isEvent ? "viðburðinn" : "verkefnið"}
            </h2>
            <div className={styles.description}>
              {program.description ? (
                <p>{program.description}</p>
              ) : (
                <p className={styles.emptyState}>Engin lýsing í boði.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "instructions" && (
          <div
            role="tabpanel"
            id="panel-instructions"
            aria-labelledby="tab-instructions"
            className={styles.panel}
          >
            <h2 className={styles.panelTitle}>Leiðbeiningar</h2>
            {program.instructions ? (
              <div className={styles.prose}>
                {program.instructions
                  .split("\n")
                  .map((line, i) => (line.trim() ? <p key={i}>{line}</p> : <br key={i} />))}
              </div>
            ) : (
              <p className={styles.emptyState}>Engar leiðbeiningar hafa verið skráðar.</p>
            )}
          </div>
        )}

        {activeTab === "materials" && (
          <div
            role="tabpanel"
            id="panel-materials"
            aria-labelledby="tab-materials"
            className={styles.panel}
          >
            <h2 className={styles.panelTitle}>Búnaður og efni</h2>
            {program.equipment && program.equipment.length > 0 ? (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Búnaður</h3>
                <ul className={styles.list}>
                  {program.equipment.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className={styles.emptyState}>Enginn búnaður hefur verið skráður.</p>
            )}
          </div>
        )}

        {activeTab === "children" && (
          <div
            role="tabpanel"
            id="panel-children"
            aria-labelledby="tab-children"
            className={styles.panel}
          >
            <h2 className={styles.panelTitle}>{childrenLabel}</h2>

            {!hasChildren && (
              <p className={styles.emptyState}>
                {isProgram
                  ? "Engir viðburðir eða verkefni tengd þessari dagskrá."
                  : "Engin verkefni tengd þessum viðburði."}
              </p>
            )}

            {isProgram && (
              <div className={styles.childList}>
                {programChildren.map((child) => (
                  <ChildCard
                    key={child.id}
                    name={child.name}
                    description={child.description}
                    durationMin={child.duration_min}
                    durationMax={child.duration_max}
                    href={`/content/${child.id}`}
                    type={child.childType}
                    image={child.image}
                    location={child.location}
                    tags={child.tags}
                    age={child.age}
                  />
                ))}
              </div>
            )}

            {isEvent && tasks.length > 0 && (
              <div className={styles.childList}>
                {tasks.map((task) => (
                  <ChildCard
                    key={task.id}
                    name={task.name}
                    description={task.description}
                    durationMin={task.duration_min}
                    durationMax={task.duration_max}
                    href={`/content/${task.id}`}
                    type="task"
                    image={task.image}
                    location={task.location}
                    tags={task.tags}
                    age={task.age}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "comments" && (
          <div
            role="tabpanel"
            id="panel-comments"
            aria-labelledby="tab-comments"
            className={styles.panel}
          >
            <h2 className={styles.panelTitle}>Athugasemdir</h2>
            <div className={styles.emptyState}>
              <p>Athugasemdakerfi kemur síðar. Hér munu notendur geta deilt upplifunum sínum.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ChildCard ─────────────────────────────────────────────────────────────────

interface ChildCardProps {
  name: string;
  description?: string | null;
  durationMin?: number | null;
  durationMax?: number | null;
  href: string;
  type: "event" | "task";
  image?: string | null;
  location?: string | null;
  tags?: Array<{ id: string; name: string }>;
  age?: string[] | null;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} mín`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} klst ${m} mín` : `${h} klst`;
}

function formatDurationRange(min?: number | null, max?: number | null): string | null {
  if (min != null && max != null && min !== max)
    return `${formatDuration(min)} – ${formatDuration(max)}`;
  if (min != null) return formatDuration(min);
  if (max != null) return formatDuration(max);
  return null;
}

function ChildCard({
  name,
  description,
  durationMin,
  durationMax,
  href,
  type,
  image,
  location,
  tags,
  age,
}: ChildCardProps) {
  const durationLabel = formatDurationRange(durationMin, durationMax);
  const typeLabel = type === "event" ? "Viðburður" : "Verkefni";
  const visibleTags = (tags ?? []).slice(0, 3);

  return (
    <Link
      href={href}
      className={`${styles.childCard} ${type === "event" ? styles.childCardEvent : styles.childCardTask}`}
    >
      <div className={styles.childCardContent}>
        <div className={styles.childCardHeader}>
          <span
            className={`${styles.childCardTypeBadge} ${type === "event" ? styles.childCardTypeBadgeEvent : styles.childCardTypeBadgeTask}`}
          >
            {typeLabel}
          </span>
          {visibleTags.map((tag) => (
            <span key={tag.id} className={styles.childCardTag}>
              {tag.name}
            </span>
          ))}
        </div>

        <p className={styles.childCardName}>{name}</p>

        {description && <p className={styles.childCardDesc}>{description}</p>}

        {(durationLabel || location || (age && age.length > 0)) && (
          <div className={styles.childCardMeta}>
            {durationLabel && (
              <span className={styles.childCardMetaItem}>
                <Clock size={11} aria-hidden="true" />
                {durationLabel}
              </span>
            )}
            {location && (
              <span className={styles.childCardMetaItem}>
                <MapPin size={11} aria-hidden="true" />
                {location}
              </span>
            )}
            {age && age.length > 0 && (
              <span className={styles.childCardMetaItem}>
                {age.slice(0, 2).join(", ")}
                {age.length > 2 && ` +${age.length - 2}`}
              </span>
            )}
          </div>
        )}
      </div>

      {image && (
        <div className={styles.childCardImage}>
          <Image src={image} alt={name} fill style={{ objectFit: "cover" }} sizes="96px" />
        </div>
      )}
    </Link>
  );
}
