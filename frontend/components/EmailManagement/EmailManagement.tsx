"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  createDraft,
  deleteDraft,
  listDrafts,
  listTemplates,
  previewTemplate,
  sendDraft,
  testSendDraft,
  updateDraft,
  type EmailDraft,
  type TemplateInfo,
} from "@/services/emails.service";
import styles from "./EmailManagement.module.css";

const STATUS_LABELS: Record<EmailDraft["status"], string> = {
  draft: "Drög",
  scheduled: "Tímasett",
  processing: "Í vinnslu",
  sent: "Sent",
  failed: "Mistókst",
};

const STATUS_CLASSES: Record<EmailDraft["status"], string> = {
  draft: styles.statusDraft,
  scheduled: styles.statusScheduled,
  processing: styles.statusProcessing,
  sent: styles.statusSent,
  failed: styles.statusFailed,
};

type BlockType = "heading" | "text" | "image" | "cta" | "divider" | "feature_card";

const BLOCK_TYPES: { value: BlockType; label: string }[] = [
  { value: "heading", label: "Fyrirsögn" },
  { value: "text", label: "Texti" },
  { value: "image", label: "Mynd" },
  { value: "cta", label: "Hnappur" },
  { value: "divider", label: "Skiptilína" },
  { value: "feature_card", label: "Eiginleikaspjald" },
];

type Block = Record<string, unknown> & { type: BlockType };

const EMPTY_FORM = {
  subject: "",
  preheader: "",
  template: "newsletter",
  manualRecipients: "",
  scheduledAt: "",
};

/** Templates that use named variables instead of the block editor. */
const TEMPLATE_VAR_FIELDS: Record<
  string,
  { key: string; label: string; placeholder: string }[]
> = {
  welcome: [
    { key: "user_name", label: "Nafn notanda", placeholder: "Jón Jónsson" },
    { key: "login_url", label: "Innskráningarslóð", placeholder: "https://slodi.is" },
  ],
  workspace_invite: [
    { key: "inviter_name", label: "Nafn sendanda", placeholder: "Anna Sigurðardóttir" },
    { key: "workspace_name", label: "Nafn vinnusvæðis", placeholder: "Úlfar sveitin" },
    { key: "personal_note", label: "Persónuleg skilaboð", placeholder: "Vertu velkomin!" },
    { key: "accept_url", label: "Samþykkja-slóð", placeholder: "https://slodi.is" },
  ],
  new_feature: [
    { key: "feature_name", label: "Nafn eiginleika", placeholder: "Viðburðadagatal" },
    { key: "feature_description", label: "Lýsing", placeholder: "Nýr eiginleiki sem..." },
    { key: "feature_image", label: "Mynd URL (valfrjálst)", placeholder: "https://..." },
    { key: "cta_label", label: "Texti á hnapp", placeholder: "Skoða" },
    { key: "cta_url", label: "Slóð hnapps", placeholder: "https://slodi.is" },
  ],
};

