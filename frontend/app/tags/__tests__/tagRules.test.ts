import { describe, expect, it } from "vitest";
import { TagRequestError } from "@/services/tags.service";
import {
  COUNTER_FROM,
  NAME_MAX,
  compareIs,
  searchTags,
  tagErrorMessage,
  usageText,
  validateTagName,
} from "../tagRules";

const tags = [
  { id: "1", name: "Útilíf" },
  { id: "2", name: "Hnútar" },
  { id: "3", name: "Áttaviti" },
  { id: "4", name: "Ratleikni" },
];

describe("name limits", () => {
  it("mirrors the backend limit and shows the counter from 90%", () => {
    expect(NAME_MAX).toBe(50);
    expect(COUNTER_FROM).toBe(45);
  });

  it("refuses an empty name", () => {
    expect(validateTagName("   ", tags)).toBe("Skrifaðu nafn á merkimiðanum.");
  });

  it("says how much too long a name is", () => {
    expect(validateTagName("a".repeat(52), tags)).toBe(
      "Nafnið má mest vera 50 stafir. Styttu það um 2 stafi."
    );
  });

  it("refuses a name that exists whatever its case and spacing", () => {
    expect(validateTagName("  útilíf ", tags)).toMatch(/þegar til.*„Útilíf“/);
  });

  it("lets a tag keep its own name when renamed", () => {
    expect(validateTagName("Útilíf", tags, "1")).toBeNull();
  });
});

describe("search", () => {
  it("sorts in Icelandic order, Á after A and Ú after U", () => {
    expect(["Útilíf", "Umhyggja", "Áttaviti", "Aldur"].sort(compareIs)).toEqual([
      "Aldur",
      "Áttaviti",
      "Umhyggja",
      "Útilíf",
    ]);
  });

  it("puts the exact match first", () => {
    const list = [...tags, { id: "5", name: "Út" }];
    expect(searchTags(list, "út").map((t) => t.name)).toEqual(["Út", "Hnútar", "Útilíf"]);
  });
});

describe("copy", () => {
  it("counts items with the Icelandic plural", () => {
    expect(usageText(0)).toBe("Ekki notað");
    expect(usageText(1)).toBe("Notað á 1 einingu");
    expect(usageText(21)).toBe("Notað á 21 einingu");
    expect(usageText(11)).toBe("Notað á 11 einingum");
    expect(usageText(null)).toBeNull();
  });

  it("chooses the message from the status, never from the backend's wording", () => {
    expect(tagErrorMessage(new TagRequestError(409, "anything"), "create")).toBe(
      "Merkimiði með þessu nafni er þegar til. Veldu annað nafn."
    );
    expect(tagErrorMessage(new Error("Tag with this name already exists"), "create")).toMatch(
      /^Ekki tókst að búa til merkimiðann/
    );
    expect(tagErrorMessage(new TagRequestError(500, ""), "delete")).toBe(
      "Ekki tókst að eyða merkimiðanum. Reyndu aftur eftir smástund."
    );
  });
});
