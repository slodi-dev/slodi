import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import Pagination from "./Pagination";

const meta = {
  title: "Components/Dagskrárbanki/Pagination",
  component: Pagination,
  args: {
    currentPage: 1,
    totalPages: 5,
    totalItems: 58,
    itemsPerPage: 12,
    onPageChange: fn(),
  },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstPage: Story = {};

export const MiddlePage: Story = {
  args: { currentPage: 9, totalPages: 20, totalItems: 238 },
};

export const LastPage: Story = {
  args: { currentPage: 20, totalPages: 20, totalItems: 238 },
};

export const ManyPagesNearStart: Story = {
  args: { currentPage: 2, totalPages: 834, totalItems: 10004 },
};

export const SinglePage: Story = {
  name: "Single page (renders nothing)",
  args: { currentPage: 1, totalPages: 1, totalItems: 7 },
};

export const Interactive: Story = {
  render: function Render(args) {
    const [page, setPage] = useState(1);
    return (
      <Pagination
        {...args}
        currentPage={page}
        onPageChange={(p) => {
          setPage(p);
          args.onPageChange(p);
        }}
      />
    );
  },
  args: { totalPages: 12, totalItems: 140 },
};
