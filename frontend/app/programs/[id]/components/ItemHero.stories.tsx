import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import ItemHero, { type HeroImage } from "./ItemHero";
import { placeholderImage } from "@/stories/fixtures";

const images: HeroImage[] = [
  { url: placeholderImage("Ratleikur — stöð 1", 177), alt: "Skátar við fyrstu stöð ratleiksins" },
  { url: placeholderImage("Ratleikur — stöð 2", 142), alt: "Áttaviti og kort á bekk" },
  { url: placeholderImage("Ratleikur — stöð 3", 30), alt: "Flokkur fagnar við lokastöð" },
];

const meta = {
  title: "Components/Efnissíða/ItemHero",
  component: ItemHero,
  args: { images, index: 0, onIndexChange: fn() },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760 }}>
        <Story />
      </div>
    ),
  ],
  render: function Render(args) {
    const [index, setIndex] = useState(args.index);
    return (
      <ItemHero
        {...args}
        index={index}
        onIndexChange={(i) => {
          setIndex(i);
          args.onIndexChange(i);
        }}
      />
    );
  },
} satisfies Meta<typeof ItemHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Carousel: Story = {};

export const LastImage: Story = { args: { index: 2 } };

export const SingleImage: Story = {
  name: "Single image (no controls)",
  args: { images: images.slice(0, 1) },
};

export const NoImages: Story = {
  name: "No images (renders nothing)",
  args: { images: [] },
};
