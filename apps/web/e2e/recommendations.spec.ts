import { expect, test } from "@playwright/test"

test.describe("Pour vous — recommandations", () => {
  test("affiche la page et le mode dégradé sans Nest", async ({ page }) => {
    await page.goto("/pour-vous")
    await expect(
      page.getByRole("heading", { name: "Pour vous", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText(/Suggestions pour vous|Configurez/i).first(),
    ).toBeVisible()
  })
})
