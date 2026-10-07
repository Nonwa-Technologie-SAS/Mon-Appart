import { aggregateHealth } from "./health.service"

describe("aggregateHealth", () => {
  it("est ok seulement si toutes les dépendances répondent", () => {
    expect(
      aggregateHealth("api", {
        postgres: { status: "up" },
        redis: { status: "down", detail: "unavailable" },
      }).status,
    ).toBe("degraded")
  })
})
