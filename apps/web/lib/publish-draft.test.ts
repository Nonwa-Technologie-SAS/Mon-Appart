import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { PUBLISH_DRAFT_KEY } from "./publish-draft"

describe("publish-draft", () => {
  it("utilise une clé de session versionnée", () => {
    assert.equal(PUBLISH_DRAFT_KEY, "mon-appart:publish-draft:v1")
  })
})
