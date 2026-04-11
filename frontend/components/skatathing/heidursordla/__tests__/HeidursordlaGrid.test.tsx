import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import HeidursordlaGrid from "../HeidursordlaGrid";
import type { GuessRow } from "@/services/heidursordla.service";

describe("HeidursordlaGrid", () => {
  it("renders 6 rows × 5 cells", () => {
    render(<HeidursordlaGrid guesses={[]} activeGuess="" shake={false} />);
    for (let r = 0; r < 6; r += 1) {
      for (let c = 0; c < 5; c += 1) {
        expect(screen.getByTestId(`cell-${r}-${c}`)).toBeInTheDocument();
      }
    }
  });

  it("renders the active guess letters in the next empty row", () => {
    render(<HeidursordlaGrid guesses={[]} activeGuess="hund" shake={false} />);
    expect(screen.getByTestId("cell-0-0")).toHaveTextContent("H");
    expect(screen.getByTestId("cell-0-3")).toHaveTextContent("D");
    expect(screen.getByTestId("cell-0-4")).toHaveTextContent("");
  });

  it("toggles the shake class on the active row when `shake` is true", () => {
    const { rerender } = render(
      <HeidursordlaGrid guesses={[]} activeGuess="ABCDE" shake={false} />
    );
    expect(screen.getByTestId("row-0").className).not.toMatch(/rowShake/i);

    rerender(<HeidursordlaGrid guesses={[]} activeGuess="ABCDE" shake />);
    expect(screen.getByTestId("row-0").className).toMatch(/rowShake/i);
  });

  it("renders correct/present/absent colour classes for completed guesses", () => {
    const guesses: GuessRow[] = [
      {
        word: "halló",
        colors: ["green", "yellow", "gray", "gray", "green"],
      },
    ];
    render(<HeidursordlaGrid guesses={guesses} activeGuess="" shake={false} />);

    expect(screen.getByTestId("cell-0-0").className).toMatch(/cellCorrect/);
    expect(screen.getByTestId("cell-0-1").className).toMatch(/cellPresent/);
    expect(screen.getByTestId("cell-0-2").className).toMatch(/cellAbsent/);
    expect(screen.getByTestId("cell-0-4").className).toMatch(/cellCorrect/);
  });
});
