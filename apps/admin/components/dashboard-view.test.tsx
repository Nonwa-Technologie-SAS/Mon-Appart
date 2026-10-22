import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { setAccessToken } from "@/lib/api"

import { DashboardView } from "./dashboard-view"

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

describe("tableau de bord", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    setAccessToken("token")
  })

  afterEach(() => {
    cleanup()
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it("affiche les files avec leur définition et n'invente pas de KPI sans agrégation", async () => {
    fetchMock.mockImplementation(async (input) => {
      if (String(input).startsWith("/api/v1/admin/dashboard")) {
        return json({
          computedAt: "2026-10-13T10:00:00.000Z",
          analyticsAvailable: true,
          queues: [
            {
              key: "listings_pending_review",
              label: "Annonces à valider",
              definition: "Annonces au statut PENDING_REVIEW.",
              value: 3,
              oldestAt: null,
              link: "/listings?status=PENDING_REVIEW",
            },
          ],
        })
      }
      return json({
        range: { from: "2026-09-13", to: "2026-10-12", days: 30 },
        kpis: { registrations: 0 },
        replyMedianSecondsByDay: [],
        meta: { computedAt: null, completedDay: null },
      })
    })

    render(<DashboardView />)

    expect(await screen.findByText("Annonces à valider")).toBeTruthy()
    expect(screen.getByText("Annonces au statut PENDING_REVIEW.")).toBeTruthy()
    expect(screen.getByText("3")).toBeTruthy()
    expect(await screen.findByText(/Aucune agrégation analytique/)).toBeTruthy()
    expect(screen.queryByText("Inscriptions")).toBeNull()
  })

  it("affiche un état vide explicite sans file autorisée", async () => {
    fetchMock.mockResolvedValue(
      json({
        computedAt: "2026-10-13T10:00:00.000Z",
        analyticsAvailable: false,
        queues: [],
      }),
    )
    render(<DashboardView />)
    expect(
      await screen.findByText(/Aucune file d'attente n'est associée/),
    ).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("affiche un refus d'accès lisible sur 403", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ code: "INSUFFICIENT_PERMISSION", message: "Refusé" }),
        { status: 403 },
      ),
    )
    render(<DashboardView />)
    expect(await screen.findByText(/pas la permission d'accéder/)).toBeTruthy()
    expect(screen.queryByText("Réessayer")).toBeNull()
  })
})
