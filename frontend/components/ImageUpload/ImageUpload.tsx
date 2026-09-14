"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import styles from "./ImageUpload.module.css";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, uploadFile } from "@/services/uploads.service";
import { useAuth } from "@/hooks/useAuth";

const MAX_MB = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));

type Props = {
  /** Current blob URL, or "" when no image is set. */
  value: string;
  /** Called with the new blob URL after a successful upload, or "" when cleared. */
  onChange: (url: string) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
  /** Id for the file input, so an external <label> can target it. */
  id?: string;
};

export default function ImageUpload({
  value,
  onChange,
  disabled = false,
  label = "Mynd",
  hint = `JPG, PNG eða WebP — mest ${MAX_MB} MB`,
  id = "image-upload",
}: Props) {
  const { getToken } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  const isUploading = progress !== null;
  const isDisabled = disabled || isUploading;

  // Cancel an in-flight upload if the form unmounts mid-transfer.
  useEffect(() => () => abortRef.current?.abort(), []);

  const handleFile = async (file: File) => {
    setError(null);

    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setError("Aðeins JPG, PNG og WebP myndir eru leyfðar");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Myndin má mest vera ${MAX_MB} MB`);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);

    try {
      const blobUrl = await uploadFile(file, "image", getToken, setProgress, controller.signal);
      setPreviewFailed(false);
      onChange(blobUrl);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setError("Ekki tókst að hlaða upp mynd. Reyndu aftur.");
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so picking the same file twice still fires a change event.
    event.target.value = "";
    if (file) void handleFile(file);
  };

  const clear = () => {
    abortRef.current?.abort();
    setError(null);
    setPreviewFailed(false);
    onChange("");
  };

  return (
    <div className={styles.wrapper}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>

      {value && (
        <div className={styles.previewContainer}>
          {!previewFailed ? (
            <Image
              src={value}
              alt="Forskoðun myndar"
              className={styles.preview}
              width={600}
              height={300}
              onError={() => setPreviewFailed(true)}
            />
          ) : (
            <div className={styles.previewError}>
              <span aria-hidden="true">⚠️</span>
              <span>Ekki tókst að birta myndina</span>
            </div>
          )}
          <button
            type="button"
            className={styles.clearButton}
            onClick={clear}
            disabled={disabled}
            aria-label="Fjarlægja mynd"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        id={id}
        type="file"
        className={styles.fileInput}
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        onChange={onInputChange}
        disabled={isDisabled}
      />

      <button
        type="button"
        className={styles.pickButton}
        onClick={() => inputRef.current?.click()}
        disabled={isDisabled}
      >
        {isUploading ? (
          <>
            <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
            Hleð upp… {progress}%
          </>
        ) : (
          <>
            <ImagePlus size={16} aria-hidden="true" />
            {value ? "Skipta um mynd" : "Velja mynd"}
          </>
        )}
      </button>

      {isUploading && (
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Framvinda upphleðslu"
        >
          <div className={styles.progressBar} style={{ width: `${progress}%` }} />
        </div>
      )}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        <p className={styles.hint}>{hint}</p>
      )}
    </div>
  );
}
