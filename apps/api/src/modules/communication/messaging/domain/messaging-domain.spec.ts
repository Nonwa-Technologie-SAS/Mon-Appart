import {
  availableActions,
  canPerform,
  checkVisitTime,
  isValidTimeZone,
  nextStatus,
  type AppointmentState,
} from "../../appointments/domain/appointment-rules"
import {
  displayName,
  messageDedupKey,
  messageStatus,
  normalizeBody,
  repetitionKey,
} from "./message-rules"

describe("règles des messages", () => {
  it("normalise le corps et refuse un message vide", () => {
    expect(normalizeBody(null)).toBeNull()
    expect(normalizeBody("   \n\t ")).toBeNull()
    expect(normalizeBody("  Bonjour\r\nMerci  ")).toBe("Bonjour\nMerci")
    expect(normalizeBody("a\n\n\n\n\n\nb")).toBe("a\n\n\nb")
    expect(normalizeBody("lien\u202egpj.exe\u0007")).toBe("liengpj.exe")
  })

  it("compare les répétitions sans tenir compte de la casse ni des espaces", () => {
    expect(repetitionKey("Bonjour  Le\nMonde ")).toBe(
      repetitionKey("bonjour le monde"),
    )
  })

  it("n'expose que le prénom et une initiale", () => {
    expect(displayName({ firstName: "Awa", lastName: "koné" })).toBe("Awa K.")
    expect(displayName({ firstName: "Awa", lastName: null })).toBe("Awa")
    expect(displayName({ firstName: null, lastName: "Koné" })).toBe(
      "Utilisateur",
    )
    expect(displayName(null)).toBe("Compte supprimé")
  })

  it("déduit le statut d'un message des curseurs de l'interlocuteur", () => {
    expect(messageStatus(5, { readSeq: 5, deliveredSeq: 5 })).toBe("READ")
    expect(messageStatus(5, { readSeq: 4, deliveredSeq: 6 })).toBe("DELIVERED")
    expect(messageStatus(5, { readSeq: 0, deliveredSeq: 4 })).toBe("SENT")
  })

  it("regroupe les notifications par série non lue", () => {
    expect(messageDedupKey("c1", 3)).toBe("conversation:c1:after:3")
  })
})

describe("règles des rendez-vous", () => {
  const now = new Date("2026-10-13T10:00:00Z")
  const future = new Date("2026-10-14T10:00:00Z")
  const past = new Date("2026-10-12T10:00:00Z")
  const state = (overrides: Partial<AppointmentState>): AppointmentState => ({
    status: "PENDING",
    scheduledAt: future,
    proposedBy: null,
    ...overrides,
  })

  it("ne confirme jamais une demande du côté du demandeur", () => {
    expect(canPerform(state({}), "REQUESTER", "CONFIRM", now)).toBe(false)
    expect(canPerform(state({}), "LISTING_SIDE", "CONFIRM", now)).toBe(true)
  })

  it("fait accepter une nouvelle date par l'autre partie seulement", () => {
    const proposed = state({
      status: "RESCHEDULE_REQUESTED",
      proposedBy: "LISTING_SIDE",
    })
    expect(canPerform(proposed, "LISTING_SIDE", "CONFIRM", now)).toBe(false)
    expect(canPerform(proposed, "REQUESTER", "CONFIRM", now)).toBe(true)
    expect(
      canPerform(
        { ...proposed, proposedBy: null },
        "REQUESTER",
        "CONFIRM",
        now,
      ),
    ).toBe(false)
  })

  it("réserve terminé et absent au côté annonce, après l'heure prévue", () => {
    const confirmed = state({ status: "CONFIRMED" })
    expect(canPerform(confirmed, "LISTING_SIDE", "COMPLETE", now)).toBe(false)
    const elapsed = { ...confirmed, scheduledAt: past }
    expect(canPerform(elapsed, "LISTING_SIDE", "COMPLETE", now)).toBe(true)
    expect(canPerform(elapsed, "REQUESTER", "NO_SHOW", now)).toBe(false)
  })

  it("fige les rendez-vous terminés ou annulés", () => {
    for (const status of ["CANCELLED", "COMPLETED", "NO_SHOW"] as const) {
      expect(availableActions(state({ status }), "LISTING_SIDE", now)).toEqual(
        [],
      )
    }
    expect(availableActions(state({}), "REQUESTER", now)).toEqual([
      "RESCHEDULE",
      "CANCEL",
    ])
  })

  it("associe chaque action à son statut", () => {
    expect(nextStatus("CONFIRM")).toBe("CONFIRMED")
    expect(nextStatus("RESCHEDULE")).toBe("RESCHEDULE_REQUESTED")
    expect(nextStatus("NO_SHOW")).toBe("NO_SHOW")
  })

  it("contrôle préavis et horizon du créneau", () => {
    const limits = { minNoticeMinutes: 60, maxDaysAhead: 90 }
    expect(checkVisitTime(new Date("2026-10-13T10:30:00Z"), now, limits)).toBe(
      "TOO_SOON",
    )
    expect(checkVisitTime(future, now, limits)).toBe("OK")
    expect(checkVisitTime(new Date("2027-03-01T10:00:00Z"), now, limits)).toBe(
      "TOO_FAR",
    )
    expect(checkVisitTime(new Date("invalid"), now, limits)).toBe("INVALID")
  })

  it("valide les fuseaux IANA", () => {
    expect(isValidTimeZone("Africa/Abidjan")).toBe(true)
    expect(isValidTimeZone("UTC")).toBe(true)
    expect(isValidTimeZone("Mars/Olympus")).toBe(false)
    expect(isValidTimeZone("../etc/passwd")).toBe(false)
  })
})
