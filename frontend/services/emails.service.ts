import { buildApiUrl } from "@/lib/api-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateInfo = {
  name: string;
  description: string;
  variables: string[];
};

export type EmailDraft = {
  id: string;
  subject: string;
  preheader: string | null;
  template: string;
  blocks: Record<string, unknown>[] | null;
  recipient_list_id: string | null;
  manual_recipients: string[] | null;
  status: "draft" | "scheduled" | "processing" | "sent" | "failed";
  scheduled_at: string | null;
  sent_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
};

export type DraftCreateInput = {
  subject: string;
  preheader?: string | null;
  template: string;
  blocks?: Record<string, unknown>[] | null;
  recipient_list_id?: string | null;
  manual_recipients?: string[] | null;
  scheduled_at?: string | null;
};

export type DraftUpdateInput = Partial<DraftCreateInput>;

export type TemplateTextConfig = Record<string, Record<string, string>>;

// ---------------------------------------------------------------------------
// Template text config (editable copy in email templates)
// ---------------------------------------------------------------------------

export async function getTemplateText(token: string): Promise<TemplateTextConfig> {
  const url = buildApiUrl("/emails/templates/text");
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to get template text: ${response.status}`);
  }
  return response.json();
}

export async function updateTemplateText(
  token: string,
  config: TemplateTextConfig
): Promise<TemplateTextConfig> {
  const url = buildApiUrl("/emails/templates/text");
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to update template text: ${response.status}`);
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function listTemplates(token: string): Promise<TemplateInfo[]> {
  const url = buildApiUrl("/emails/templates");
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to list templates: ${response.status}`);
  }
  return response.json();
}

export async function previewTemplate(token: string, name: string): Promise<string> {
  const url = buildApiUrl(`/emails/templates/${name}/preview`);
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to preview template: ${response.status}`);
  }
  return response.text();
}

// ---------------------------------------------------------------------------
// Drafts CRUD
// ---------------------------------------------------------------------------

export async function listDrafts(token: string): Promise<EmailDraft[]> {
  const url = buildApiUrl("/emails/drafts");
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to list drafts: ${response.status}`);
  }
  return response.json();
}

export async function createDraft(token: string, data: DraftCreateInput): Promise<EmailDraft> {
  const url = buildApiUrl("/emails/drafts");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to create draft: ${response.status}`);
  }
  return response.json();
}

export async function updateDraft(
  token: string,
  draftId: string,
  data: DraftUpdateInput
): Promise<EmailDraft> {
  const url = buildApiUrl(`/emails/drafts/${draftId}`);
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to update draft: ${response.status}`);
  }
  return response.json();
}

export async function deleteDraft(token: string, draftId: string): Promise<void> {
  const url = buildApiUrl(`/emails/drafts/${draftId}`);
  const response = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete draft: ${response.status}`);
  }
}

export async function sendDraft(token: string, draftId: string): Promise<EmailDraft> {
  const url = buildApiUrl(`/emails/drafts/${draftId}/send`);
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to send draft: ${response.status}`);
  }
  return response.json();
}

export async function testSendDraft(token: string, draftId: string): Promise<void> {
  const url = buildApiUrl(`/emails/drafts/${draftId}/test`);
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to send test email: ${response.status}`);
  }
}
