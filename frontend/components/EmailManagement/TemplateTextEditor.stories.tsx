import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import type { TemplateTextConfig } from "@/services/emails.service";
import TemplateTextEditor from "./TemplateTextEditor";

const config: TemplateTextConfig = {
  welcome: {
    heading: "Velkomin í Slóða, {user_name}!",
    intro: "Slóði hjálpar skátaforingjum að skipuleggja fjölbreytta dagskrá.",
    bullet_1: "Finndu hugmyndir í Dagskrárbankanum",
    bullet_2: "Settu saman dagskrá fyrir önnina",
    bullet_3: "Deildu þínum bestu leikjum með öðrum",
    cta_label: "Skrá mig inn",
    closing: "Með skátakveðju, Slóða teymið",
  },
  workspace_invite: {
    heading: "Þér er boðið í vinnusvæði",
    intro: "{inviter_name} bauð þér í {workspace_name}.",
    cta_label: "Samþykkja boð",
    disclaimer: "Ef þú átt ekki von á þessum pósti máttu hunsa hann.",
  },
  newsletter: { unsubscribe_label: "Afskrá mig" },
  new_feature: { badge_label: "NÝTT", unsubscribe_label: "Afskrá mig" },
  footer: { copyright: "2026 Slóði" },
};

const textRoute = (r: Partial<MockRoute>): MockRoute => ({
  match: /\/emails\/templates\/text/,
  ...r,
});

const meta = {
  title: "Components/Stjórnun/TemplateTextEditor",
  component: TemplateTextEditor,
  parameters: {
    auth: "admin",
    mockApi: [textRoute({ body: config })],
    docs: {
      description: {
        component:
          "Edits the fixed copy inside each email template. Known issue sc-549 (story " +
          "`components-stjórnun-templatetexteditor--section-open`): fields use " +
          "`--sl-input-shadow-focus`, an invalid box-shadow, so focus is barely visible.",
      },
    },
  },
} satisfies Meta<typeof TemplateTextEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SectionOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /Velkomstpóstur/ }));
  },
};

export const Loading: Story = {
  parameters: { mockApi: [textRoute({ delay: Infinity })] },
};

export const LoadError: Story = {
  parameters: {
    mockApi: [textRoute({ status: 500, body: { detail: "Villa" } })],
    docs: {
      description: {
        story:
          "Renders nothing: the component returns `null` while `config` is empty, before it " +
          "reaches the error message, so a failed load is silent. Shown as-is, not fixed here.",
      },
    },
  },
};
