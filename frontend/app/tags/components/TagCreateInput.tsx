"use client";

import { useState } from "react";
import { createTag, type Tag } from "@/services/tags.service";
import styles from "./TagCreateInput.module.css";

interface TagCreateInputProps {
  onCreated: (tag: Tag) => void;
}

export default function TagCreateInput({ onCreated }: TagCreateInputProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const trimmed = name.trim();

  const handleSubmit = async () => {
    setError(null);

    if (trimmed.length === 0) {
      setError("Nafn má ekki vera tómt");
      return;
    }
    if (trimmed.length > 50) {
      setError("Nafn má mest vera 50 stafir");
      return;
    }

    setIsLoading(true);
    try {
      const tag = await createTag({ name: trimmed });
      setName("");
      onCreated(tag);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("already exists") || msg.includes("409")) {
        setError("Flokkur með þessu nafni er þegar til");
      } else {
        setError("Villa kom upp við að búa til flokk");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputRow}>
        <input
          type="text"
          className={styles.input}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Nýr flokkur..."
          aria-label="Nafn nýs flokks"
          maxLength={50}
          disabled={isLoading}
        />
        <button
          type="button"
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={isLoading || trimmed.length === 0}
        >
          {isLoading ? "..." : "Bæta við"}
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
