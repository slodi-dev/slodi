import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import Modal from "./Modal";

const meta = {
  title: "Design system/Primitives/Modal",
  component: Modal,
  args: {
    open: true,
    onClose: fn(),
    title: "Kötturinn og músin",
    children: (
      <p>
        Klassískur hlaupaleikur þar sem hópurinn myndar hring og köttur eltir mús inn og út úr
        hringnum.
      </p>
    ),
  },
  parameters: {
    // Clean under axe in all four forms: a new violation fails CI (docs/ui-quality-pipeline.md).
    a11y: { test: "error" },
    layout: "fullscreen",
    docs: { story: { inline: false, height: "420px" } },
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutTitle: Story = {
  args: { title: undefined, ariaLabel: "Staðfesting" },
};

export const Wide: Story = {
  args: {
    size: "wide",
    title: "Þrautablað.pdf",
    children: (
      <div
        style={{
          height: 280,
          display: "grid",
          placeItems: "center",
          background: "hsl(var(--sl-color-background-secondary))",
        }}
      >
        Skjalaforskoðun
      </div>
    ),
  },
};

export const ConfirmOnClose: Story = {
  args: {
    title: "Ný dagskrá",
    confirmOnClose: "Ertu viss? Óvistaðar breytingar tapast.",
    children: <p>Smelltu á ✕ — þá er spurt áður en glugganum er lokað.</p>,
  },
};

export const LongContent: Story = {
  args: {
    title:
      "Næturganga um Heiðmörk með vasaljósum, stjörnuskoðun og sögum af álfum og huldufólki við varðeldinn",
    children: (
      <div>
        {Array.from({ length: 12 }, (_, i) => (
          <p key={i}>
            {i + 1}. Við göngum frá Elliðavatni inn í Heiðmörk eftir að skyggja tekur og stöðvum við
            Hjallaflatir þar sem hver flokkur segir eina þjóðsögu.
          </p>
        ))}
      </div>
    ),
  },
};

export const Closed: Story = {
  args: { open: false },
  parameters: { layout: "padded" },
};
