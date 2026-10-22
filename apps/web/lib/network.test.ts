import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  networkErrorMessage,
  NetworkTimeoutError,
  OfflineError,
} from "./network"

describe("networkErrorMessage", () => {
  it("traduit hors ligne et timeout", () => {
    assert.match(networkErrorMessage(new OfflineError()), /Connexion indisponible/)
    assert.match(networkErrorMessage(new NetworkTimeoutError()), /trop de temps/)
  })

  it("gère TypeError fetch", () => {
    assert.match(networkErrorMessage(new TypeError("Failed to fetch")), /joindre/)
  })
})
