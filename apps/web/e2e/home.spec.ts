import { expect, test } from "@playwright/test"

test("la page d'accueil s'affiche", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveTitle(/Mon Appart/)
})
