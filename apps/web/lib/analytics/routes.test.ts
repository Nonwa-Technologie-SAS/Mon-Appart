import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { normalizeAnalyticsRoute } from "./routes"

describe("normalizeAnalyticsRoute", () => {
  it("masque les identifiants d’annonce", () => {
    assert.equal(
      normalizeAnalyticsRoute(
        "/annonces/villa-cocody--6f1c2f5e-8a4b-4c1d-9e2f-3a4b5c6d7e8f",
      ),
      "/annonces/[id]",
    )
  })

  it("conserve les catalogues SEO alphabétiques", () => {
    assert.equal(
      normalizeAnalyticsRoute("/appartements-a-louer"),
      "/appartements-a-louer",
    )
  })

  it("normalise les espaces et l’auth", () => {
    assert.equal(normalizeAnalyticsRoute("/espace/publier"), "/espace")
    assert.equal(normalizeAnalyticsRoute("/connexion"), "/connexion")
  })
})
