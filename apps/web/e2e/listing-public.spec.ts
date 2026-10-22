import { expect, test } from "@playwright/test"

/**
 * Parcours lecture seule : catalogue → fiche si une annonce est listée.
 * Ne dépend pas d’un compte ; saute l’ouverture de fiche si le catalogue est vide.
 */
test.describe("Consultation publique d’annonces", () => {
  test("depuis la recherche, ouvre une fiche si un résultat existe", async ({
    page,
  }) => {
    await page.goto("/?q=Cocody")
    const cards = page.locator('a[href*="/annonces/"]')
    const count = await cards.count()
    test.skip(count === 0, "Aucune annonce Cocody dans la base locale")

    await cards.first().click()
    await expect(page).toHaveURL(/\/annonces\/.+--[0-9a-f-]{36}/i)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(
      page.getByRole("button", { name: /Demander une visite/i }),
    ).toBeVisible()
  })

  test("une URL d’annonce invalide renvoie 404", async ({ page }) => {
    const response = await page.goto(
      "/annonces/annonce-inexistante--00000000-0000-4000-8000-000000000000",
    )
    expect(response?.status()).toBe(404)
  })
})
