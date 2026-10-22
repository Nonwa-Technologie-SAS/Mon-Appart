import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  listingSegment,
  parseListingSegment,
  slugify,
} from "./slug"
import { decideHomeSearchIndexability } from "./indexation"
import { listingJsonLd, serializeJsonLd } from "./json-ld"
import { listingPath } from "./paths"

describe("seo slug", () => {
  it("produit un slug ASCII sans accents", () => {
    assert.equal(slugify("Appartement à Cocody"), "appartement-a-cocody")
  })

  it("parse un segment annonce slug--uuid", () => {
    const id = "00000000-0000-4000-8000-000000000201"
    const segment = listingSegment("Villa Zone 4", id)
    assert.equal(segment, `villa-zone-4--${id}`)
    assert.deepEqual(parseListingSegment(segment), {
      slug: "villa-zone-4",
      id,
    })
  })

  it("refuse un segment sans uuid valide", () => {
    assert.equal(parseListingSegment("villa-zone-4--not-an-id"), null)
  })
})

describe("seo indexation", () => {
  it("indexe l'accueil sans filtre", () => {
    const decision = decideHomeSearchIndexability({})
    assert.equal(decision.index, true)
    assert.equal(decision.canonicalPath, "/")
  })

  it("renvoie vers la page catalogue pour un type seul", () => {
    const decision = decideHomeSearchIndexability({ type: "APARTMENT" })
    assert.equal(decision.index, false)
    assert.equal(decision.canonicalPath, "/appartements-a-louer")
  })

  it("noindex les combinaisons de filtres", () => {
    const decision = decideHomeSearchIndexability({
      q: "cocody",
      maxPrice: "200000",
    })
    assert.equal(decision.index, false)
  })
})

describe("seo json-ld", () => {
  it("échappe les chevrons dans le JSON-LD", () => {
    const raw = serializeJsonLd({ name: "</script>test" })
    assert.equal(raw.includes("</script>"), false)
    assert.equal(raw.includes("\\u003c/script>"), true)
  })

  it("n'ajoute une Offer que si l'annonce est disponible", () => {
    const available = listingJsonLd({
      id: "00000000-0000-4000-8000-000000000201",
      title: "Studio Marcory",
      description: "Description",
      type: "STUDIO",
      location: "Marcory",
      price: 150000,
      imageUrl: null,
      available: true,
    })
    assert.ok("offers" in available)

    const unavailable = listingJsonLd({
      ...{
        id: "00000000-0000-4000-8000-000000000201",
        title: "Studio Marcory",
        description: "Description",
        type: "STUDIO" as const,
        location: "Marcory",
        price: 150000,
        imageUrl: null,
      },
      available: false,
    })
    assert.equal("offers" in unavailable, false)
    assert.equal(
      listingPath("Studio Marcory", "00000000-0000-4000-8000-000000000201"),
      "/annonces/studio-marcory--00000000-0000-4000-8000-000000000201",
    )
  })
})
