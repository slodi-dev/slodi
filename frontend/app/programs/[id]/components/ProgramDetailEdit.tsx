"use client";

import React, { useState } from "react";
import type { Program } from "@/services/programs.service";
import styles from "./ProgramDetailEdit.module.css";

export interface ProgramUpdateFormData {
  name: string;
  description: string | null;
  public: boolean;
  image: string | null;
}

interface ProgramDetailEditProps {
  program: Program;
  onSave: (data: ProgramUpdateFormData) => Promise<void>;
  onCancel: () => void;
  onDelete: () => Promise<void>;
  isDeleting: boolean;
}

export default function ProgramDetailEdit({
  program,
  onSave,
  onCancel,
  onDelete,
  isDeleting,
}: ProgramDetailEditProps) {
  const [formData, setFormData] = useState<ProgramUpdateFormData>({
    name: program.name,
    description: program.description || null,
    public: program.public,
    image: program.image || null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError("Nafn má ekki vera tómt");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await onSave(formData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Villa kom upp við að vista"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUrlChange = (url: string) => {
    setImageError(false);
    setFormData({ ...formData, image: url || null });
  };

  const handleClearImage = () => {
    setFormData({ ...formData, image: null });
    setImageError(false);
  };

  const isDisabled = isSaving || isDeleting;
  const hasImage = formData.image && formData.image.trim().length > 0;

  return (
    <div className={styles.editContainer}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Program name */}
        <div className={styles.formGroup}>
          <label htmlFor="name" className={styles.label}>
            Nafn dagskrár *
          </label>
          <input
            id="name"
            type="text"
            className={styles.input}
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            required
            disabled={isDisabled}
          />
        </div>

        {/* Description */}
        <div className={styles.formGroup}>
          <label htmlFor="description" className={styles.label}>
            Lýsing
          </label>
          <textarea
            id="description"
            className={styles.textarea}
            value={formData.description || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                description: e.target.value || null,
              })
            }
            rows={8}
            disabled={isDisabled}
            placeholder="Lýsing á dagskránni..."
          />
        </div>

        {/* Image URL */}
        <div className={styles.formGroup}>
          <label htmlFor="image" className={styles.label}>
            Mynd (URL)
          </label>

          {/* Image preview */}
          {hasImage && (
            <div className={styles.imagePreviewContainer}>
              {!imageError ? (
                <img
                  src={formData.image!}
                  alt="Forskoðun myndar"
                  className={styles.imagePreview}
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className={styles.imagePreviewError}>
                  <span className={styles.imagePreviewErrorIcon}>⚠️</span>
                  <span className={styles.imagePreviewErrorText}>
                    Ekki tókst að hlaða mynd — athugaðu slóðina
                  </span>
                </div>
              )}
              <button
                type="button"
                className={styles.imageClearButton}
                onClick={handleClearImage}
                disabled={isDisabled}
                aria-label="Fjarlægja mynd"
              >
                ✕
              </button>
            </div>
          )}

          <input
            id="image"
            type="url"
            className={styles.input}
            value={formData.image || ""}
            onChange={(e) => handleImageUrlChange(e.target.value)}
            disabled={isDisabled}
            placeholder={
              program.image
                ? program.image
                : "https://example.com/mynd.jpg"
            }
          />
          <p className={styles.helpText}>
            Settu inn slóð á mynd til að sýna á dagskránni
          </p>
        </div>

        {/* Public checkbox */}
        <div className={styles.formGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={formData.public}
              onChange={(e) =>
                setFormData({ ...formData, public: e.target.checked })
              }
              disabled={isDisabled}
            />
            <span>Opinber dagskrá</span>
          </label>
          <p className={styles.helpText}>
            Openberar dagskrár eru sýnilegar öllum í dagskrárbankanum
          </p>
        </div>

        {/* Error message */}
        {error && <div className={styles.error}>{error}</div>}

        {/* Save / Cancel actions */}
        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.saveButton}
            disabled={isDisabled}
          >
            {isSaving ? "Vista..." : "Vista breytingar"}
          </button>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
            disabled={isDisabled}
          >
            Hætta við
          </button>
        </div>

        {/* Danger zone */}
        <div className={styles.dangerZone}>
          <h3 className={styles.dangerTitle}>Hættusvæði</h3>
          <p className={styles.dangerDescription}>
            Þegar dagskrá er eytt er ekki hægt að afturkalla það.
          </p>
          <button
            type="button"
            className={styles.deleteButton}
            onClick={onDelete}
            disabled={isDisabled}
          >
            {isDeleting ? "Eyði..." : "Eyða dagskrá"}
          </button>
        </div>
      </form>
    </div>
  );
}