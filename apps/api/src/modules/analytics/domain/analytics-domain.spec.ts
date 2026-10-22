import { AppException } from "../../../common/http/app-exception"
import { parseDateRange, ratio, thresholdGroups } from "./date-range"
import {
  deterministicEventId,
  isoDay,
  resolveOccurredAt,
  utcDay,
} from "./ingestion-rules"

const HOUR = 3_600_000
const window = { maxAgeMs: 72 * HOUR, maxFutureMs: 5 * 60_000 }

describe("resolveOccurredAt", () => {
  const received = new Date("2026-10-13T12:00:00.000Z")

  it("corrige le décalage d'horloge de l'appareil", () => {
    // Appareil en avance d'une heure : sentAt et occurredAt le sont aussi.
    const sentAt = new Date(received.getTime() + HOUR)
    const occurredAt = new Date(received.getTime() + HOUR - 60_000)
    expect(resolveOccurredAt(occurredAt, sentAt, received, window)).toEqual(
      new Date(received.getTime() - 60_000),
    )
  })

  it("rejette un événement trop ancien ou dans le futur", () => {
    expect(
      resolveOccurredAt(
        new Date(received.getTime() - 73 * HOUR),
        received,
        received,
        window,
      ),
    ).toBeNull()
    expect(
      resolveOccurredAt(
        new Date(received.getTime() + 10 * 60_000),
        received,
        received,
        window,
      ),
    ).toBeNull()
  })

  it("ramène une légère avance à l'instant de réception", () => {
    expect(
      resolveOccurredAt(
        new Date(received.getTime() + 60_000),
        received,
        received,
        window,
      ),
    ).toEqual(received)
  })
})

describe("deterministicEventId", () => {
  it("produit un UUID v4 stable par fait métier", () => {
    const id = deterministicEventId("qualified_lead_recorded", "abc")
    expect(id).toBe(deterministicEventId("qualified_lead_recorded", "abc"))
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(id).not.toBe(deterministicEventId("qualified_lead_recorded", "abd"))
    // Le séparateur empêche les collisions par concaténation.
    expect(deterministicEventId("a", "bc")).not.toBe(
      deterministicEventId("ab", "c"),
    )
  })
})

describe("parseDateRange", () => {
  const now = new Date("2026-10-13T08:00:00.000Z")
  const limits = { defaultDays: 30, maxDays: 366 }

  it("défaut : les 30 derniers jours, aujourd'hui inclus", () => {
    const range = parseDateRange({}, limits, now)
    expect(isoDay(range.from)).toBe("2026-09-14")
    expect(isoDay(range.to)).toBe("2026-10-13")
    expect(range.days).toBe(30)
  })

  it.each([
    [{ from: "2026-02-30" }],
    [{ from: "13/10/2026" }],
    [{ from: "2026-10-13", to: "2026-10-01" }],
    [{ from: "2024-01-01", to: "2026-01-01" }],
  ])("refuse %j", (input) => {
    expect(() => parseDateRange(input, limits, now)).toThrow(AppException)
  })

  it("utcDay ignore l'heure", () => {
    expect(isoDay(utcDay(new Date("2026-10-13T23:59:59.999Z")))).toBe(
      "2026-10-13",
    )
  })
})

describe("indicateurs publiés", () => {
  it("ratio sans division par zéro", () => {
    expect(ratio(1, 3)).toBe(0.3333)
    expect(ratio(5, 0)).toBeNull()
  })

  it("regroupe les petits groupes et supprime un reliquat trop petit", () => {
    const rows = [
      { value: "COCODY", count: 40, actors: 12 },
      { value: "PLATEAU", count: 3, actors: 3 },
      { value: "BINGERVILLE", count: 4, actors: 2 },
      { value: "YOPOUGON", count: 9, actors: 6 },
    ]
    expect(thresholdGroups(rows, 5)).toEqual([
      { value: "COCODY", count: 40, actors: 12 },
      { value: "YOPOUGON", count: 9, actors: 6 },
      { value: "OTHER", count: 7, actors: 5 },
    ])
    expect(thresholdGroups(rows.slice(1, 3), 6)).toEqual([])
  })
})
