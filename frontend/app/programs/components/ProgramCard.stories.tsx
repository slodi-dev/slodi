import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import ProgramCard from "./ProgramCard";
import {
  programKotturinn,
  programLongText,
  programRatleikur,
  programSkyndihjalp,
} from "@/stories/fixtures";
import type { Program } from "@/services/programs.service";

/** Spread a fixture Program into the card's flat props. */
function cardProps(p: Program) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    image: p.image,
    author: p.author,
    tags: p.tags,
    like_count: p.like_count,
    liked_by_me: p.liked_by_me,
    created_at: p.created_at,
    duration_min: p.duration_min,
    duration_max: p.duration_max,
    count_min: p.count_min,
    count_max: p.count_max,
    price: p.price,
    location: p.location,
    age: p.age,
  };
}

const meta = {
  title: "Components/Dagskrárbanki/ProgramCard",
  component: ProgramCard,
  args: cardProps(programKotturinn),
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "One item in Dagskrárbankinn. Like and favourite state come from the real " +
          "LikesProvider/FavoritesProvider; the like request is answered by the Storybook fetch mock.",
      },
    },
  },
} satisfies Meta<typeof ProgramCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Liked: Story = {
  args: cardProps(programRatleikur),
};

export const WithoutImage: Story = {
  args: cardProps(programSkyndihjalp),
};

export const Minimal: Story = {
  name: "Minimal (name only)",
  args: {
    id: "p-min",
    name: "Kvöldvaka",
    description: null,
    image: null,
    author: undefined,
    tags: [],
    like_count: 0,
    created_at: undefined,
    duration_min: null,
    duration_max: null,
    count_min: null,
    count_max: null,
    price: null,
    location: null,
    age: null,
  },
};

export const LongText: Story = {
  args: cardProps(programLongText),
  parameters: {
    docs: {
      description: {
        story:
          "Long title, long description, seven tags (four shown plus an overflow count), four age " +
          "groups and a four-digit like count.",
      },
    },
  },
};

export const EditableByAuthor: Story = {
  args: {
    canEdit: true,
    canDelete: true,
    onEdit: fn(),
    onDelete: fn(),
  },
};

export const LikeRequestFails: Story = {
  args: cardProps(programKotturinn),
  parameters: {
    mockApi: [{ match: /\/content\/[^/]+\/likes/, status: 500, body: { detail: "Villa" } }],
    docs: {
      description: {
        story:
          "The like endpoint returns 500: click the heart and the optimistic count rolls back.",
      },
    },
  },
};
