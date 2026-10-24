import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import ItemSections from "./ItemSections";
import ItemHero, { type HeroImage } from "./ItemHero";
import {
  comments,
  placeholderImage,
  programKotturinn,
  programRatleikur,
  userMember,
} from "@/stories/fixtures";

const images: HeroImage[] = [
  { url: placeholderImage("Ratleikur", 177), alt: "Skátar við fyrstu stöð" },
  { url: placeholderImage("Kort", 142), alt: "Kort af hverfinu" },
];

const meta = {
  title: "Components/Efnissíða/ItemSections",
  component: ItemSections,
  args: {
    program: programKotturinn,
    images: [],
    heroIndex: 0,
    onHeroIndexChange: fn(),
    comments,
    canComment: true,
    onSubmitComment: fn(async () => {}),
    currentUserName: userMember.name,
    heroSlot: null,
    onOpenDocument: fn(),
    onReportComment: fn(),
    onRemoveComment: fn(),
    onEditComment: fn(async () => {}),
    canEditComment: (): boolean => false,
    canRemoveComment: (): boolean => true,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ItemSections>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithImagesAndDocuments: Story = {
  args: {
    program: programRatleikur,
    images,
    heroSlot: <ItemHero images={images} index={0} onIndexChange={() => {}} />,
  },
};

export const InlineNumberedInstructions: Story = {
  name: "Instructions typed inline („1. … 2. …“)",
  args: {
    program: {
      ...programKotturinn,
      instructions:
        "1. Skiptið hópnum í tvö lið. 2. Hvort lið fær fána. 3. Liðið sem nær fána hins vinnur.",
    },
  },
};

export const Empty: Story = {
  name: "Empty — nothing filled in",
  args: {
    program: {
      ...programKotturinn,
      description: null,
      instructions: null,
      equipment: [],
      tags: [],
      media: null,
    },
    comments: [],
  },
};

export const ReadOnlyVisitor: Story = {
  name: "Visitor who cannot comment",
  args: { canComment: false, currentUserName: null },
};

export const OwnComments: Story = {
  name: "Reader wrote the comments — edit and remove",
  args: { canEditComment: () => true },
  parameters: {
    docs: {
      description: {
        story:
          "Hover a comment and press the pencil: the text becomes a field. Ctrl+Enter saves, Escape backs out.",
      },
    },
  },
};

export const OthersComments: Story = {
  name: "Someone else's comments — report only",
  args: { canRemoveComment: () => false },
};

export const CommentFails: Story = {
  args: {
    onSubmitComment: fn(async () => {
      throw new Error("Ekki tókst að senda athugasemdina. Reyndu aftur.");
    }),
  },
  parameters: {
    docs: {
      description: {
        story: "Type a comment and press send: the submit handler rejects and the error shows.",
      },
    },
  },
};
