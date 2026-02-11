import React from "react";
import { Heart, Share2, Plus, Edit2, FileText } from "lucide-react";
import styles from "./ProgramDetailHero.module.css";

type Program = {
    id: string;
    name: string;
    description: string | null;
    image: string | null;
    author: {
        id: string;
        name: string;
        email: string;
    };
};

interface ProgramDetailHeroProps {
    program: Program;
    likeCount: number;
    isLiked: boolean;
    isAuthenticated: boolean;
    canEdit: boolean;
    isEditMode: boolean;
    onLike: () => void;
    onShare: () => void;
    onAddToWorkspace: () => void;
    onEdit: () => void;
}

export default function ProgramDetailHero({
    program,
    likeCount,
    isLiked,
    isAuthenticated,
    canEdit,
    isEditMode,
    onLike,
    onShare,
    onAddToWorkspace,
    onEdit,
}: ProgramDetailHeroProps) {
    return (
        <div className={styles.hero}>
            {/* Hero Image */}
            {program.image ? (
                <div className={styles.imageContainer}>
                    <img
                        src={program.image}
                        alt={program.name}
                        className={styles.heroImage}
                        width={1200}
                        height={500}
                    />
                </div>
            ) : (
                <div className={styles.imagePlaceholder}>
                        <FileText className={styles.placeholderIcon} size={80} strokeWidth={1.5} />
                </div>
            )}

            {/* Title and Actions */}
            <div className={styles.headerRow}>
                <div className={styles.titleArea}>
                    <h1 className={styles.title}>{program.name}</h1>
                    {program.author && (
                        <p className={styles.byline}>
                            eftir <a href={`/users/${program.author.id}`}>{program.author.name}</a>
                        </p>
                    )}
                </div>

                <div className={styles.actions}>
                    {canEdit && !isEditMode && (
                        <button
                            onClick={onEdit}
                            className={styles.editButton}
                            aria-label="Breyta dagskrá"
                        >
                            <Edit2 className={styles.icon} size={18} />
                            <span>Breyta</span>
                        </button>
                    )}

                    <button
                        onClick={onLike}
                        className={`${styles.actionButton} ${isLiked ? styles.liked : ""}`}
                        aria-label={isLiked ? "Fjarlægja líkar" : "Líkar við"}
                        disabled={!isAuthenticated}
                        title={!isAuthenticated ? "Skráðu þig inn til að líka við" : undefined}
                    >
                        <Heart
                            className={styles.icon}
                            size={18}
                            fill={isLiked ? "currentColor" : "none"}
                        />
                        <span>{likeCount}</span>
                    </button>

                    <button
                        onClick={onShare}
                        className={styles.actionButton}
                        aria-label="Deila dagskrá"
                    >
                        <Share2 className={styles.icon} size={18} />
                        <span>Deila</span>
                    </button>

                    <button
                        onClick={onAddToWorkspace}
                        className={styles.primaryButton}
                        aria-label="Bæta við vinnusvæði"
                        disabled={!isAuthenticated}
                        title={!isAuthenticated ? "Skráðu þig inn til að bæta við vinnusvæði" : undefined}
                    >
                        <Plus className={styles.icon} size={18} />
                        <span>Bæta við vinnusvæði</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
