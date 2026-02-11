"use client";

import React, { useState } from "react";
import { notFound, useRouter } from "next/navigation";
import ProgramDetailHero from "../components/ProgramDetailHero";
import ProgramDetailTabs from "../components/ProgramDetailTabs";
import ProgramQuickInfo from "../components/ProgramQuickInfo";
import styles from "./program-detail.module.css";
import { useProgram } from "@/hooks/useProgram";
import { useProgramLikes } from "@/hooks/useProgramLikes";
import { Breadcrumb } from "@/app/programs/components/Breadcrumb";
import { ROUTES } from "@/constants/routes";
import { useProgramActions } from "@/hooks/useProgramActions";
import { ProgramDetailError } from "@/app/programs/components/ProgramDetailError";
import { ProgramDetailSkeleton } from "@/app/programs/components/ProgramDetailSkeleton";
import { useAuth } from "@/hooks/useAuth";
import { updateProgram, canEditProgram, ProgramUpdateFormData, deleteProgram } from "@/services/programs.service";
import ProgramDetailEdit from "./components/ProgramDetailEdit";

interface ProgramDetailPageProps {
    params: Promise<{
        id: string;
    }>;
}

/**
 * Program detail page component that displays comprehensive information about a single program.
 * 
 * @param params - URL parameters containing the program ID
 * @returns Program detail view with hero section, tabs, and sidebar information
 */
export default function ProgramDetailPage({ params }: ProgramDetailPageProps) {
    const router = useRouter();
    const { id } = React.use(params);
    const { user, isAuthenticated, getToken } = useAuth();
    const [isEditMode, setIsEditMode] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const { program, isLoading, error, setProgram } = useProgram(id);
    const { likeCount, isLiked, toggleLike } = useProgramLikes(program?.like_count || 0);
    const { handleShare, handleAddToWorkspace, handleBack } = useProgramActions(program);

    // All hooks are called first, then we do conditional rendering
    if (error) return <ProgramDetailError error={error} />;
    if (isLoading) return <ProgramDetailSkeleton />;
    if (!program) notFound();

    // Check if current user can edit this program
    const canEdit = canEditProgram(user, program);

    const breadcrumbItems = [
        { label: 'Heim', href: ROUTES.HOME },
        { label: 'Dagskrár', href: ROUTES.PROGRAMS },
        { label: program.name }
    ];

    const handleEdit = () => {
        setIsEditMode(true);
    };

    const handleCancelEdit = () => {
        setIsEditMode(false);
    };

    const handleSaveEdit = async (data: ProgramUpdateFormData) => {
        if (!program) return;

        try {
            // Transform data: convert null to undefined for API compatibility
            const updateData: {
                name: string;
                description?: string;
                public: boolean;
                image?: string;
            } = {
                name: data.name,
                public: data.public,
            };

            // Only include description if it's not null
            if (data.description !== null && data.description !== undefined) {
                updateData.description = data.description;
            }

            // Include image in update (only if it's a string, exclude null and undefined)
            if (typeof data.image === 'string') {
                updateData.image = data.image;
            }

            // Update program via API - pass getToken function, not token string
            const updatedProgram = await updateProgram(program.id, updateData, getToken);

            // Update local state
            setProgram(updatedProgram);
            setIsEditMode(false);
        } catch (error) {
            console.error("Failed to update program:", error);
            throw error; // Re-throw to let the form component handle the error
        }
    };

    const handleDelete = async () => {
        if (!program) return;

        // Confirm deletion
        const confirmed = window.confirm("Ertu viss um að þú viljir eyða þessari dagskrá? Þetta er óafturkræft.");

        if (!confirmed) return;

        try {
            setIsDeleting(true);
            await deleteProgram(program.id, getToken);

            router.push(ROUTES.PROGRAMS);
        }
        catch (error) {
            console.error("Failed to delete program:", error);
            alert("Ekki tókst að eyða dagskránni. Vinsamlegast reyndu aftur síðar.");
            setIsDeleting(false);
        }

    };

    return (
        <div className={styles.container}>
            <Breadcrumb items={breadcrumbItems} />

            <ProgramDetailHero
                program={program}
                likeCount={likeCount}
                isLiked={isLiked}
                onLike={toggleLike}
                onShare={handleShare}
                onAddToWorkspace={handleAddToWorkspace}
                isAuthenticated={isAuthenticated}
                canEdit={canEdit}
                isEditMode={isEditMode}
                onEdit={handleEdit}
            />

            <div className={styles.contentGrid}>
                <div className={styles.mainContent}>
                    {isEditMode ? (
                        <ProgramDetailEdit
                            program={program}
                            onSave={handleSaveEdit}
                            onCancel={handleCancelEdit}
                            onDelete={handleDelete}
                            isDeleting={isDeleting}
                        />
                    ) : (
                            <ProgramDetailTabs program={program} />
                    )}
                </div>
                <aside className={styles.sidebar}>
                    <ProgramQuickInfo program={program} />
                </aside>
            </div>

            <div className={styles.backButton}>
                <button onClick={handleBack} className={styles.backBtn}>
                    ← Til baka í dagskrárlista
                </button>
            </div>
        </div>
    );
    }