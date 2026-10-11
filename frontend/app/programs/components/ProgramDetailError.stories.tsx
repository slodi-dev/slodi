import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgramDetailError } from "./ProgramDetailError";

const meta = {
  title: "Components/Dagskrárbanki/ProgramDetailError",
  component: ProgramDetailError,
  args: { error: new Error("404 not found") },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ProgramDetailError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotFound: Story = {};

export const ServerError: Story = {
  args: { error: new Error("API error: Internal Server Error") },
};

export const LongErrorMessage: Story = {
  args: {
    error: new Error(
      "API error: Service Unavailable — gagnagrunnurinn svaraði ekki innan tímamarka og " +
        "beiðnin var reynd þrisvar áður en gefist var upp. Reyndu aftur eftir smástund."
    ),
  },
};
