import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Alert from "./Alert";

const meta = {
  title: "Design system/Primitives/Alert",
  component: Alert,
  args: {
    variant: "info",
    children: "Dagskráin er vistuð sem drög þar til þú birtir hana.",
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["success", "warning", "error", "info"] },
  },
  // Clean under axe in all four forms: a new violation fails CI (docs/ui-quality-pipeline.md).
  parameters: { a11y: { test: "error" } },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {};

export const Success: Story = {
  args: {
    variant: "success",
    title: "Vistað",
    children: "„Kötturinn og músin“ er komin í bankann.",
  },
};

export const Warning: Story = {
  args: {
    variant: "warning",
    title: "Athugaðu",
    children: "Ratleikur um hverfið hefur engar öryggisleiðbeiningar.",
  },
};

export const ErrorAlert: Story = {
  name: "Error",
  args: {
    variant: "error",
    title: "Villa",
    children: "Ekki tókst að vista dagskrána. Reyndu aftur.",
  },
};

export const LongText: Story = {
  args: {
    variant: "warning",
    title: "Dagskráin bíður yfirferðar hjá Dagskrárstjórnarteyminu",
    children:
      "Á meðan dagskráin er í yfirferð sjá aðrir foringjar hana ekki í bankanum. Þú getur haldið áfram að breyta henni, en hver breyting sendir hana aftur í röðina. Venjulega tekur yfirferð tvo til þrjá daga.",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <Alert variant="success" title="Tókst">
        Dagskráin var birt.
      </Alert>
      <Alert variant="warning" title="Athugaðu">
        Vantar staðsetningu.
      </Alert>
      <Alert variant="error" title="Villa">
        Tenging við netþjón rofnaði.
      </Alert>
      <Alert variant="info" title="Til upplýsingar">
        Nýr ratleikur bættist við bankann.
      </Alert>
    </div>
  ),
};
