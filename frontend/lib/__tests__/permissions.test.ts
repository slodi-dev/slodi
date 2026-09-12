import { describe, expect, it } from "vitest";
import { canCreateProgram, canDeleteProgram, canEditProgram } from "@/lib/permissions";
import { hasPermission, type User } from "@/services/users.service";
import type { Program } from "@/services/programs.service";
import type { WorkspaceRole } from "@/services/workspaces.service";

/**
 * These mirror `backend/tests/test_open_submission.py`. The two must agree: a
 * button the frontend enables and the backend then refuses is worse than no
 * button, because the leader only finds out after writing the thing.
 */

const AUTHOR_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_ID = "22222222-2222-2222-2222-222222222222";

const user = (id: string, permissions: User["permissions"] = "viewer") =>
  ({ id, permissions, name: "T", email: "t@test.com" }) as User;

const item = (authorId: string) => ({ id: "c1", author_id: authorId }) as Program;

describe("who may change a bank item", () => {
  const cases: [string, string, WorkspaceRole | null, boolean][] = [
    ["the author, as a plain viewer", AUTHOR_ID, "viewer", true],
    ["the author, as an editor", AUTHOR_ID, "editor", true],
    ["a workspace admin who is not the author", OTHER_ID, "admin", true],
    ["a workspace owner who is not the author", OTHER_ID, "owner", true],
    ["an editor who is not the author", OTHER_ID, "editor", false],
    ["a viewer who is not the author", OTHER_ID, "viewer", false],
    ["a non-member", OTHER_ID, null, false],
  ];

  it.each(cases)("%s", (_label, userId, role, expected) => {
    const u = user(userId);
    expect(canEditProgram(u, item(AUTHOR_ID), role)).toBe(expected);
    // Deleting follows the same rule — an author must be able to withdraw
    // their own submission, and used to need workspace admin to do it.
    expect(canDeleteProgram(u, item(AUTHOR_ID), role)).toBe(expected);
  });

  it("lets a platform admin through without workspace membership", () => {
    const admin = user(OTHER_ID, "admin");
    expect(canEditProgram(admin, item(AUTHOR_ID), null)).toBe(true);
    expect(canDeleteProgram(admin, item(AUTHOR_ID), null)).toBe(true);
  });

  it("refuses a signed-out visitor", () => {
    expect(canEditProgram(null, item(AUTHOR_ID), "admin")).toBe(false);
  });
});

describe("who may submit to the bank", () => {
  it("accepts any member of the bank, which is every account", () => {
    expect(canCreateProgram("viewer", true)).toBe(true);
    expect(canCreateProgram("editor", true)).toBe(true);
    expect(canCreateProgram("admin", true)).toBe(true);
  });

  it("still requires editor in an ordinary workspace", () => {
    // Opening the bank must not delete the read-only role everywhere else.
    expect(canCreateProgram("viewer", false)).toBe(false);
    expect(canCreateProgram("editor", false)).toBe(true);
  });

  it("defaults to the stricter answer when the caller does not say", () => {
    expect(canCreateProgram("viewer")).toBe(false);
  });

  it("refuses someone with no membership", () => {
    expect(canCreateProgram(null, true)).toBe(false);
    expect(canCreateProgram(undefined, true)).toBe(false);
  });
});

// ── Who manages the shared tag vocabulary ────────────────────────────────────

describe("Merkimiðar", () => {
  it("is for Dagskrárstjórnarteymið, not for whoever edits one workspace", () => {
    // A tag rename reaches every entry in the bank, so it is a platform
    // permission rather than a workspace role. The sidebar entry and the guard
    // inside TagManagement both use this, and must not drift apart.
    expect(hasPermission("moderator", "moderator")).toBe(true);
    expect(hasPermission("admin", "moderator")).toBe(true);
    expect(hasPermission("member", "moderator")).toBe(false);
    expect(hasPermission("viewer", "moderator")).toBe(false);
    expect(hasPermission(null, "moderator")).toBe(false);
  });
});
