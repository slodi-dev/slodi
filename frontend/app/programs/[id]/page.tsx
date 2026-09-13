"use client";

import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import React, { useCallback, useMemo, useState } from "react";

import TypeBadge, { type BadgeContentType } from "@/components/TypeBadge/TypeBadge";
import DocumentViewer, { type ViewableDocument } from "@/components/DocumentViewer/DocumentViewer";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal/DeleteConfirmModal";
import ReportContentModal from "@/components/ReportContent/ReportContentModal";
import { ProgramDetailError } from "@/app/programs/components/ProgramDetailError";
import { ProgramDetailSkeleton } from "@/app/programs/components/ProgramDetailSkeleton";
import { ROUTES } from "@/constants/routes";
import { useLikes } from "@/contexts/LikesContext";
import { useAuth } from "@/hooks/useAuth";
import { useProgram } from "@/hooks/useProgram";
import { useProgramActions } from "@/hooks/useProgramActions";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { canDeleteProgram, canEditProgram } from "@/lib/permissions";
import { cn } from "@/lib/util";
import { createComment } from "@/services/comments.service";
import {
  deleteProgram,
  updateProgram,
  type ContentComment,
  type Program,
  type ProgramUpdateInput,
} from "@/services/programs.service";

import ProgramDetailEdit from "./components/ProgramDetailEdit";
import ItemFacts from "./components/ItemFacts";
import ItemHero, { type HeroImage } from "./components/ItemHero";
import ItemSections from "./components/ItemSections";
import styles from "./efnissida.module.css";
import { kindCopy } from "./kind";

interface ProgramDetailPageProps {
  params: Promise<{ id: string }>;
}

const ACCENT: Record<BadgeContentType, string> = {
  task: styles.task,
  event: styles.event,
  program: styles.program,
};

/**
 * One bank item — Verkefni, Viðburður or Dagskrá.
 *
 * The page answers „what is this, and can I run it?" above the fold, on a
 * phone, without opening anything. That is why there are no tabs and no hero
 * band above the title: both used to stand between a leader and the answer.
 */
export default function ProgramDetailPage({ params }: ProgramDetailPageProps) {
  const router = useRouter();
  const { id } = React.use(params);
  const { user, isAuthenticated, getToken } = useAuth();

  const [isEditMode, setIsEditMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [extraComments, setExtraComments] = useState<ContentComment[]>([]);
  const [openDoc, setOpenDoc] = useState<ViewableDocument | null>(null);

  const { program, isLoading, error, setProgram } = useProgram(id);
  const { likeCount, isLiked, toggleLike } = useLikes(
    id,
    program?.like_count || 0,
    program?.liked_by_me ?? false
  );
  const { handleShare, handleAddToWorkspace } = useProgramActions(program);
  const { role: workspaceRole } = useWorkspaceRole(program?.workspace_id ?? null);

  const handleSubmitComment = useCallback(
    async (body: string) => {
      const created = await createComment(id, body, getToken);
      // Functional update: two quick sends must not lose the first.
      setExtraComments((prev) => [...prev, created]);
    },
    [id, getToken]
  );

  const images: HeroImage[] = useMemo(() => {
    if (!program?.image) return [];
    /* One image is all the model stores today — the create modal keeps the
       first and discards the rest. `ItemHero` handles N so the carousel is
       ready when that changes; with one it renders no arrows and no counter. */
    return [{ url: program.image, alt: "" }];
  }, [program?.image]);

  if (error) return <ProgramDetailError error={error} />;
  if (isLoading) return <ProgramDetailSkeleton />;
  if (!program) notFound();

  const canEdit = canEditProgram(user, program, workspaceRole);
  const canDelete = canDeleteProgram(user, program, workspaceRole);
  const type = (program.content_type ?? "task") as BadgeContentType;
  const copy = kindCopy(type);
  const comments = [...(program.comments ?? []), ...extraComments];

  const handleSaveEdit = async (data: ProgramUpdateInput) => {
    const updated: Program = await updateProgram(program.id, data, getToken);
    setProgram(updated);
    setIsEditMode(false);
  };

  const handleDeleteConfirm = async () => {
    if (!canDelete) return;
    try {
      setIsDeleting(true);
      await deleteProgram(program.id, getToken);
      router.push(ROUTES.PROGRAMS);
    } catch (err) {
      console.error("Failed to delete program:", err);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className={cn(styles.page, ACCENT[type])}>
      <nav className={styles.crumbs} aria-label="Brauðmolar">
        <Link href={ROUTES.HOME}>Heim</Link>
        <span className={styles.crumbSep} aria-hidden="true">
          /
        </span>
        <Link href={ROUTES.PROGRAMS}>Dagskrárbankinn</Link>
        <span className={styles.crumbSep} aria-hidden="true">
          /
        </span>
        <span className={styles.crumbHere} aria-current="page">
          {program.name}
        </span>
      </nav>

      <div className={styles.titleblock}>
        <TypeBadge type={type} size="md" />
        <h1 className={styles.title}>{program.name}</h1>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={cn(styles.btn, isLiked && styles.liked)}
          onClick={toggleLike}
          disabled={!isAuthenticated}
          title={isAuthenticated ? undefined : "Skráðu þig inn til að líka við"}
          aria-label={isLiked ? "Fjarlægja líkar" : "Líkar við"}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 21.2 3.9 13a5.4 5.4 0 0 1 0-7.7 5.4 5.4 0 0 1 7.7 0l.4.4.4-.4a5.4 5.4 0 0 1 7.7 0 5.4 5.4 0 0 1 0 7.7z" />
          </svg>
          {likeCount}
        </button>

        <button type="button" className={styles.btn} onClick={handleShare}>
          Deila {copy.dative}
        </button>

        <button type="button" className={styles.btn} onClick={handleAddToWorkspace}>
          Bæta við vinnusvæði
        </button>

        {canEdit && !isEditMode && (
          <button
            type="button"
            className={cn(styles.btn, styles.btnFilled)}
            onClick={() => setIsEditMode(true)}
          >
            Breyta {copy.dative}
          </button>
        )}
      </div>

      <div className={styles.grid}>
        {isEditMode ? (
          <ProgramDetailEdit
            program={program}
            onSave={handleSaveEdit}
            onCancel={() => setIsEditMode(false)}
            onDeleteRequest={() => canDelete && setShowDeleteConfirm(true)}
            isDeleting={isDeleting}
          />
        ) : (
          <ItemSections
            program={program}
            images={images}
            heroIndex={heroIndex}
            onHeroIndexChange={setHeroIndex}
            comments={comments}
            canComment={isAuthenticated}
            onSubmitComment={handleSubmitComment}
            currentUserName={user?.name ?? null}
            heroSlot={<ItemHero images={images} index={heroIndex} onIndexChange={setHeroIndex} />}
            onOpenDocument={setOpenDoc}
          />
        )}

        <aside className={styles.aside}>
          <ItemFacts
            program={program}
            typeLabel={copy.definite}
            onPrint={() => window.print()}
            onReport={isAuthenticated ? () => setShowReport(true) : undefined}
          />
        </aside>
      </div>

      <DocumentViewer doc={openDoc} open={openDoc !== null} onClose={() => setOpenDoc(null)} />

      <ReportContentModal
        open={showReport}
        onClose={() => setShowReport(false)}
        contentId={program.id}
        contentName={program.name}
      />

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
