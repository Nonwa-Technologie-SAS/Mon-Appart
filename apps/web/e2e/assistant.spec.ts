import { expect, test } from "@playwright/test"

test.describe("Assistant immobilier", () => {
  test("affiche la page et le mode dégradé sans Nest", async ({ page }) => {
    await page.goto("/assistant")
    await expect(
      page.getByRole("heading", { name: "Assistant immobilier" }),
    ).toBeVisible()
    await expect(
      page.getByText(/Décrivez le bien recherché|Configurez/i).first(),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: /recherche classique/i }).first(),
    ).toBeVisible()
  })
})
