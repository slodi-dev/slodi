import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContentTypeChooser, { OFFER_PROGRAM } from "../ContentTypeChooser";

describe("choosing what to make", () => {
  it("asks what you are making before it asks anything else", async () => {
    render(<ContentTypeChooser onChoose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Bæta við í bankann" }));

    const menu = screen.getByRole("menu", { name: "Hvað viltu búa til?" });
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Verkefni/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Viðburður/ })).toBeInTheDocument();
  });

  it("says what each type is for, because the names do not", async () => {
    // A leikur is a Verkefni, not a Dagskrá. Without the hint line the names
    // are indistinguishable to a leader who has not been taught the model.
    render(<ContentTypeChooser onChoose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Bæta við í bankann" }));

    expect(
      screen.getByRole("menuitem", { name: /Einn dagskrárliður — leikur, setning/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /gerist á tilteknum tíma/ })
    ).toBeInTheDocument();
  });

  it("reports the type it was told, not a default", async () => {
    // This is the whole point: every submission used to be filed as a Dagskrá
    // regardless of what it was.
    const onChoose = vi.fn();
    render(<ContentTypeChooser onChoose={onChoose} />);

    await userEvent.click(screen.getByRole("button", { name: "Bæta við í bankann" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Viðburður/ }));

    expect(onChoose).toHaveBeenCalledWith("event");
  });

  it("does not offer a Dagskrá while one cannot be filled", async () => {
    // A Dagskrá is a collection and no screen adds a child to one, so choosing
    // it would produce an empty collection its author cannot fill. When the
    // child picker lands, OFFER_PROGRAM flips and this expectation inverts.
    render(<ContentTypeChooser onChoose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Bæta við í bankann" }));

    const dagskra = screen.queryByRole("menuitem", { name: /Dagskrá/ });
    expect(OFFER_PROGRAM ? dagskra : dagskra === null).toBeTruthy();
  });
});

describe("reaching it without a mouse", () => {
  it("opens on arrow-down from the button, the menu-button idiom", async () => {
    render(<ContentTypeChooser onChoose={vi.fn()} />);
    const fab = screen.getByRole("button", { name: "Bæta við í bankann" });
    fab.focus();

    await userEvent.keyboard("{ArrowDown}");

    expect(fab).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: /Verkefni/ })).toHaveFocus();
  });

  it("wraps at the ends rather than dead-ending", async () => {
    render(<ContentTypeChooser onChoose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Bæta við í bankann" }));

    await userEvent.keyboard("{ArrowUp}");
    const items = screen.getAllByRole("menuitem");
    expect(items[items.length - 1]).toHaveFocus();
  });

  it("closes on Escape and gives focus back to the button", async () => {
    // Otherwise focus is left on a control that is no longer on screen, and a
    // keyboard user has to tab in from the top of the page again.
    render(<ContentTypeChooser onChoose={vi.fn()} />);
    const fab = screen.getByRole("button", { name: "Bæta við í bankann" });
    await userEvent.click(fab);

    await userEvent.keyboard("{Escape}");

    expect(fab).toHaveAttribute("aria-expanded", "false");
    expect(fab).toHaveFocus();
  });
});

describe("when a leader may not submit", () => {
  it("disables with the reason on the control rather than hiding it", () => {
    render(
      <ContentTypeChooser
        onChoose={vi.fn()}
        disabled
        disabledReason="Þú getur ekki sent inn efni fram til 1. október 2026"
      />
    );

    const fab = screen.getByRole("button", { expanded: false });
    expect(fab).toBeDisabled();
    expect(fab).toHaveAccessibleName(/fram til 1\. október 2026/);
  });
});
