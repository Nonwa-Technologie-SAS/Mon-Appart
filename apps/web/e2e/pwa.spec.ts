import { expect, test } from "@playwright/test"

test.describe("PWA — manifeste et hors ligne", () => {
  test("manifeste web accessible avec nom Mon Appart", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest")
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(body.name).toBe("Mon Appart")
    expect(body.short_name).toBe("Mon Appart")
    expect(body.display).toBe("standalone")
    expect(Array.isArray(body.icons)).toBeTruthy()
    expect(body.icons.length).toBeGreaterThan(0)
  })

  test("icônes PWA répondent", async ({ request }) => {
    for (const path of [
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/apple-touch-icon.png",
    ]) {
      const response = await request.get(path)
      expect(response.ok(), path).toBeTruthy()
      expect(response.headers()["content-type"]).toMatch(/image\/png/)
    }
  })

  test("page hors ligne affiche un état explicite", async ({ page }) => {
    await page.goto("/offline")
    await expect(
      page.getByRole("heading", { name: /Connexion indisponible/i }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: /Retour à l'accueil/i }),
    ).toBeVisible()
    await expect(
      page.getByText(/nécessitent une connexion/i),
    ).toBeVisible()
  })

  test("service worker script est servi", async ({ request }) => {
    const response = await request.get("/sw.js")
    expect(response.ok()).toBeTruthy()
    const text = await response.text()
    expect(text).toContain("mon-appart-static")
    expect(text).toContain("/espace")
    expect(text).toMatch(/isPrivatePath|\/api\//)
  })
})
