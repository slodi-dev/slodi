import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import Button from "./Button";

const meta = {
  title: "Design system/Primitives/Button",
  component: Button,
  args: {
    children: "Vista dagskrá",
    onClick: fn(),
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["primary", "secondary", "muted", "danger", "ghost", "info"],
    },
  },
  parameters: {
    // Stays "todo" (preview.tsx) until sc-586: primary, danger and dark secondary fail AA contrast.
    docs: {
      description: {
        component:
          "The system button. **Known issue (sc-553):** it still reads the legacy shadcn tokens " +
          "(`--primary`, `--foreground`, `--error`…) from `globals.css` instead of `--sl-*`, so it " +
          "ignores the patrol colour and the named themes — switch the Sveit toolbar to `drekar` " +
          "and compare `primary` with any `--sl-color-primary` surface. Its focus ring is also a " +
          "faint 2px legacy shadow; see the `FocusRing` story.",
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: "primary" } };
export const Secondary: Story = { args: { variant: "secondary", children: "Hætta við" } };
export const Muted: Story = { args: { variant: "muted", children: "Sjá meira" } };
export const Danger: Story = { args: { variant: "danger", children: "Eyða dagskrá" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Loka" } };
export const Info: Story = { args: { variant: "info", children: "Leiðbeiningar" } };

export const Disabled: Story = { args: { variant: "primary", disabled: true } };

export const FullWidth: Story = {
  args: { fullWidth: true, children: "Skrá mig inn" },
};

export const AsLink: Story = {
  args: { as: "a", href: "#dagskrarbankinn", children: "Opna dagskrárbankann" },
};

export const LongText: Story = {
  args: {
    children: "Senda dagskrána til yfirferðar hjá Dagskrárstjórnarteyminu",
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 240 }}>
        <Story />
      </div>
    ),
  ],
};

export const AllVariants: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
      {(["primary", "secondary", "muted", "danger", "ghost", "info"] as const).map((v) => (
        <Button key={v} {...args} variant={v}>
          {v}
        </Button>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Known issue sc-553 (story `design-system-primitives-button--all-variants`): every " +
          "variant resolves through legacy tokens, so none of them follow the Sveit toolbar.",
      },
    },
  },
};

export const FocusRing: Story = {
  args: { autoFocus: true, children: "Tab hingað" },
  parameters: {
    pseudo: { focusVisible: true },
    docs: {
      description: {
        story:
          "Known issue sc-549 (story `design-system-primitives-button--focus-ring`): click into " +
          "the canvas and press Tab. The ring is a 2px shadow at 50% legacy primary — very hard " +
          "to see, and it vanishes against a primary-coloured surface.",
      },
    },
  },
};
