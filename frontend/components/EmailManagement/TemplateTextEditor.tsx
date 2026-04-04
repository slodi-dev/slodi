"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getTemplateText,
  updateTemplateText,
  type TemplateTextConfig,
} from "@/services/emails.service";
import styles from "./TemplateTextEditor.module.css";

const SECTION_LABELS: Record<string, string> = {
  welcome: "Velkomstpóstur",
  workspace_invite: "Boð í vinnusvæði",
  newsletter: "Fréttabréf",
  new_feature: "Nýr eiginleiki",
  footer: "Neðanmál (allar sniðmát)",
};

const FIELD_LABELS: Record<string, Record<string, string>> = {
  welcome: {
    heading: "Fyrirsögn (nota {user_name} fyrir nafn)",
    intro: "Kynningartexti",
    bullet_1: "Atriði 1",
    bullet_2: "Atriði 2",
    bullet_3: "Atriði 3",
    cta_label: "Texti á hnapp",
    closing: "Lokatexti",
  },
  workspace_invite: {
    heading: "Fyrirsögn",
    intro: "Kynningartexti (nota {inviter_name} og {workspace_name})",
    cta_label: "Texti á hnapp",
    disclaimer: "Fyrirvari",
  },
  newsletter: {
    unsubscribe_label: "Afskráningartexti",
  },
  new_feature: {
    badge_label: "Merki (t.d. NÝTT)",
    unsubscribe_label: "Afskráningartexti",
  },
  footer: {
    copyright: "Höfundarréttur (t.d. 2026 Slodi ehf.)",
  },
};

export default function TemplateTextEditor() {
  const { getToken, isLoading: authLoading } = useAuth();

  const [config, setConfig] = useState<TemplateTextConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    try {
      const data = await getTemplateText(token);
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gat ekki sótt texta");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!authLoading) fetchConfig();
  }, [fetchConfig, authLoading]);

  const handleChange = (section: string, field: string, value: string) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value,
        },
      };
    });
    setDirty(true);
    setSuccessMsg(null);
  };

  const handleSave = async () => {
    if (!config) return;
    const token = await getToken();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await updateTemplateText(token, config);
      setSuccessMsg("Texti vistaður");
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gat ekki vistað texta");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className={styles.loading}>Hleður texta...</p>;
  }

  if (!config) return null;

  const sections = Object.keys(FIELD_LABELS);

  return (
    <div className={styles.editor}>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {successMsg && <p className={styles.success}>{successMsg}</p>}

      {sections.map((section) => {
        const isOpen = openSection === section;
        return (
          <div key={section} className={styles.accordion}>
            <button
              type="button"
              className={styles.accordionHeader}
              onClick={() => setOpenSection(isOpen ? null : section)}
              aria-expanded={isOpen}
            >
              <span>{SECTION_LABELS[section] || section}</span>
              <span className={styles.accordionArrow}>{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <div className={styles.accordionBody}>
                {Object.entries(FIELD_LABELS[section]).map(([field, label]) => (
                  <label key={field} className={styles.label}>
                    <span className={styles.fieldLabel}>{label}</span>
                    <input
                      className={styles.input}
                      type="text"
                      value={config[section]?.[field] ?? ""}
                      onChange={(e) => handleChange(section, field, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className={styles.actions}>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !dirty}>
          {saving ? "Vista..." : "Vista breytingar"}
        </button>
        {dirty && <span className={styles.dirtyHint}>Óvistaðar breytingar</span>}
      </div>
    </div>
  );
}
