import { describe, expect, it } from "vitest";
import { UserRequestError, type User, type UserPermissions } from "@/services/users.service";
import {
  bankRoleNeedsConfirm,
  countByPermission,
  filterUsers,
  initials,
  isLocked,
  listStateUrl,
  permissionNeedsConfirm,
  readListState,
  searchUsers,
  userErrorMessage,
} from "../userRules";

function user(id: string, name: string, permissions: UserPermissions, email = `${id}@x.is`): User {
  return { id, auth0_id: id, name, email, permissions };
}

const PEOPLE = [
  user("1", "Ýmir Breki", "member"),
  user("2", "Ástrós Eva", "viewer"),
  user("3", "Anna Jóns", "moderator"),
  user("4", "Þórdís Lilja", "admin"),
  user("5", "Bergur Logi", "member", "bergur@kopar.is"),
];

describe("permissionNeedsConfirm", () => {
  it("confirms a promotion to moderator", () => {
    expect(permissionNeedsConfirm("member", "moderator")).toBe(true);
    expect(permissionNeedsConfirm("viewer", "moderator")).toBe(true);
  });

  it("doesn't confirm a demotion or a step below moderator", () => {
    expect(permissionNeedsConfirm("moderator", "member")).toBe(false);
    expect(permissionNeedsConfirm("viewer", "member")).toBe(false);
  });
});

describe("bankRoleNeedsConfirm", () => {
  it("confirms making someone a bank admin, including from no role", () => {
    expect(bankRoleNeedsConfirm("editor", "admin")).toBe(true);
    expect(bankRoleNeedsConfirm(null, "admin")).toBe(true);
  });

  it("doesn't confirm anything else", () => {
    expect(bankRoleNeedsConfirm("admin", "editor")).toBe(false);
    expect(bankRoleNeedsConfirm(null, "viewer")).toBe(false);
  });
});

describe("isLocked", () => {
  it("locks the signed-in admin's own row and other platform admins", () => {
    expect(isLocked(PEOPLE[0], "1")).toBe(true);
    expect(isLocked(PEOPLE[3], "1")).toBe(true);
    expect(isLocked(PEOPLE[1], "1")).toBe(false);
  });
});

describe("searchUsers", () => {
  it("ignores case and accents", () => {
    expect(searchUsers(PEOPLE, "astros").map((u) => u.id)).toEqual(["2"]);
    expect(searchUsers(PEOPLE, "YMIR").map((u) => u.id)).toEqual(["1"]);
  });

  it("matches the email too", () => {
    expect(searchUsers(PEOPLE, "kopar").map((u) => u.id)).toEqual(["5"]);
  });

  it("keeps þ a letter of its own", () => {
    expect(searchUsers(PEOPLE, "thor")).toEqual([]);
  });

  it("returns everyone for an empty search", () => {
    expect(searchUsers(PEOPLE, "  ")).toHaveLength(PEOPLE.length);
  });
});

describe("filterUsers and countByPermission", () => {
  it("filters by permission and sorts in Icelandic order", () => {
    expect(filterUsers(PEOPLE, "all").map((u) => u.name)).toEqual([
      "Anna Jóns",
      "Ástrós Eva",
      "Bergur Logi",
      "Ýmir Breki",
      "Þórdís Lilja",
    ]);
    expect(filterUsers(PEOPLE, "member").map((u) => u.id)).toEqual(["5", "1"]);
  });

  it("counts each permission and the total", () => {
    expect(countByPermission(PEOPLE)).toEqual({
      all: 5,
      viewer: 1,
      member: 2,
      moderator: 1,
      admin: 1,
    });
  });
});

describe("initials", () => {
  it("takes the first and last name", () => {
    expect(initials("Sigurbjörg Guðríður Kjerúlf")).toBe("SK");
    expect(initials("Ýmir")).toBe("Ý");
  });
});

describe("the URL", () => {
  it("round-trips the list state, leaving defaults out", () => {
    const state = { query: "jón", permission: "member" as const, page: 2, selectedId: "u-1" };
    const url = listStateUrl("/admin", state);
    expect(url).toBe("/admin?q=j%C3%B3n&rettindi=member&sida=2&notandi=u-1");
    expect(readListState(new URLSearchParams(url.split("?")[1]))).toEqual(state);
    expect(
      listStateUrl("/admin", { query: " ", permission: "all", page: 1, selectedId: null })
    ).toBe("/admin");
  });

  it("falls back to the defaults for anything invalid", () => {
    expect(readListState(new URLSearchParams("rettindi=root&sida=-3"))).toEqual({
      query: "",
      permission: "all",
      page: 1,
      selectedId: null,
    });
  });
});

describe("userErrorMessage", () => {
  it("picks the message from the status, never the backend's text", () => {
    const refused = new UserRequestError(403, "Forbidden: admin only");
    expect(userErrorMessage(refused, "permission")).toBe(
      "Ekki tókst að vista réttindin. Þú hefur ekki heimild til þess."
    );
    expect(userErrorMessage(new UserRequestError(0, "Failed to fetch"), "load")).toBe(
      "Ekki tókst að sækja notendur. Athugaðu nettenginguna og reyndu aftur."
    );
  });

  it("reads the status from the workspace service's message", () => {
    const err = new Error("Failed to set workspace role: 404 - not found");
    expect(userErrorMessage(err, "bankRole")).toContain("Notandinn er ekki lengur til");
  });
});
