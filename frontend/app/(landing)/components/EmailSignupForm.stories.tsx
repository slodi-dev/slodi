import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import EmailSignupForm from "./EmailSignupForm";

const EMAILLIST = /\/emaillist$/;

/** Types an address and submits, so a story lands in the state it names. */
async function submit(canvasElement: HTMLElement, email = "sigga@skatar.is") {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByLabelText("Netfang"), email);
  await userEvent.click(canvas.getByRole("button", { name: "Skrá mig á póstlista" }));
}

const meta = {
  title: "Components/Forsíða/EmailSignupForm",
  component: EmailSignupForm,
  parameters: {
    layout: "fullscreen",
    mockApi: [{ match: EMAILLIST, method: "POST", status: 201, body: { ok: true } }],
    docs: {
      description: {
        component:
          "Mailing-list signup on the landing page. Posts to `${NEXT_PUBLIC_API_URL}/emaillist`; " +
          "Storybook answers from the fetch mock.",
      },
    },
  },
} satisfies Meta<typeof EmailSignupForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Known issue sc-549 (story `components-forsíða-emailsignupform--default`): focus the " +
          "email field — its `box-shadow: var(--sl-shadow-focus)` is invalid, so the only focus " +
          "cue is the border turning primary.",
      },
    },
  },
};

export const Success: Story = {
  play: async ({ canvasElement }) => {
    await submit(canvasElement);
    await expect(
      await within(canvasElement).findByText("Takk fyrir að skrá þig á póstlistann!")
    ).toBeInTheDocument();
  },
};

export const Submitting: Story = {
  parameters: { mockApi: [{ match: EMAILLIST, method: "POST", delay: Infinity }] },
  play: async ({ canvasElement }) => submit(canvasElement),
};

export const AlreadySubscribed: Story = {
  parameters: {
    mockApi: [{ match: EMAILLIST, method: "POST", status: 409, body: { detail: "Til" } }],
  },
  play: async ({ canvasElement }) => submit(canvasElement),
};

export const ServerError: Story = {
  parameters: {
    mockApi: [{ match: EMAILLIST, method: "POST", status: 500, body: { detail: "Villa" } }],
  },
  play: async ({ canvasElement }) => submit(canvasElement),
};

/** Passes the browser's email check but not the form's own (no dot in the domain). */
export const InvalidEmail: Story = {
  play: async ({ canvasElement }) => submit(canvasElement, "sigga@skatar"),
};
