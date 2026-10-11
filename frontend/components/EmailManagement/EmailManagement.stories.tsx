import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import type { EmailDraft, TemplateInfo } from "@/services/emails.service";
import EmailManagement from "./EmailManagement";

const templates: TemplateInfo[] = [
  { name: "newsletter", description: "Fréttabréf með frjálsum kubbum", variables: [] },
  { name: "welcome", description: "Velkomstpóstur fyrir nýja notendur", variables: ["user_name"] },
  {
    name: "workspace_invite",
    description: "Boð í vinnusvæði",
    variables: ["inviter_name", "workspace_name", "personal_note", "accept_url"],
  },
  {
    name: "new_feature",
    description: "Kynning á nýjum eiginleika",
    variables: ["feature_name", "feature_description", "cta_label", "cta_url"],
  },
];

const base: Omit<EmailDraft, "id" | "subject" | "status"> = {
  preheader: null,
  template: "newsletter",
  blocks: [],
  recipient_list_id: null,
  manual_recipients: null,
  scheduled_at: null,
  sent_at: null,
  created_by: "u-3",
  created_at: "2026-09-28T10:00:00Z",
  updated_at: null,
};

const drafts: EmailDraft[] = [
  { ...base, id: "d-1", subject: "Fréttabréf Slóða — október", status: "draft" },
  {
    ...base,
    id: "d-2",
    subject: "Nýtt í Dagskrárbankanum: Ratleikur um hverfið",
    template: "new_feature",
    status: "scheduled",
    scheduled_at: "2026-10-15T09:00:00Z",
  },
  {
    ...base,
    id: "d-3",
    subject: "Velkomin í Slóða",
    template: "welcome",
    status: "sent",
    sent_at: "2026-09-01T12:00:00Z",
  },
  { ...base, id: "d-4", subject: "Prufupóstur sem mistókst", status: "failed" },
  { ...base, id: "d-5", subject: "Fréttabréf í vinnslu", status: "processing" },
];

function routes(t: unknown, d: unknown): MockRoute[] {
  return [
    { match: /\/emails\/templates\/[^/]+\/preview/, body: "<p>Forskoðun</p>" },
    { match: /\/emails\/templates$/, body: t },
    { match: /\/emails\/drafts$/, body: d },
  ];
}

const meta = {
  title: "Components/Stjórnun/EmailManagement",
  component: EmailManagement,
  parameters: {
    auth: "admin",
    mockApi: routes(templates, drafts),
    docs: {
      description: {
        component:
          "Admin tool for composing and sending email from templates. Known issue sc-549 " +
          "(story `components-stjórnun-emailmanagement--compose-form`): form inputs use " +
          "`--sl-input-shadow-focus`, an invalid box-shadow, for their focus ring. " +
          "Design-token audit finding: one literal `hsl(0…)` colour in EmailManagement.module.css.",
      },
    },
  },
} satisfies Meta<typeof EmailManagement>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  parameters: {
    mockApi: [
      { match: /\/emails\/templates$/, delay: Infinity },
      { match: /\/emails\/drafts$/, delay: Infinity },
    ],
  },
};

export const Empty: Story = { parameters: { mockApi: routes([], []) } };

export const LoadError: Story = {
  parameters: {
    mockApi: [
      { match: /\/emails\/templates$/, status: 500, body: { detail: "Villa" } },
      { match: /\/emails\/drafts$/, body: [] },
    ],
  },
};

export const ComposeForm: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /Setja saman nýjan póst/ }));
  },
};
