import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fireEvent, fn, userEvent, waitFor, within } from "storybook/test";
import RangeInput from "./RangeInput";

/**
 * Two handles on one track, with the values riding on the handles. Drag a handle, or tap its
 * value to type a number (a popover; a bottom sheet at 620px and below). A handle at the end
 * means no limit. Promoted from Lab/RangeInput, C2 · Tap to edit (2026-10-19).
 */
const meta = {
  title: "Design system/Primitives/RangeInput",
  component: RangeInput,
  args: {
    minValue: 15,
    maxValue: 60,
    onMinChange: fn(),
    onMaxChange: fn(),
    min: 0,
    max: 180,
    step: 5,
    unit: "mín",
    minLabel: "Lágmark: mínútur",
    maxLabel: "Hámark: mínútur",
  },
  // Holds the values, so the stories behave as in a filter. The args' spies still see each change.
  render: function Render(args) {
    const [lo, setLo] = useState(args.minValue);
    const [hi, setHi] = useState(args.maxValue);
    return (
      <RangeInput
        {...args}
        minValue={lo}
        maxValue={hi}
        onMinChange={(v) => {
          setLo(v);
          args.onMinChange(v);
        }}
        onMaxChange={(v) => {
          setHi(v);
          args.onMaxChange(v);
        }}
      />
    );
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280, paddingTop: "var(--sl-spacing-md)" }}>
        <Story />
      </div>
    ),
  ],
  // Clean under axe in all four forms: a new violation fails CI (docs/ui-quality-pipeline.md).
} satisfies Meta<typeof RangeInput>;

export default meta;
type Story = StoryObj<typeof meta>;

type Canvas = ReturnType<typeof within>;
const slider = (canvas: Canvas, name: "Lágmark" | "Hámark") =>
  canvas.getByRole("slider", { name: `${name}: mínútur` });
const valueButton = (canvas: Canvas, name: "Lágmark" | "Hámark") =>
  canvas.getByRole("button", { name: new RegExp(`^${name}: mínútur:`) });
/** The editor is in a portal on <body>, outside the story's canvas. */
const page = () => within(document.body);

export const Default: Story = { args: { hint: "15 – 60 mín" } };

export const NoLimits: Story = { args: { minValue: undefined, maxValue: undefined } };

export const OnlyMax: Story = { args: { minValue: undefined, maxValue: 45 } };

export const OnlyMin: Story = { args: { minValue: 90, maxValue: undefined } };

/** Both handles on 30: each can still be dragged, and the drag's direction picks which. */
export const EqualValues: Story = {
  args: { minValue: 30, maxValue: 30 },
  tags: ["skip-visual"],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const grab = canvasElement.querySelector<HTMLElement>('[data-thumb="hi"]')!;
    const strip = grab.parentElement!;
    const box = grab.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const drag = (to: number) => {
      fireEvent.pointerDown(grab, {
        pointerId: 7,
        button: 0,
        clientX: x,
        clientY: y,
        pointerType: "touch",
      });
      fireEvent.pointerMove(strip, { pointerId: 7, clientX: to, clientY: y, pointerType: "touch" });
      // While dragging, nothing is reported yet.
      expect(args.onMinChange).not.toHaveBeenCalled();
      expect(args.onMaxChange).not.toHaveBeenCalled();
      fireEvent.pointerUp(strip, { pointerId: 7, clientX: to, clientY: y, pointerType: "touch" });
    };
    drag(x - 40);
    await expect(args.onMinChange).toHaveBeenCalledTimes(1);
    await expect(Number((slider(canvas, "Lágmark") as HTMLInputElement).value)).toBeLessThan(30);
    await expect(slider(canvas, "Hámark")).toHaveValue("30");
  },
};

/** At 390px the editor is a bottom sheet with a backdrop; a tap on the backdrop cancels. */
export const PhoneSheet: Story = {
  globals: { viewport: { value: "phone", isRotated: false } },
  tags: ["skip-visual"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(valueButton(canvas, "Hámark"));
    const sheet = await page().findByRole("dialog", { name: "Hámark: mínútur" });
    await expect(sheet).toHaveAttribute("aria-modal", "true");
    // Once it has slid in, the whole sheet is on screen.
    await waitFor(() => {
      const box = sheet.getBoundingClientRect();
      expect(box.bottom).toBeLessThanOrEqual(window.innerHeight + 1);
      expect(box.top).toBeGreaterThanOrEqual(0);
    });
  },
};

