import { aggregateHealth, withTimeout } from "./health.service"

describe("aggregateHealth", () => {
  it("est ok seulement si toutes les dépendances répondent", () => {
    expect(
      aggregateHealth("api", {
        postgres: { status: "up" },
        redis: { status: "down", detail: "unavailable" },
      }).status,
    ).toBe("degraded")
  })

  it("est ok lorsque Postgres, PostGIS et Redis sont up", () => {
    expect(
      aggregateHealth("api", {
        postgres: { status: "up" },
        postgis: { status: "up" },
        redis: { status: "up" },
      }).status,
    ).toBe("ok")
  })
})

describe("withTimeout", () => {
  it("retourne le résultat si la promesse gagne", async () => {
    await expect(
      withTimeout(Promise.resolve("ok"), 50, "timeout"),
    ).resolves.toBe("ok")
  })

  it("retourne le fallback en cas de délai dépassé", async () => {
    await expect(
      withTimeout(
        new Promise<string>((resolve) => {
          setTimeout(() => resolve("late"), 100)
        }),
        20,
        "timeout",
      ),
    ).resolves.toBe("timeout")
  })
})
