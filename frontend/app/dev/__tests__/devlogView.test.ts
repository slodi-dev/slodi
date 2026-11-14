import { describe, expect, it } from "vitest";

import {
  backToListHref,
  coverTintOf,
  isDevlogListHref,
  isNewPost,
  listHrefFor,
  postHref,
  tagsByUse,
  todayIso,
} from "../devlogView";

describe("isNewPost", () => {
  it("is new from today back to 13 days, not 14", () => {
    expect(isNewPost("2026-10-12", "2026-10-12")).toBe(true);
    expect(isNewPost("2026-09-29", "2026-10-12")).toBe(true);
    expect(isNewPost("2026-09-28", "2026-10-12")).toBe(false);
  });
  it("is not new when dated after today", () => {
    expect(isNewPost("2026-10-13", "2026-10-12")).toBe(false);
  });
});

describe("todayIso", () => {
  it("is the UTC date", () => {
    expect(todayIso(new Date("2026-10-12T23:30:00Z"))).toBe("2026-10-12");
  });
});

describe("coverTintOf", () => {
  it("gives the same post the same tint every time", () => {
    expect(coverTintOf("leikir")).toBe(coverTintOf("leikir"));
  });
  it("spreads posts over more than one tint", () => {
    const tints = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map(coverTintOf));
    expect(tints.size).toBeGreaterThan(1);
  });
});

describe("tagsByUse", () => {
  it("orders by use, ties in first-seen order", () => {
    const posts = [
      { slug: "a", title: "A", date: "2026-01-03", tags: ["x", "y"] },
      { slug: "b", title: "B", date: "2026-01-02", tags: ["z", "y"] },
      { slug: "c", title: "C", date: "2026-01-01" },
    ];
    expect(tagsByUse(posts)).toEqual(["y", "x", "z"]);
  });
});

describe("list and post links", () => {
  it("writes the tag filter into the list URL", () => {
    expect(listHrefFor(null)).toBe("/dev");
    expect(listHrefFor("útgáfa")).toBe("/dev?merki=%C3%BAtg%C3%A1fa");
  });
  it("adds ?fra= only from a filtered list", () => {
    expect(postHref("leikir")).toBe("/dev/leikir");
    expect(postHref("leikir", "/dev?merki=leikir")).toBe("/dev/leikir?fra=%2Fdev%3Fmerki%3Dleikir");
  });
  it("accepts only the devlog list as a list URL", () => {
    expect(isDevlogListHref("/dev")).toBe(true);
    expect(isDevlogListHref("/dev?merki=a")).toBe(true);
    expect(isDevlogListHref("/dev/leikir")).toBe(false);
    expect(isDevlogListHref("/devices")).toBe(false);
    expect(isDevlogListHref("//evil.example/dev")).toBe(false);
    expect(isDevlogListHref("https://evil.example/dev")).toBe(false);
  });
});

describe("backToListHref", () => {
  const origin = "https://slodi.is";
  it("prefers ?fra=", () => {
    expect(backToListHref("/dev?merki=a", "https://slodi.is/dev?merki=b", origin)).toBe(
      "/dev?merki=a"
    );
  });
  it("falls back to a same-site referrer on the list", () => {
    expect(backToListHref(null, "https://slodi.is/dev?merki=b", origin)).toBe("/dev?merki=b");
  });
  it("ignores other sites, other pages and bad input", () => {
    expect(backToListHref(null, "https://evil.example/dev?merki=b", origin)).toBe("/dev");
    expect(backToListHref(null, "https://slodi.is/programs", origin)).toBe("/dev");
    expect(backToListHref("https://evil.example", "not a url", origin)).toBe("/dev");
    expect(backToListHref(null, "", "")).toBe("/dev");
  });
});
