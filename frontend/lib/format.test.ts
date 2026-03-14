import { describe, expect, it } from "vitest";

import {
  formatMinutes,
  formatDuration,
  formatDurationLabel,
  formatPrepTime,
  formatPrepTimeLabel,
  formatParticipants,
  formatParticipantsLabel,
  formatPrice,
  formatPriceLabel,
  formatAgeGroup,
  formatAgeGroups,
} from "./format";

// ── formatMinutes ───────────────────────────────────────────────────────────────

describe("formatMinutes", () => {
  it("returns '0 mín' for 0", () => {
    expect(formatMinutes(0)).toBe("0 mín");
  });

  it("returns minutes for values under 60", () => {
    expect(formatMinutes(1)).toBe("1 mín");
    expect(formatMinutes(30)).toBe("30 mín");
    expect(formatMinutes(59)).toBe("59 mín");
  });

  it("returns '1 klst' for exactly 60", () => {
    expect(formatMinutes(60)).toBe("1 klst");
  });

  it("returns hours and minutes for values over 60", () => {
    expect(formatMinutes(90)).toBe("1 klst 30 mín");
    expect(formatMinutes(119)).toBe("1 klst 59 mín");
  });

  it("returns whole hours when evenly divisible", () => {
    expect(formatMinutes(120)).toBe("2 klst");
    expect(formatMinutes(180)).toBe("3 klst");
  });

  it("handles 121 minutes", () => {
    expect(formatMinutes(121)).toBe("2 klst 1 mín");
  });
});

// ── formatDuration ──────────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("returns empty string when both undefined", () => {
    expect(formatDuration(undefined, undefined)).toBe("");
  });

  it("returns single value when only min is defined", () => {
    expect(formatDuration(30, undefined)).toBe("30 mín");
  });

  it("returns single value when only max is defined", () => {
    expect(formatDuration(undefined, 60)).toBe("1 klst");
  });

  it("returns single value when min equals max", () => {
    expect(formatDuration(60, 60)).toBe("1 klst");
    expect(formatDuration(30, 30)).toBe("30 mín");
  });

  it("returns range when min and max differ", () => {
    expect(formatDuration(30, 60)).toBe("30 mín – 1 klst");
    expect(formatDuration(60, 120)).toBe("1 klst – 2 klst");
    expect(formatDuration(30, 90)).toBe("30 mín – 1 klst 30 mín");
  });

  it("returns '0 mín' when both min and max are 0", () => {
    expect(formatDuration(0, 0)).toBe("0 mín");
  });
});

// ── formatDurationLabel ─────────────────────────────────────────────────────────

describe("formatDurationLabel", () => {
  it("returns empty string when both undefined", () => {
    expect(formatDurationLabel(undefined, undefined)).toBe("");
  });

  it("returns single value with full words", () => {
    expect(formatDurationLabel(30, 30)).toBe("Lengd: 30 mínútur");
    expect(formatDurationLabel(60, 60)).toBe("Lengd: 1 klukkustund");
    expect(formatDurationLabel(1, 1)).toBe("Lengd: 1 mínúta");
  });

  it("returns range with 'til'", () => {
    expect(formatDurationLabel(30, 60)).toBe("Lengd: 30 mínútur til 1 klukkustund");
  });

  it("uses plural for multiple hours", () => {
    expect(formatDurationLabel(120, 120)).toBe("Lengd: 2 klukkustundir");
  });

  it("handles single defined value", () => {
    expect(formatDurationLabel(undefined, 90)).toBe("Lengd: 1 klukkustund 30 mínútur");
    expect(formatDurationLabel(45, undefined)).toBe("Lengd: 45 mínútur");
  });
});

// ── formatPrepTime ──────────────────────────────────────────────────────────────

describe("formatPrepTime", () => {
  it("returns empty string when both undefined", () => {
    expect(formatPrepTime(undefined, undefined)).toBe("");
  });

  it("returns single value when min equals max", () => {
    expect(formatPrepTime(30, 30)).toBe("30 mín");
  });

  it("returns range when min and max differ", () => {
    expect(formatPrepTime(15, 30)).toBe("15 mín – 30 mín");
  });

  it("returns '0 mín' when both min and max are 0", () => {
    expect(formatPrepTime(0, 0)).toBe("0 mín");
  });

  it("matches formatDuration behaviour for same inputs", () => {
    expect(formatPrepTime(undefined, undefined)).toBe(formatDuration(undefined, undefined));
    expect(formatPrepTime(30, undefined)).toBe(formatDuration(30, undefined));
    expect(formatPrepTime(undefined, 60)).toBe(formatDuration(undefined, 60));
    expect(formatPrepTime(30, 60)).toBe(formatDuration(30, 60));
    expect(formatPrepTime(60, 60)).toBe(formatDuration(60, 60));
    expect(formatPrepTime(0, 0)).toBe(formatDuration(0, 0));
  });
});

// ── formatPrepTimeLabel ─────────────────────────────────────────────────────────