export const Dark: Story = {
  globals: { theme: "dark" },
  args: { hint: "15 – 60 mín" },
};

/** Tap a value, type (the old value is selected, so typing replaces it) and press Í lagi. */
export const TypeAValue: Story = {
  tags: ["skip-visual"],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(valueButton(canvas, "Lágmark"));
    const dialog = await page().findByRole("dialog", { name: "Lágmark: mínútur" });
    const field = within(dialog).getByRole("textbox", { name: "Lágmark: mínútur" });
    await expect(field).toHaveFocus();
    await expect(field).toHaveAttribute("inputmode", "numeric");
    await userEvent.keyboard("2");
    // Half-typed: nothing reported, the slider hasn't moved.
    await expect(args.onMinChange).not.toHaveBeenCalled();
    await userEvent.keyboard("5");
    await userEvent.click(within(dialog).getByRole("button", { name: "Í lagi" }));
    await expect(args.onMinChange).toHaveBeenCalledWith(25);
    await expect(slider(canvas, "Lágmark")).toHaveValue("25");
    await expect(page().queryByRole("dialog")).toBeNull();
    await expect(valueButton(canvas, "Lágmark")).toHaveFocus();

    // Above the maximum stops at the maximum; at the top of the scale means no limit.
    await userEvent.click(valueButton(canvas, "Lágmark"));
    await userEvent.keyboard("90{Enter}");
    await expect(slider(canvas, "Lágmark")).toHaveValue("60");
    await userEvent.click(valueButton(canvas, "Hámark"));
    await userEvent.keyboard("999{Enter}");
    await expect(args.onMaxChange).toHaveBeenLastCalledWith(undefined);
    await expect(slider(canvas, "Hámark")).toHaveAttribute("aria-valuetext", "Ekkert hámark");
  },
};

/** − and + change the field by one step; nothing is reported until Í lagi. */
export const Stepper: Story = {
  tags: ["skip-visual"],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(valueButton(canvas, "Hámark"));
    const dialog = await page().findByRole("dialog", { name: "Hámark: mínútur" });
    const field = within(dialog).getByRole("textbox");
    const plus = within(dialog).getByRole("button", { name: "Hækka um 5" });
    await userEvent.click(plus);
    await userEvent.click(plus);
    await expect(field).toHaveValue("70");
    // The field keeps focus, so a phone keyboard stays open.
    await expect(field).toHaveFocus();
    await userEvent.click(within(dialog).getByRole("button", { name: "Lækka um 5" }));
    await expect(field).toHaveValue("65");
    await expect(args.onMaxChange).not.toHaveBeenCalled();

    // Held down, it repeats, and stops on release.
    fireEvent.pointerDown(plus, { button: 0 });
    await waitFor(() =>
      expect(Number((field as HTMLInputElement).value)).toBeGreaterThanOrEqual(80)
    );
    fireEvent.pointerUp(plus);
    const settled = (field as HTMLInputElement).value;
    await new Promise((r) => setTimeout(r, 300));
    await expect(field).toHaveValue(settled);

    await userEvent.click(within(dialog).getByRole("button", { name: "Í lagi" }));
    await expect(slider(canvas, "Hámark")).toHaveValue(settled);
  },
};

/** Escape, ✕ and a tap outside all close without changing anything. */
export const EscapeCancels: Story = {
  tags: ["skip-visual"],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(valueButton(canvas, "Lágmark"));
    await page().findByRole("dialog");
    await userEvent.keyboard("40{Escape}");
    await expect(page().queryByRole("dialog")).toBeNull();
    await expect(valueButton(canvas, "Lágmark")).toHaveFocus();

    await userEvent.click(valueButton(canvas, "Lágmark"));
    await userEvent.keyboard("40");
    await userEvent.click(page().getByRole("button", { name: "Loka" }));
    await expect(page().queryByRole("dialog")).toBeNull();

    await userEvent.click(valueButton(canvas, "Lágmark"));
    await userEvent.keyboard("40");
    // On a phone, outside is the sheet's backdrop.
    await userEvent.click(document.querySelector('[class*="rangeInputBackdrop"]') ?? document.body);
    await waitFor(() => expect(page().queryByRole("dialog")).toBeNull());

    await expect(args.onMinChange).not.toHaveBeenCalled();
    await expect(slider(canvas, "Lágmark")).toHaveValue("15");
  },
};
