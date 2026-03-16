"use client";

import React, { useState } from "react";
import { notFound, useRouter } from "next/navigation";
import ProgramDetailHero from "../components/ProgramDetailHero";
import ProgramDetailTabs from "../components/ProgramDetailTabs";
import ProgramQuickInfo from "../components/ProgramQuickInfo";
import styles from "./program-detail.module.css";
import { useContentItem } from "@/hooks/useContentItem";
import { useLikes } from "@/contexts/LikesContext";
import { Breadcrumb } from "../components/Breadcrumb";
import { ROUTES } from "@/constants/routes";
import { useProgramActions } from "@/hooks/useProgramActions";
import { ProgramDetailError } from "../components/ProgramDetailError";
import { ProgramDetailSkeleton } from "../components/ProgramDetailSkeleton";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { canEditProgram, canDeleteProgram } from "@/lib/permissions";
import { updateProgram, deleteProgram, type ProgramUpdateInput } from "@/services/programs.service";
import { updateEvent, deleteEvent } from "@/services/events.service";
import { updateTask, deleteTask } from "@/services/tasks.service";
import type { ContentItem } from "@/services/content.service";
import { CONTENT_TYPE_LABELS } from "@/services/content.service";
import ProgramDetailEdit from "./components/ProgramDetailEdit";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal/DeleteConfirmModal";

interface ContentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ContentDetailPage({ params }: ContentDetailPageProps) {
  const router = useRouter();
  const { id } = React.use(params);
  const { user, isAuthenticated, getToken } = useAuth();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { item, isLoading, error, setItem } = useContentItem(id);
  const { likeCount, isLiked, toggleLike } = useLikes(
    id,
    item?.like_count || 0,
    item?.liked_by_me ?? false
  );
  const { handleShare, handleAddToWorkspace, handleBack } = useProgramActions(
    item as Parameters<typeof useProgramActions>[0]
  );
  const { role: workspaceRole } = useWorkspaceRole(item?.workspace_id ?? null);

  if (error) return <ProgramDetailError error={error} />;
  if (isLoading) return <ProgramDetailSkeleton />;
  if (!item) notFound();

  const canEdit = canEditProgram(user, item, workspaceRole);
  const canDelete = canDeleteProgram(user, item, workspaceRole);

  const typeLabel = CONTENT_TYPE_LABELS[item.content_type];

  const breadcrumbItems = [
    { label: "Heim", href: ROUTES.HOME },
    { label: "Dagskrárbanki", href: ROUTES.PROGRAMS },
    { label: item.name },
  ];

  const handleSaveEdit = async (data: ProgramUpdateInput) => {
    let updated: ContentItem;
    if (item.content_type === "program") {
      updated = await updateProgram(item.id, data, getToken);
    } else if (item.content_type === "event") {
      updated = await updateEvent(item.id, data, getToken);
    } else {
      updated = await updateTask(item.id, data, getToken);
    }
    setItem(updated);
    setIsEditMode(false);
  };

  const handleDeleteConfirm = async () => {
    if (!canDelete) return;
    try {
      setIsDeleting(true);
      if (item.content_type === "program") {
        await deleteProgram(item.id, getToken);
      } else if (item.content_type === "event") {
        await deleteEvent(item.id, getToken);
      } else {
        await deleteTask(item.id, getToken);
      }
      router.push(ROUTES.PROGRAMS);
    } catch (error) {
      console.error("Failed to delete item:", error);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className={styles.container}>
      <Breadcrumb items={breadcrumbItems} />

      <ProgramDetailHero
        program={item as Parameters<typeof ProgramDetailHero>[0]["program"]}
        likeCount={likeCount}
        isLiked={isLiked}
        onLike={toggleLike}
        onShare={handleShare}
        onAddToWorkspace={handleAddToWorkspace}
        isAuthenticated={isAuthenticated}
        canEdit={canEdit}
        isEditMode={isEditMode}
        onEdit={() => setIsEditMode(true)}
      />

      <div className={styles.contentGrid}>
        <div className={styles.mainContent}>
          {isEditMode ? (
            <ProgramDetailEdit
              program={item}
              onSave={handleSaveEdit}
              onCancel={() => setIsEditMode(false)}
              onDeleteRequest={() => setShowDeleteConfirm(true)}
              isDeleting={isDeleting}
            />
          ) : (
            <ProgramDetailTabs program={item} />
          )}
        </div>
        <aside className={styles.sidebar}>
          <ProgramQuickInfo program={item as Parameters<typeof ProgramQuickInfo>[0]["program"]} />
        </aside>
      </div>

      <div className={styles.backButton}>
        <button onClick={handleBack} className={styles.backBtn}>
          ← Til baka í {typeLabel.toLowerCase()}lista
        </button>
      </div>

      <DeleteConfirmModal
        open={showDeleteConfirm}
        programName={item.name}
        isDeleting={isDeleting}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
