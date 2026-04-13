import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HeidursordlaKeyboard from "../HeidursordlaKeyboard";

const ALL_LETTERS = [
  "A",
  "Á",
  "B",
  "D",
  "Ð",
  "E",
  "É",
  "F",
  "G",
  "H",
  "I",
  "Í",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "Ó",
  "P",
  "R",
  "S",
  "T",
  "U",
  "Ú",
  "V",
  "X",
  "Y",
  "Ý",
  "Þ",
  "Æ",
  "Ö",
];

describe("HeidursordlaKeyboard", () => {
  it("renders all 32 Icelandic letters as distinct keys", () => {
    render(
      <HeidursordlaKeyboard
        onKey={() => {}}
        onEnter={() => {}}
        onBackspace={() => {}}
        letterStates={{}}
      />
    );
    expect(ALL_LETTERS).toHaveLength(32);
    for (const letter of ALL_LETTERS) {
      expect(
        screen.getByRole("button", { name: letter }),
        `expected key for ${letter}`
      ).toBeInTheDocument();
    }
  });

  it("explicitly includes the Icelandic-specific letters", () => {
    render(
      <HeidursordlaKeyboard
        onKey={() => {}}
        onEnter={() => {}}
        onBackspace={() => {}}
        letterStates={{}}
      />
    );
    for (const letter of ["Þ", "Æ", "Ö", "Á", "É", "Í", "Ó", "Ú", "Ý", "Ð"]) {
      expect(screen.getByRole("button", { name: letter })).toBeInTheDocument();
    }
  });

  it("does NOT include C, Q, W, or Z", () => {
    render(
      <HeidursordlaKeyboard
        onKey={() => {}}
        onEnter={() => {}}
        onBackspace={() => {}}
        letterStates={{}}
      />
    );
    for (const letter of ["C", "Q", "W", "Z"]) {
      expect(screen.queryByRole("button", { name: letter })).not.toBeInTheDocument();
    }
  });

  it("fires onEnter and onBackspace from the action keys", async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();
    const onBackspace = vi.fn();
    render(
      <HeidursordlaKeyboard
        onKey={() => {}}
        onEnter={onEnter}
        onBackspace={onBackspace}
        letterStates={{}}
      />
    );
    await user.click(screen.getByRole("button", { name: "Staðfesta" }));
    await user.click(screen.getByRole("button", { name: "Eyða" }));
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onBackspace).toHaveBeenCalledTimes(1);
  });

  it("fires onKey with the pressed letter", async () => {
    const user = userEvent.setup();
    const onKey = vi.fn();
    render(
      <HeidursordlaKeyboard
        onKey={onKey}
        onEnter={() => {}}
        onBackspace={() => {}}
        letterStates={{}}
      />
    );
    await user.click(screen.getByRole("button", { name: "Þ" }));
    expect(onKey).toHaveBeenCalledWith("Þ");
  });
});