/** Whether a template uses the block editor (newsletter) or named fields. */
function usesBlockEditor(template: string): boolean {
  return template === "newsletter";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("is-IS", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EmailManagement() {
  const { user: currentUser, getToken, isLoading: authLoading } = useAuth();

  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccessMsg(null), 4000);
  };

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [tpl, dft] = await Promise.all([listTemplates(token), listDrafts(token)]);
      setTemplates(tpl);
      setDrafts(dft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gat ekki sótt gögn");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [fetchData, authLoading]);

  const handlePreview = async (templateName: string) => {
    const token = await getToken();
    if (!token) return;
    setPendingActions((p) => ({ ...p, [`preview-${templateName}`]: true }));
    try {
      const html = await previewTemplate(token, templateName);
      setPreviewHtml(html);
      setPreviewName(templateName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gat ekki forskoðað sniðmát");
    } finally {
      setPendingActions((p) => ({ ...p, [`preview-${templateName}`]: false }));
    }
  };

  const handleTestSend = async (draftId: string) => {
    const token = await getToken();
    if (!token) return;
    setPendingActions((p) => ({ ...p, [`test-${draftId}`]: true }));
    try {
      await testSendDraft(token, draftId);
      showSuccess("Prufupóstur sendur á netfangið þitt");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gat ekki sent prufupóst");
    } finally {
      setPendingActions((p) => ({ ...p, [`test-${draftId}`]: false }));
    }
  };

  const handleSend = async (draftId: string) => {
    const token = await getToken();
    if (!token) return;
    setPendingActions((p) => ({ ...p, [`send-${draftId}`]: true }));
    try {
      const updated = await sendDraft(token, draftId);
      setDrafts((prev) => prev.map((d) => (d.id === draftId ? updated : d)));
      showSuccess("Póstur sendur");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gat ekki sent póst");
    } finally {
      setPendingActions((p) => ({ ...p, [`send-${draftId}`]: false }));
    }
  };

  const handleDelete = async (draftId: string) => {
    const token = await getToken();
    if (!token) return;
    setPendingActions((p) => ({ ...p, [`del-${draftId}`]: true }));
    try {
      await deleteDraft(token, draftId);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      showSuccess("Pósti eytt");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gat ekki eytt pósti");
    } finally {
      setPendingActions((p) => ({ ...p, [`del-${draftId}`]: false }));
    }
  };

  /** Load a draft's data into the form for editing. */
  const handleEdit = (draft: EmailDraft) => {
    setForm({
      subject: draft.subject,
      preheader: draft.preheader || "",
      template: draft.template,
      manualRecipients: draft.manual_recipients?.join(", ") || "",
      scheduledAt: draft.scheduled_at ? draft.scheduled_at.slice(0, 16) : "",
    });
    if (usesBlockEditor(draft.template) && Array.isArray(draft.blocks)) {
      setBlocks(draft.blocks as Block[]);
      setTemplateVars({});
    } else if (draft.blocks && Array.isArray(draft.blocks) && draft.blocks.length === 1) {
      setTemplateVars(draft.blocks[0] as Record<string, string>);
      setBlocks([]);
    } else {
      setBlocks([]);
      setTemplateVars({});
    }
    setEditingDraftId(draft.id);
    setShowForm(true);
  };

  /** Duplicate a sent/failed draft as a new draft for resending. */
  const handleResend = async (draft: EmailDraft) => {
    const token = await getToken();
    if (!token) return;
    setError(null);
    try {
      const newDraft = await createDraft(token, {
        subject: draft.subject,
        preheader: draft.preheader,
        template: draft.template,
        blocks: draft.blocks,
        manual_recipients: draft.manual_recipients,
        scheduled_at: null,
      });
      setDrafts((prev) => [newDraft, ...prev]);
      showSuccess("Afrit búið til — breyttu og sendu aftur");
      handleEdit(newDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gat ekki búið til afrit");
    }
  };

  const addBlock = (type: BlockType) => {
    const base: Block = { type };
    if (type === "heading" || type === "text") base.text = "";
    if (type === "image") { base.src = ""; base.alt = ""; }
    if (type === "cta") { base.label = ""; base.url = ""; }
    if (type === "feature_card") { base.title = ""; base.description = ""; }
    setBlocks((prev) => [...prev, base]);
  };

  const updateBlock = (index: number, field: string, value: string) => {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  };

  const removeBlock = (index: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const moveBlock = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    setBlocks((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleCreateOrUpdate = async () => {
    const token = await getToken();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const manual = form.manualRecipients
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      // Newsletter uses block array; other templates use flat key/value dict
      const blocksData: Record<string, unknown>[] | null = usesBlockEditor(form.template)
        ? blocks.length > 0 ? blocks : null
        : Object.keys(templateVars).length > 0 ? [templateVars as Record<string, unknown>] : null;
      const payload = {
        subject: form.subject,
        preheader: form.preheader || null,
        template: form.template,
        blocks: blocksData,
        manual_recipients: manual.length > 0 ? manual : null,
        scheduled_at: form.scheduledAt || null,
      };

      let draft: EmailDraft;
      if (editingDraftId) {
        draft = await updateDraft(token, editingDraftId, payload);
        setDrafts((prev) => prev.map((d) => (d.id === draft.id ? draft : d)));
      } else {
        draft = await createDraft(token, payload);
        setDrafts((prev) => [draft, ...prev]);
      }
      setForm(EMPTY_FORM);
      setBlocks([]);
      setTemplateVars({});
      setEditingDraftId(null);
      setShowForm(false);
      showSuccess(editingDraftId ? "Póstur uppfærður" : "Póstur vistaður");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gat ekki vistað póst");
    } finally {
      setSaving(false);
    }
  };

  if (!authLoading && currentUser?.permissions !== "admin") {
    return (
      <div className={styles.accessDenied}>
        <p>Þú hefur ekki aðgang að þessari síðu.</p>
      </div>
    );
  }

  return (
    <>
      {/* Templates */}
      <section className={styles.section}>
        <div className={styles.toolbar}>
          <span className={styles.totalCount}>
            {templates.length} {templates.length === 1 ? "sniðmát" : "sniðmát"}
          </span>
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {successMsg && <p className={styles.success}>{successMsg}</p>}

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Nafn</th>
                <th className={styles.th}>Lýsing</th>
                <th className={styles.th}>Breytur</th>
                <th className={styles.th}>Aðgerðir</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className={styles.centeredCell}>
                    Hleð…
                  </td>
                </tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.centeredCell}>
                    Engin sniðmát fundust.
                  </td>
                </tr>
              ) : (
                templates.map((t) => (
                  <tr key={t.name} className={styles.row}>
                    <td className={styles.td}>
                      <span className={styles.templateName}>{t.name}</span>
                    </td>
                    <td className={styles.td}>{t.description}</td>
                    <td className={`${styles.td} ${styles.wrapCell}`}>
                      {t.variables.map((v) => (
                        <span key={v} className={`${styles.templateName} ${styles.varTag}`}>
                          {v}
                        </span>
                      ))}
                    </td>
                    <td className={styles.td}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => handlePreview(t.name)}
                        disabled={pendingActions[`preview-${t.name}`]}
                      >
                        {pendingActions[`preview-${t.name}`] ? "…" : "Forskoða"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Create draft */}
      <section className={styles.section}>
        {!showForm ? (
          <button className={styles.createBtn} onClick={() => setShowForm(true)}>
            + Setja saman nýjan póst
          </button>
        ) : (
          <div className={styles.formCard}>
            <h3 className={styles.formTitle}>{editingDraftId ? "Breyta pósti" : "Setja saman nýjan póst"}</h3>

            <label className={styles.label}>
              Sniðmát
              <select
                className={styles.input}
                value={form.template}
                onChange={(e) => setForm((f) => ({ ...f, template: e.target.value }))}
              >
                {templates.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} — {t.description}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.label}>
              Efni (subject)
              <input
                className={styles.input}
                type="text"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Fyrirsögn tölvupósts"
              />
              {form.subject.length > 2 && form.subject === form.subject.toUpperCase() && (
                <span className={styles.warning}>
                  Efnislína í hástöfum getur lent í ruslpósti
                </span>
              )}
            </label>

            <label className={styles.label}>
              Forskoðunartexti (preheader)
              <input
                className={styles.input}
                type="text"
                value={form.preheader}
                onChange={(e) => setForm((f) => ({ ...f, preheader: e.target.value }))}
                placeholder="Stuttur texti sem sést í innhólfi"
              />
            </label>

            {/* Template-specific fields (non-newsletter) */}
            {!usesBlockEditor(form.template) && TEMPLATE_VAR_FIELDS[form.template] && (
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>Efni sniðmáts</legend>
                {TEMPLATE_VAR_FIELDS[form.template].map((f) => (
                  <label key={f.key} className={styles.label}>
                    {f.label}
                    <input
                      className={styles.input}
                      type="text"
                      placeholder={f.placeholder}
                      value={templateVars[f.key] || ""}
                      onChange={(e) =>
                        setTemplateVars((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                    />
                  </label>
                ))}
              </fieldset>
            )}

            {/* Block editor (newsletter only) */}
            {usesBlockEditor(form.template) && (
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>Blokkir</legend>
                {blocks.map((block, i) => (
                  <div key={i} className={styles.blockRow}>
                    <div className={styles.blockHeader}>
                      <span className={styles.blockType}>{block.type}</span>
                      <div className={styles.blockActions}>
                        <button type="button" className={styles.blockBtn} onClick={() => moveBlock(i, -1)} disabled={i === 0}>↑</button>
                        <button type="button" className={styles.blockBtn} onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1}>↓</button>
                        <button type="button" className={styles.blockBtnDanger} onClick={() => removeBlock(i)}>✕</button>
                      </div>
                    </div>
                    {(block.type === "heading" || block.type === "text") && (
                      <input className={styles.input} type="text" placeholder={block.type === "heading" ? "Fyrirsögn" : "Texti"} value={(block.text as string) || ""} onChange={(e) => updateBlock(i, "text", e.target.value)} />
                    )}
                    {block.type === "image" && (
                      <>
                        <input className={styles.input} type="text" placeholder="Slóð myndar (URL)" value={(block.src as string) || ""} onChange={(e) => updateBlock(i, "src", e.target.value)} />
                        <input className={styles.input} type="text" placeholder="Alt-texti" value={(block.alt as string) || ""} onChange={(e) => updateBlock(i, "alt", e.target.value)} />
                      </>
                    )}
                    {block.type === "cta" && (
                      <>
                        <input className={styles.input} type="text" placeholder="Texti á hnapp" value={(block.label as string) || ""} onChange={(e) => updateBlock(i, "label", e.target.value)} />
                        <input className={styles.input} type="text" placeholder="Slóð (URL)" value={(block.url as string) || ""} onChange={(e) => updateBlock(i, "url", e.target.value)} />
                      </>
                    )}
                    {block.type === "feature_card" && (
                      <>
                        <input className={styles.input} type="text" placeholder="Titill" value={(block.title as string) || ""} onChange={(e) => updateBlock(i, "title", e.target.value)} />
                        <input className={styles.input} type="text" placeholder="Lýsing" value={(block.description as string) || ""} onChange={(e) => updateBlock(i, "description", e.target.value)} />
                      </>
                    )}
                  </div>
                ))}
                <div className={styles.addBlockRow}>
                  {BLOCK_TYPES.map((bt) => (
                    <button key={bt.value} type="button" className={styles.addBlockBtn} onClick={() => addBlock(bt.value)}>+ {bt.label}</button>
                  ))}
                </div>
              </fieldset>
            )}

            <label className={styles.label}>
              Viðtakendur (kommuaðskildir, autt = póstlisti)
              <input
                className={styles.input}
                type="text"
                value={form.manualRecipients}
                onChange={(e) => setForm((f) => ({ ...f, manualRecipients: e.target.value }))}
                placeholder="jon@example.com, anna@example.com"
              />
            </label>

            <label className={styles.label}>
              Tímasetja sendingu (valfrjálst)
              <input
                className={styles.input}
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              />
            </label>

            <div className={styles.formActions}>
              <button
                className={styles.sendBtn}
                onClick={handleCreateOrUpdate}
                disabled={saving || !form.subject.trim()}
              >
                {saving ? "Vista…" : editingDraftId ? "Uppfæra póst" : "Vista póst"}
              </button>
              <button
                className={styles.actionBtn}
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                  setBlocks([]);
                  setTemplateVars({});
                  setEditingDraftId(null);
                }}
              >
                Hætta við
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Drafts */}
      <section className={styles.section}>
        <div className={styles.toolbar}>
          <span className={styles.totalCount}>
            {drafts.length} {drafts.length === 1 ? "póstur" : "póstar"}
          </span>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Efni</th>
                <th className={styles.th}>Sniðmát</th>
                <th className={styles.th}>Staða</th>
                <th className={styles.th}>Búið til</th>
                <th className={styles.th}>Aðgerðir</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className={styles.centeredCell}>
                    Hleð…
                  </td>
                </tr>
              ) : drafts.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.centeredCell}>
                    Engir póstar fundust.
                  </td>
                </tr>
              ) : (
                drafts.map((d) => (
                  <tr key={d.id} className={styles.row}>
                    <td className={styles.td}>{d.subject}</td>
                    <td className={styles.td}>
                      <span className={styles.templateName}>{d.template}</span>
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.statusBadge} ${STATUS_CLASSES[d.status]}`}>
                        {STATUS_LABELS[d.status]}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.date}>{formatDate(d.created_at)}</span>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.actions}>
                        {d.status === "draft" && (
                          <button
                            className={styles.actionBtn}
                            onClick={() => handleEdit(d)}
                          >
                            Breyta
                          </button>
                        )}
                        {(d.status === "draft" || d.status === "scheduled") && (
                          <>
                            <button
                              className={styles.actionBtn}
                              onClick={() => handleTestSend(d.id)}
                              disabled={pendingActions[`test-${d.id}`]}
                              title={`Sendir prufupóst á ${currentUser?.email ?? "þitt netfang"}`}
                            >
                              {pendingActions[`test-${d.id}`] ? "…" : "Prufa"}
                            </button>
                            <button
                              className={styles.sendBtn}
                              onClick={() => handleSend(d.id)}
                              disabled={pendingActions[`send-${d.id}`]}
                            >
                              {pendingActions[`send-${d.id}`] ? "…" : "Senda"}
                            </button>
                          </>
                        )}
                        {(d.status === "sent" || d.status === "failed") && (
                          <button
                            className={styles.actionBtn}
                            onClick={() => handleResend(d)}
                            title="Búa til afrit og senda aftur"
                          >
                            Endursenda
                          </button>
                        )}
                        {(d.status === "draft" || d.status === "failed") && (
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDelete(d.id)}
                            disabled={pendingActions[`del-${d.id}`]}
                          >
                            {pendingActions[`del-${d.id}`] ? "…" : "Eyða"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Preview modal */}
      {previewHtml && (
        <div className={styles.previewOverlay} onClick={() => setPreviewHtml(null)}>
          <div className={styles.previewModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.previewHeader}>
              <h3 className={styles.previewTitle}>{previewName}</h3>
              <button className={styles.previewClose} onClick={() => setPreviewHtml(null)}>
                Loka
              </button>
            </div>
            <div className={styles.previewBody}>
              <iframe srcDoc={previewHtml} title={`Forskoðun: ${previewName}`} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
