/**
 * Journey: docs/journeys/program-owner-edits-from-bank.md
 *
 * Sigurður edits his own item from its card in the dagskrárbanki, changes only
 * the title, and expects everything else he wrote to still be there.
 */
import { test, expect, step, knownBugStep } from "../support/journey";
import { OWNER_TASK, PERSONAS } from "../support/fixtures";

const NEW_NAME = `${OWNER_TASK.name} (uppfært)`;

test(
  "Program Owner edits an item from the bank and nothing else is lost",
  {
    tag: ["@journey:program-owner-edits-from-bank", "@story:B4", "@story:E2", "@story:E6", "@pr"],
    annotation: [
      { type: "journey", description: "docs/journeys/program-owner-edits-from-bank.md" },
      { type: "issue", description: "sc-530" },
    ],
  },
  async ({ page, signInAs }) => {
    await signInAs(PERSONAS.programOwner);

    const search = page.getByRole("searchbox", { name: "Leita að dagskrá" });
    const card = page.getByRole("article", { name: OWNER_TASK.name });

    await step("S1", "Opens the dagskrárbanki and finds their own item", async () => {
      await page.goto("/programs");
      await search.fill(OWNER_TASK.name);
      await expect(card).toBeVisible();
    });

    const dialog = page.getByRole("dialog");
    const title = dialog.getByLabel(/Heiti hugmyndar/);

    await step("S2", "Opens Breyta from the item's card", async () => {
      await card.getByRole("button", { name: `Breyta ${OWNER_TASK.name}` }).click();
      await expect(dialog).toBeVisible();
      await expect(title).toHaveValue(OWNER_TASK.name);
    });

    await step("S3", "Changes the title and saves", async () => {
      await title.fill(NEW_NAME);
      await dialog.getByRole("button", { name: "Vista breytingar" }).click();
      await expect(dialog).toBeHidden();
    });

    const updatedCard = page.getByRole("article", { name: NEW_NAME });

    await step("S4", "Sees the new title in the bank", async () => {
      await search.fill(NEW_NAME);
      await expect(updatedCard).toBeVisible();
    });

    // sc-530: the bank's list endpoint returns ContentListOut, which has no
    // `instructions` or `media`. The card hands that summary to the edit form,
    // and saving sends the empty fields back as cleared.
    await knownBugStep(
      "sc-530",
      "S5",
      "Opens the item and the leiðbeiningar are still there",
      async () => {
        await updatedCard.getByRole("link").first().click();
        await expect(page).toHaveURL(new RegExp(`/programs/${OWNER_TASK.id}`));
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(NEW_NAME);
        const leidbeiningar = page.getByRole("region", { name: "Leiðbeiningar" });
        for (const line of OWNER_TASK.instructionSteps) {
          await expect(leidbeiningar).toContainText(line);
        }
      }
    );

    await step("S6", "The attached documents are still there", async () => {
      await expect(
        page.getByRole("button", { name: new RegExp(OWNER_TASK.documentName) })
      ).toBeVisible();
    });
  }
);
