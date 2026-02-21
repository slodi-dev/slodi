import React from "react";
import { BarChart3, Clock, AlarmClock, Users, MapPin, User, Tag, Target, Calendar, CircleDollarSign, Printer, Download, Flag } from "lucide-react";
import styles from "./ProgramQuickInfo.module.css";
import type { Program } from "@/services/programs.service";
import { formatIcelandicDate } from "@/utils/date";

interface ProgramQuickInfoProps {
    program: Program;
}

export default function ProgramQuickInfo({ program }: ProgramQuickInfoProps) {
    return (
        <div className={styles.container}>
            {/* Quick Stats */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                    <BarChart3 className={styles.titleIcon} size={20} />
                    Stuttar upplýsingar
                </h3>
                <div className={styles.stats}>
                    <div className={styles.stat}>
                        <Clock className={styles.statIcon} size={18} />
                        <div className={styles.statContent}>
                            <span className={styles.statLabel}>Lengd</span>
                            <span className={styles.statValue}>{program.duration || "—"}</span>
                        </div>
                    </div>
                    {program.prep_time && (
                        <div className={styles.stat}>
                            <AlarmClock className={styles.statIcon} size={18} />
                            <div className={styles.statContent}>
                                <span className={styles.statLabel}>Undirbúningur</span>
                                <span className={styles.statValue}>{program.prep_time}</span>
                            </div>
                        </div>
                    )}
                    <div className={styles.stat}>
                        <Users className={styles.statIcon} size={18} />
                        <div className={styles.statContent}>
                            <span className={styles.statLabel}>Aldur</span>
                            <span className={styles.statValue}>{program.age || "—"}</span>
                        </div>
                    </div>
                    <div className={styles.stat}>
                        <MapPin className={styles.statIcon} size={18} />
                        <div className={styles.statContent}>
                            <span className={styles.statLabel}>Staðsetning</span>
                            <span className={styles.statValue}>{program.location || "—"}</span>
                        </div>
                    </div>
                    <div className={styles.stat}>
                        <User className={styles.statIcon} size={18} />
                        <div className={styles.statContent}>
                            <span className={styles.statLabel}>Hópstærð</span>
                            <span className={styles.statValue}>
                                {program.count !== null && program.count !== undefined
                                    ? program.count
                                    : "—"}
                            </span>
                        </div>
                    </div>
                    {program.price !== null && program.price !== undefined && (
                        <div className={styles.stat}>
                            <CircleDollarSign className={styles.statIcon} size={18} />
                            <div className={styles.statContent}>
                                <span className={styles.statLabel}>Verð</span>
                                <span className={styles.statValue}>{program.price} kr.</span>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Tags */}
            {program.tags && program.tags.length > 0 && (
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                        <Tag className={styles.titleIcon} size={20} />
                        Merki
                    </h3>
                    <div className={styles.tags}>
                        {program.tags.map((tag) => (
                            <a
                                key={tag.id}
                                href={`/programs?tags=${encodeURIComponent(tag.name)}`}
                                className={styles.tag}
                            >
                                {tag.name}
                            </a>
                        ))}
                    </div>
                </section>
            )}

            {/* Workspace */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                    <Target className={styles.titleIcon} size={20} />
                    Vinnusvæði
                </h3>
                <div className={styles.infoCard}>
                    {program.workspace ? (
                        <a
                            href={`/workspaces/${program.workspace.id}`}
                            className={styles.link}
                        >
                            {program.workspace.name}
                        </a>
                    ) : (
                        <span>Óþekkt vinnusvæði</span>
                    )}
                </div>
            </section>

            {/* Author */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                    <User className={styles.titleIcon} size={20} />
                    Höfundur
                </h3>
                <div className={styles.infoCard}>
                    {program.author ? (
                        <a href={`/users/${program.author.id}`} className={styles.link}>
                            {program.author.name}
                        </a>
                    ) : (
                        <span>Óþekktur höfundur</span>
                    )}
                </div>
            </section>

            {/* Metadata */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                    <Calendar className={styles.titleIcon} size={20} />
                    Upplýsingar
                </h3>
                <div className={styles.metadata}>
                    <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Búið til</span>
                        <span className={styles.metaValue}>
                            {formatIcelandicDate(program.created_at)}
                        </span>
                    </div>
                    <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Líkar</span>
                        <span className={styles.metaValue}>{program.like_count}</span>
                    </div>
                    <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Athugasemdir</span>
                        <span className={styles.metaValue}>
                            {program.comment_count || 0}
                        </span>
                    </div>
                </div>
            </section>

            {/* Actions */}
            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                    <Target className={styles.titleIcon} size={20} />
                    Aðgerðir
                </h3>
                <div className={styles.actions}>
                    <button className={styles.actionButton}>
                        <Printer size={16} /> Prenta
                    </button>
                    <button className={styles.actionButton}>
                        <Download size={16} /> Sækja PDF
                    </button>
                    <button className={styles.actionButton}>
                        <Flag size={16} /> Tilkynna
                    </button>
                </div>
            </section>
        </div>
    );
}
