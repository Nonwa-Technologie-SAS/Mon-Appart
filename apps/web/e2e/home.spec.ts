import { expect, test } from "@playwright/test"

test.describe("Accueil et recherche publique", () => {
  test("affiche la marque et le formulaire de recherche", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/Mon Appart/)
    await expect(
      page.getByRole("heading", { name: /Trouvez votre chez-vous/i }),
    ).toBeVisible()
    await expect(page.getByRole("search")).toBeVisible()
    await expect(
      page.getByRole("searchbox", { name: /Ville ou quartier/i }),
    ).toBeVisible()
    await expect(
      page.getByRole("navigation", { name: /Catégories de biens/i }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: /Pourquoi chercher sur Mon Appart/i }),
    ).toBeVisible()
  })

  test("soumet une recherche par quartier via l’URL", async ({ page }) => {
    await page.goto("/")
    const search = page.getByRole("searchbox", { name: /Ville ou quartier/i })
    await search.fill("Cocody")
    await page.getByRole("button", { name: /^OK$/i }).click()
    await expect(page).toHaveURL(/\?q=Cocody/)
    await expect(page.getByText(/résultat/i).first()).toBeVisible()
  })

  test("page catalogue appartements répond", async ({ page }) => {
    await page.goto("/appartements-a-louer")
    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toBeVisible()
    await expect(page.getByText(/Mon Appart/i).first()).toBeVisible()
  })

  test("robots.txt et sitemap sont accessibles", async ({ request }) => {
    const robots = await request.get("/robots.txt")
    expect(robots.ok()).toBeTruthy()
    const robotsBody = await robots.text()
    expect(robotsBody.length).toBeGreaterThan(0)

    const sitemap = await request.get("/sitemap.xml")
    expect(sitemap.ok()).toBeTruthy()
  })
})
