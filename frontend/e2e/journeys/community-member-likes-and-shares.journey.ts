/**
 * Journey: docs/journeys/community-member-likes-and-shares.md
 *
 * Anna likes an item in the dagskrárbanki, copies its link, and opens the
 * link herself. She expects it to look the way she left it: liked by her, with
 * a count that includes her.
 */
import { test, expect, step, knownBugStep, manualStep } from "../support/journey";
import { LIKEABLE_TASK, PERSONAS } from "../support/fixtures";

test(
  "Community Member likes an item and its shared link shows the like",
  {
    tag: ["@journey:community-member-likes-and-shares", "@story:E4", "@story:J4", "@pr"],
    annotation: [
      { type: "journey", description: "docs/journeys/community-member-likes-and-shares.md" },
      { type: "issue", description: "sc-531" },
    ],
  },
  async ({ page, context, baseURL, signInAs }) => {
    await signInAs(PERSONAS.communityMember);
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
    // Desktop Chromium on Linux has no Web Share, but other platforms do. Take
    // the clipboard path everywhere, so the run doesn't depend on the runner.
    await context.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "share", { value: undefined });
    });

    const search = page.getByRole("searchbox", { name: "Leita að dagskrá" });
    const card = page.getByRole("article", { name: LIKEABLE_TASK.name });
    const cardLike = card.getByRole("button", { name: /rokkstig/ });

    await step("S1", "Opens the dagskrárbanki and finds Hnútakeppni", async () => {
      await page.goto("/programs");
      await search.fill(LIKEABLE_TASK.name);
      await expect(card).toBeVisible();
      await expect(cardLike).toHaveAttribute("aria-pressed", "false");
      await expect(cardLike).toHaveAccessibleName(
        `Gefa rokkstig ${LIKEABLE_TASK.name}, 0 rokkstig`
      );
    });

    await step("S2", "Likes it from the card", async () => {
      const saved = page.waitForResponse(
        (r) =>
          r.request().method() === "POST" &&
          new URL(r.url()).pathname === `/content/${LIKEABLE_TASK.id}/likes`
      );
      await cardLike.click();
      await expect(cardLike).toHaveAttribute("aria-pressed", "true");
      await expect(cardLike).toHaveAccessibleName(
        `Taka rokkstig til baka ${LIKEABLE_TASK.name}, 1 rokkstig`
      );
      // The heart is optimistic; the like has to reach the server too.
      expect((await saved).ok()).toBe(true);
    });

    // On the item page the like button is named for what pressing it does.
    const liked = (p = page) => p.getByRole("button", { name: "Fjarlægja líkar" });

    await step("S3", "Opens the item", async () => {
      await card.getByRole("link").first().click();
      await expect(page).toHaveURL(new RegExp(`/programs/${LIKEABLE_TASK.id}$`));
      await expect(liked()).toBeVisible();
      await expect(liked()).toHaveText("1");
    });

    let link = "";

    await step("S4", "Presses Deila verkefni and copies the link", async () => {
      page.once("dialog", (d) => d.accept()); // „Hlekkur afritaður!"
      await page.getByRole("button", { name: "Deila verkefni" }).click();
      await expect
        .poll(async () => (link = await page.evaluate(() => navigator.clipboard.readText())))
        .toBe(`${baseURL}/programs/${LIKEABLE_TASK.id}`);
    });

    // sc-531: on a page load that starts at the item, the item page registers
    // the like before the item has loaded (not liked, 0), and LikesContext
    // keeps the first value it is given, so the real one never shows.
    await knownBugStep("sc-531", "S5", "Opens the link in a new tab", async () => {
      const tab = await context.newPage();
      await tab.goto(link);
      await expect(tab.getByRole("heading", { level: 1 })).toHaveText(LIKEABLE_TASK.name);
      await expect(liked(tab)).toBeVisible();
      await expect(liked(tab)).toHaveText("1");
    });

    manualStep(
      "S6",
      "Opens the link signed out, in a fresh browser",
      "/programs/<id> is private in lib/route-access.ts until there is a decision on public item pages"
    );
  }
);
