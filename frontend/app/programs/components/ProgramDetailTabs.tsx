"use client";

import React, { useState } from "react";
import styles from "./ProgramDetailTabs.module.css";
import type { Program } from "@/services/programs.service";

type TabId = "overview" | "instructions" | "materials" | "comments";

interface Tab {
    id: TabId;
    label: string;
    count?: number;
}

interface ProgramDetailTabsProps {
    program: Program;
}

export default function ProgramDetailTabs({ program }: ProgramDetailTabsProps) {
    const [activeTab, setActiveTab] = useState<TabId>("overview");

    const tabs: Tab[] = [
        { id: "overview", label: "Yfirlit" },
        { id: "instructions", label: "Leiðbeiningar" },
        { id: "materials", label: "Búnaður" },
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
                        {tab.count !== undefined && (
                            <span className={styles.count}>{tab.count}</span>
                        )}
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
                        <h2 className={styles.panelTitle}>Um dagskrána</h2>
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
                                {program.instructions.split("\n").map((line, i) =>
                                    line.trim() ? <p key={i}>{line}</p> : <br key={i} />
                                )}
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
