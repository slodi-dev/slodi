import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useRef, useState } from "react";
import { fn } from "storybook/test";
import FilterSidebar, { FilterDrawer, type FilterSidebarProps } from "./FilterSidebar";
import { programs, tags, users } from "@/stories/fixtures";

const baseArgs: FilterSidebarProps = {
  selectedAges: [],
  onAgesChange: fn(),
  availableTags: tags.map((t) => t.name),
  selectedTags: [],
  onTagsChange: fn(),
  uniqueEquipment: Array.from(new Set(programs.flatMap((p) => p.equipment ?? []))),
  selectedEquipment: [],
  onEquipmentChange: fn(),
  authorValue: "",
  onAuthorChange: fn(),
  uniqueAuthors: users.map((u) => u.name),
  durationMin: undefined,
  durationMax: undefined,
  onDurationChange: fn(),
  prepMin: undefined,
  prepMax: undefined,
  onPrepTimeChange: fn(),
  countMin: undefined,
  countMax: undefined,
  onParticipantChange: fn(),
  freeOnly: false,
  priceMax: undefined,
  onPriceChange: fn(),
  locationValue: "",
  onLocationChange: fn(),
  uniqueLocations: Array.from(new Set(programs.map((p) => p.location ?? "").filter(Boolean))),
};

const meta = {
  title: "Components/Síur/FilterSidebar",
  component: FilterSidebar,
  args: baseArgs,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 300 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Desktop filter column assembling all nine filters. Design-token audit finding: " +
          "`FilterSidebar.module.css` uses literal `hsl()`/`rgba()` colours (lines 53, 81, 82) " +
          "instead of `--sl-color-*` tokens, so those shades do not follow the theme (see story " +
          "`components-síur-filtersidebar--mobile-drawer`, whose backdrop is one of them).",
      },
    },
  },
} satisfies Meta<typeof FilterSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActiveFilters: Story = {
  args: {
    selectedAges: ["Drekaskátar", "Fálkaskátar"],
    selectedTags: ["útivist"],
    selectedEquipment: ["Áttavitar"],
    authorValue: "Sigríður Jónsdóttir",
    durationMin: 30,
    durationMax: 60,
    freeOnly: true,
    locationValue: "Skátaheimilið",
  },
};

export const EmptyBank: Story = {
  name: "Empty bank (no facets)",
  args: { availableTags: [], uniqueEquipment: [], uniqueAuthors: [], uniqueLocations: [] },
};

/** Mobile drawer variant. */
export const MobileDrawer: Story = {
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
    docs: {
      story: { inline: false, iframeHeight: 640 },
      description: {
        story:
          "`FilterDrawer`: the mobile slide-out wrapping the sidebar, with focus trap and scroll lock.",
      },
    },
  },
  decorators: [(Story) => <Story />],
  render: function Render(args) {
    const [open, setOpen] = useState(true);
    const trigger = useRef<HTMLButtonElement>(null);
    return (
      <div style={{ padding: "1rem" }}>
        <button ref={trigger} type="button" onClick={() => setOpen(true)}>
          Opna síur
        </button>
        <FilterDrawer
          {...args}
          isOpen={open}
          onClose={() => setOpen(false)}
          activeFilterCount={3}
          triggerRef={trigger}
        />
      </div>
    );
  },
};
