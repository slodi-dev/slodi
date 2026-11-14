import { describe, expect, it } from "vitest";
import {
  canCreateProgram,
  canDeleteComment,
  canDeleteProgram,
  canEditComment,
  canEditProgram,
} from "@/lib/permissions";
import { hasPermission, type User } from "@/services/users.service";
import type { ContentComment, Program } from "@/services/programs.service";
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

describe("what the moderation team may change", () => {
  const moderator = (id: string): User => ({ id, permissions: "moderator" }) as User;

  it("lets a moderator edit and delete anybody's item", () => {
    // Mirrors the backend's fourth clause in `check_content_edit_access`.
    expect(canEditProgram(moderator("m1"), item(AUTHOR_ID), "viewer")).toBe(true);
    expect(canDeleteProgram(moderator("m1"), item(AUTHOR_ID), "viewer")).toBe(true);
  });

  it("does not extend that to a plain member", () => {
    expect(
      canEditProgram({ id: "m2", permissions: "member" } as User, item(AUTHOR_ID), "viewer")
    ).toBe(false);
  });
});

/** Mirrors `PATCH` and `DELETE /comments/{id}` in `backend/app/routers/comments.py`. */
describe("who may edit or remove a comment", () => {
  const COMMENTER_ID = "33333333-3333-3333-3333-333333333333";
  const comment = { id: "k1", user_id: COMMENTER_ID } as ContentComment;

  it("lets the commenter edit and remove their own comment", () => {
    const commenter = user(COMMENTER_ID);
    expect(canEditComment(commenter, comment)).toBe(true);
    expect(canDeleteComment(commenter, comment, item(AUTHOR_ID), "viewer")).toBe(true);
  });

  it("lets the item's author remove, but not rewrite, a comment under it", () => {
    const author = user(AUTHOR_ID);
    expect(canEditComment(author, comment)).toBe(false);
    expect(canDeleteComment(author, comment, item(AUTHOR_ID), "viewer")).toBe(true);
  });

  it("lets a moderator remove, but not rewrite, anybody's comment", () => {
    const moderator = user(OTHER_ID, "moderator");
    expect(canEditComment(moderator, comment)).toBe(false);
    expect(canDeleteComment(moderator, comment, item(AUTHOR_ID), "viewer")).toBe(true);
  });

  it("gives another member neither", () => {
    const other = user(OTHER_ID);
    expect(canEditComment(other, comment)).toBe(false);
    expect(canDeleteComment(other, comment, item(AUTHOR_ID), "viewer")).toBe(false);
  });

  it("gives a signed-out visitor neither", () => {
    expect(canEditComment(null, comment)).toBe(false);
    expect(canDeleteComment(null, comment, item(AUTHOR_ID), "admin")).toBe(false);
  });
});

describe("who may submit to the bank", () => {
  const BANK = "00000000-0000-0000-0000-0000000000bb";
  const SVEIT = "00000000-0000-0000-0000-0000000000cc";

  it("accepts any member of the bank, which is every account", () => {
    expect(canCreateProgram("viewer", BANK, BANK)).toBe(true);
    expect(canCreateProgram("editor", BANK, BANK)).toBe(true);
    expect(canCreateProgram("admin", BANK, BANK)).toBe(true);
  });

  it("still requires editor in an ordinary workspace", () => {
    // Opening the bank must not delete the read-only role everywhere else.
    expect(canCreateProgram("viewer", SVEIT, BANK)).toBe(false);
    expect(canCreateProgram("editor", SVEIT, BANK)).toBe(true);
  });

  it("refuses someone with no membership", () => {
    expect(canCreateProgram(null, BANK, BANK)).toBe(false);
    expect(canCreateProgram(undefined, BANK, BANK)).toBe(false);
  });

  it("holds the button shut until the bank's id is known", () => {
    // The id arrives a tick after mount. Answering `viewer` on a null default
    // would open the button to any member of any workspace for that tick.
    expect(canCreateProgram("viewer", BANK, null)).toBe(false);
    expect(canCreateProgram("viewer", undefined, undefined)).toBe(false);
    expect(canCreateProgram("viewer", "", "")).toBe(false);
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
