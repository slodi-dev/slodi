"use client";

import React, { useState } from "react";
import Image from "next/image";
import styles from "./NewProgramForm.module.css";
import type { Program } from "@/services/programs.service";
import { createProgram } from "@/services/programs.service";
import { useTags } from "@/hooks/useTags";
import { handleApiErrorIs } from "@/lib/api-utils";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  workspaceId: string;
  onCreated?: (program: Program) => void;
  onCancel?: () => void;
};

export default function NewProgramForm({ workspaceId, onCreated, onCancel }: Props) {
  const { getToken } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [image, setImage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const imagePreviewRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    imagePreviewRef.current = imagePreview;
  }, [imagePreview]);

  React.useEffect(() => {
    return () => {
      if (imagePreviewRef.current) {
        try { URL.revokeObjectURL(imagePreviewRef.current); } catch { /* ignore */ }
      }
    };
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { tagNames: availableTags } = useTags();

  const PLACEHOLDER_TAGS = ["útivist", "innileikur", "list", "sköpun", "matreiðsla", "leikur", "fræðsla", "náttúrufræði"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Heiti hugmyndar er nauðsynlegt");
      return;
    }

    setLoading(true);

    try {
      const program = await createProgram({
        name: name.trim(),
        description: description.trim(),
        public: isPublic,
        image: image.trim(),
        imageFile: imageFile || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        workspaceId,
      }, getToken);

      handleReset();
      onCreated?.(program);
    } catch (err) {
      setError(handleApiErrorIs(err));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setName("");
    setDescription("");
    setIsPublic(false);
    setImage("");
    setSelectedTags([]);
    if (imagePreview) {
      try { URL.revokeObjectURL(imagePreview); } catch { /* ignore */ }
    }
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revoke previous preview
    if (imagePreview) {
      try { URL.revokeObjectURL(imagePreview); } catch { /* ignore */ }
    }

    setImageFile(file);
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
  };

  const handleRemoveImage = () => {
    if (imagePreview) {
      try { URL.revokeObjectURL(imagePreview); } catch { /* ignore */ }
    }
    setImageFile(null);
    setImagePreview(null);
    setImage("");
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const displayTags = availableTags && availableTags.length > 0 ? availableTags : PLACEHOLDER_TAGS;

  return (
    <form className={styles.form} onSubmit={handleSubmit} aria-label="Ný dagskrá">
      {/* Program Name */}
      <div className={styles.field}>
        <label htmlFor="program-name" className={styles.label}>
          Heiti hugmyndar <span className={styles.required}>*</span>
        </label>
        <input
          id="program-name"
          type="text"
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="t.d. Náttúruganga í skóginum"
          required
          maxLength={255}
        />
        <p className={styles.hint}>Stuttur og lýsandi titill á dagskrárhugmyndinni</p>
      </div>

      {/* Description */}
      <div className={styles.field}>
        <label htmlFor="program-description" className={styles.label}>
          Lýsing
        </label>
        <textarea
          id="program-description"
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Lýstu hugmyndinni stuttlega..."
          rows={4}
          maxLength={1000}
        />
        <p className={styles.hint}>Stutt lýsing sem hjálpar öðrum að skilja verkefnið</p>
      </div>

      {/* Tags */}
      <div className={styles.field}>
        <label className={styles.label}>
          Merkimiðar
        </label>
        <div className={styles.tagGrid}>
          {displayTags.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                className={`${styles.tagButton} ${isSelected ? styles.tagButtonActive : ''}`}
                onClick={() => handleTagToggle(tag)}
                aria-pressed={isSelected}
              >
                {tag}
              </button>
            );
          })}
        </div>
        {selectedTags.length > 0 && (
          <p className={styles.hint}>{selectedTags.length} merkimiði valinn</p>
        )}
      </div>

      {/* Image */}
      <div className={styles.field}>
        <label className={styles.label}>
          Mynd
        </label>

        {imagePreview ? (
          <div className={styles.imagePreview}>
            <Image
              src={imagePreview}
              alt="Preview"
              width={400}
              height={250}
              className={styles.previewImage}
            />
            <button
              type="button"
              className={styles.removeImage}
              onClick={handleRemoveImage}
              aria-label="Fjarlægja mynd"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className={styles.imageUpload}>
            <input
              type="file"
              id="image-upload"
              accept="image/*"
              onChange={handleImageChange}
              className={styles.fileInput}
            />
            <label htmlFor="image-upload" className={styles.uploadLabel}>
              <svg className={styles.uploadIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className={styles.uploadText}>Smelltu til að velja mynd</span>
              <span className={styles.uploadHint}>eða dragðu mynd hingað</span>
            </label>
          </div>
        )}

        {/* Image URL fallback */}
        <div className={styles.orDivider}>
          <span>eða</span>
        </div>
        <input
          type="url"
          className={styles.input}
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="https://example.com/mynd.jpg"
        />
        <p className={styles.hint}>Settu inn vefslóð á mynd</p>
      </div>

      {/* Public Toggle */}
      <div className={styles.field}>
        <div className={styles.visibilityToggle}>
          <div className={styles.toggleContent}>
            <div className={styles.toggleHeader}>
              <svg className={styles.toggleIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isPublic ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                )}
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <div className={styles.toggleLabels}>
                <span className={styles.toggleTitle}>Sýnileiki hugmyndar</span>
                <span className={styles.toggleStatus}>
                  {isPublic ? 'Opinber' : 'Einka'}
                </span>
              </div>
            </div>
            <label className={styles.switchLabel}>
              <input
                type="checkbox"
                className={styles.switchInput}
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                aria-label="Gera hugmynd opinbera"
              />
              <span className={styles.switch}>
                <span className={styles.switchThumb}></span>
              </span>
            </label>
          </div>
          <p className={styles.toggleHint}>
            {isPublic
              ? 'Þessi hugmynd verður sýnileg öllum í dagskrábankanum'
              : 'Aðeins þú og meðlimir vinnusvæðisins geta séð þessa hugmynd'
            }
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {/* Form Actions */}
      <div className={styles.actions}>
        {onCancel && (
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={onCancel}
            disabled={loading}
          >
            Hætta við
          </button>
        )}
        <button
          type="button"
          className={styles.buttonSecondary}
          onClick={handleReset}
          disabled={loading}
        >
          Hreinsa
        </button>
        <button
          type="submit"
          className={styles.buttonPrimary}
          disabled={loading || !name.trim()}
        >
          {loading ? "Býr til..." : "Búa til hugmynd"}
        </button>
      </div>
    </form>
  );
}
