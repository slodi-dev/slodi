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
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { canEditProgram, canDeleteProgram } from "@/lib/permissions";
import { updateProgram, deleteProgram, type ProgramUpdateInput } from "@/services/programs.service";
import ProgramDetailEdit from "./components/ProgramDetailEdit";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal/DeleteConfirmModal";

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
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const { program, isLoading, error, setProgram } = useProgram(id);
    const { likeCount, isLiked, toggleLike } = useProgramLikes(program?.like_count || 0);
    const { handleShare, handleAddToWorkspace, handleBack } = useProgramActions(program);
    const { role: workspaceRole } = useWorkspaceRole(program?.workspace_id ?? null);

    // All hooks are called first, then we do conditional rendering
    if (error) return <ProgramDetailError error={error} />;
    if (isLoading) return <ProgramDetailSkeleton />;
    if (!program) notFound();

    // Role-aware permission checks — uses workspace membership fetched above
    const canEdit = canEditProgram(user, program, workspaceRole);
    const canDelete = canDeleteProgram(user, program, workspaceRole);

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

    const handleSaveEdit = async (data: ProgramUpdateInput) => {
        if (!program) return;
        const updatedProgram = await updateProgram(program.id, data, getToken);
        setProgram(updatedProgram);
        setIsEditMode(false);
    };

    const handleDeleteRequest = () => {
        if (!canDelete) return;
        setShowDeleteConfirm(true);
    };

    const handleDeleteConfirm = async () => {
        if (!program || !canDelete) return;
        try {
            setIsDeleting(true);
            await deleteProgram(program.id, getToken);
            router.push(ROUTES.PROGRAMS);
        } catch (error) {
            console.error("Failed to delete program:", error);
            setIsDeleting(false);
            setShowDeleteConfirm(false);
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
                            onDeleteRequest={handleDeleteRequest}
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

            {/* Delete confirmation modal */}
            <DeleteConfirmModal
                open={showDeleteConfirm}
                programName={program.name}
                isDeleting={isDeleting}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeleteConfirm}
            />
        </div>
    );
    }