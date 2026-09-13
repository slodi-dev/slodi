import { describe, expect, it } from "vitest";

import { splitSteps } from "../components/ItemSections";

describe("turning free-text instructions into steps", () => {
  it("splits on line breaks, the way a leader who uses Enter writes them", () => {
    expect(splitSteps("Veldu tvö tré\nStrengdu kaðalinn\nProfaðu áður en fyrsti fer")).toEqual([
      "Veldu tvö tré",
      "Strengdu kaðalinn",
      "Profaðu áður en fyrsti fer",
    ]);
  });

  it("splits on inline numbering too, because that is just as common", () => {
    // This is the real Kaðlabrautin submission: one paragraph, numbers inline.
    // Splitting only on newlines rendered it as a wall of prose with the
    // numbers buried in the middle of the sentence.
    expect(
      splitSteps("1. Veljið tvö tré í 8–10 m fjarlægð. 2. Strengið kaðalinn. 3. Endurmat.")
    ).toEqual(["Veljið tvö tré í 8–10 m fjarlægð.", "Strengið kaðalinn.", "Endurmat."]);
  });

  it("strips the marker, because the <ol> supplies the number", () => {
    const steps = splitSteps("1) Fyrsta\n2) Önnur");
    expect(steps).toEqual(["Fyrsta", "Önnur"]);
    expect(steps.some((s) => /^\d/.test(s))).toBe(false);
  });

  it("leaves an unnumbered paragraph as prose — one numbered item is worse", () => {
    const prose = "Leggið brautina og farið yfir hana saman.";
    expect(splitSteps(prose)).toEqual([prose]);
  });

  it("treats a lone number inside a sentence as prose, not a step", () => {
    // "í 8–10 m" must not become a step boundary.
    expect(splitSteps("Veljið tré í 8 m fjarlægð.")).toEqual(["Veljið tré í 8 m fjarlægð."]);
  });

  it("returns nothing when there are no instructions", () => {
    expect(splitSteps(null)).toEqual([]);
    expect(splitSteps(undefined)).toEqual([]);
    expect(splitSteps("   ")).toEqual([]);
  });
});