describe("formatPrepTimeLabel", () => {
  it("returns empty string when both undefined", () => {
    expect(formatPrepTimeLabel(undefined, undefined)).toBe("");
  });

  it("returns label with prefix", () => {
    expect(formatPrepTimeLabel(30, 60)).toBe("Undirbúningstími: 30 mínútur til 1 klukkustund");
  });

  it("returns single value label", () => {
    expect(formatPrepTimeLabel(15, 15)).toBe("Undirbúningstími: 15 mínútur");
  });

  it("handles single defined value", () => {
    expect(formatPrepTimeLabel(undefined, 60)).toBe("Undirbúningstími: 1 klukkustund");
  });
});

// ── formatParticipants ──────────────────────────────────────────────────────────

describe("formatParticipants", () => {
  it("returns empty string when both undefined", () => {
    expect(formatParticipants(undefined, undefined)).toBe("");
  });

  it("uses singular for 1 participant", () => {
    expect(formatParticipants(1, 1)).toBe("1 þátttakandi");
  });

  it("uses plural for more than 1 participant", () => {
    expect(formatParticipants(2, 2)).toBe("2 þátttakendur");
    expect(formatParticipants(5, 5)).toBe("5 þátttakendur");
  });

  it("returns range with plural suffix", () => {
    expect(formatParticipants(5, 15)).toBe("5–15 þátttakendur");
  });

  it("handles single defined min", () => {
    expect(formatParticipants(1, undefined)).toBe("1 þátttakandi");
    expect(formatParticipants(3, undefined)).toBe("3 þátttakendur");
  });

  it("handles single defined max", () => {
    expect(formatParticipants(undefined, 10)).toBe("10 þátttakendur");
    expect(formatParticipants(undefined, 1)).toBe("1 þátttakandi");
  });

  it("handles range starting at 1", () => {
    expect(formatParticipants(1, 5)).toBe("1–5 þátttakendur");
  });
});

// ── formatParticipantsLabel ─────────────────────────────────────────────────────

describe("formatParticipantsLabel", () => {
  it("returns empty string when both undefined", () => {
    expect(formatParticipantsLabel(undefined, undefined)).toBe("");
  });

  it("returns label with prefix", () => {
    expect(formatParticipantsLabel(5, 15)).toBe("Fjöldi þátttakenda: 5–15 þátttakendur");
  });

  it("returns singular label", () => {
    expect(formatParticipantsLabel(1, 1)).toBe("Fjöldi þátttakenda: 1 þátttakandi");
  });
});

// ── formatPrice ─────────────────────────────────────────────────────────────────

describe("formatPrice", () => {
  it("returns 'Kostnaðarlaust' for 0", () => {
    expect(formatPrice(0)).toBe("Kostnaðarlaust");
  });

  it("formats small amounts without thousands separator", () => {
    expect(formatPrice(500)).toBe("500 kr.");
    expect(formatPrice(999)).toBe("999 kr.");
  });

  it("formats 1000 with thousands separator", () => {
    expect(formatPrice(1000)).toBe("1.000 kr.");
  });

  it("formats 1500 with thousands separator", () => {
    expect(formatPrice(1500)).toBe("1.500 kr.");
  });

  it("formats 10000 with thousands separator", () => {
    expect(formatPrice(10000)).toBe("10.000 kr.");
  });
});

// ── formatPriceLabel ────────────────────────────────────────────────────────────

describe("formatPriceLabel", () => {
  it("returns 'Kostnaður: Kostnaðarlaust' for 0", () => {
    expect(formatPriceLabel(0)).toBe("Kostnaður: Kostnaðarlaust");
  });

  it("returns 'Kostnaður: 1.500 kr.' for 1500", () => {
    expect(formatPriceLabel(1500)).toBe("Kostnaður: 1.500 kr.");
  });
});

// ── formatAgeGroup ──────────────────────────────────────────────────────────────

describe("formatAgeGroup", () => {
  it.each([
    "Hrefnuskátar",
    "Drekaskátar",
    "Fálkaskátar",
    "Dróttskátar",
    "Rekkaskátar",
    "Róverskátar",
    "Vættaskátar",
  ])("returns '%s' for '%s'", (group) => {
    expect(formatAgeGroup(group)).toBe(group);
  });

  it("returns the input unchanged for unknown values", () => {
    expect(formatAgeGroup("unknown")).toBe("unknown");
  });
});

// ── formatAgeGroups ─────────────────────────────────────────────────────────────

describe("formatAgeGroups", () => {
  it("returns empty string for empty array", () => {
    expect(formatAgeGroups([])).toBe("");
  });

  it("returns single group name", () => {
    expect(formatAgeGroups(["Hrefnuskátar"])).toBe("Hrefnuskátar");
  });

  it("returns comma-separated group names", () => {
    expect(formatAgeGroups(["Hrefnuskátar", "Drekaskátar"])).toBe("Hrefnuskátar, Drekaskátar");
  });

  it("returns all seven groups", () => {
    const all = [
      "Hrefnuskátar",
      "Drekaskátar",
      "Fálkaskátar",
      "Dróttskátar",
      "Rekkaskátar",
      "Róverskátar",
      "Vættaskátar",
    ];
    expect(formatAgeGroups(all)).toBe(
      "Hrefnuskátar, Drekaskátar, Fálkaskátar, Dróttskátar, Rekkaskátar, Róverskátar, Vættaskátar"
    );
  });
});
