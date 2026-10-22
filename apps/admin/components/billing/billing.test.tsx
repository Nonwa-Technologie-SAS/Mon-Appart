import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { setAccessToken } from "@/lib/api"
import type { AdminMe, BillingOrderDetail } from "@/lib/types"

import { BillingSummaryPanel } from "./billing-summary"
import { OrderDetail } from "./order-detail"

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const session = vi.hoisted(() => ({ me: null as AdminMe | null }))

vi.mock("../session-provider", () => ({
  useSession: () => ({ state: { me: session.me } }),
}))

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

function me(permissions: string[]): AdminMe {
  return {
    id: "a",
    name: null,
    roles: ["FINANCE"],
    permissions,
    manageableRoles: [],
  }
}

const PAYMENT_ID = "7b0c1d2e-3f40-4a51-8b62-9c7d8e9f0a1b"

function order(status: string, paymentStatus: string): BillingOrderDetail {
  return {
    id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    kind: "SUBSCRIPTION_START",
    status,
    product: { code: "PRO", name: "Pro" },
    amount: "5000",
    currency: "XOF",
    intervalMonths: 1,
    maxActiveListings: 10,
    expiresAt: "2026-10-13T11:00:00.000Z",
    paidAt: null,
    fulfilled: false,
    cancelledAt: null,
    refundedAt: null,
    createdAt: "2026-10-13T10:00:00.000Z",
    buyer: { id: "b", name: "Awa" },
    payments: [
      {
        id: PAYMENT_ID,
        orderId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
        provider: "mock",
        environment: "TEST",
        status: paymentStatus,
        amount: "5000",
        currency: "XOF",
        failureCode: null,
        refundedAmount: "0",
        expiresAt: "2026-10-13T11:00:00.000Z",
        succeededAt: null,
        createdAt: "2026-10-13T10:00:00.000Z",
        checkAttempts: 0,
        lastCheckedAt: null,
        events: [],
        refunds: [],
      },
    ],
    incidents: [],
    period: null,
  }
}

describe("facturation (back-office)", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    setAccessToken("token")
  })

  afterEach(() => {
    cleanup()
    fetchMock.mockReset()
    vi.unstubAllGlobals()
    session.me = null
  })

  it("signale le prestataire simulé et n'affiche aucun revenu net", async () => {
    fetchMock.mockResolvedValue(
      json({
        computedAt: "2026-10-13T10:00:00.000Z",
        provider: {
          code: "mock",
          environment: "TEST",
          simulated: true,
          refunds: true,
        },
        collected: [
          { currency: "XOF", environment: "TEST", amount: "5000", payments: 1 },
        ],
        refunded: [],
        ordersByStatus: { PAID: 1 },
        subscriptionsByStatus: {},
        openIncidents: 0,
        pendingRefunds: 0,
        definitions: {
          collected: "Somme brute confirmée.",
          refunded: "Remboursements confirmés.",
        },
      }),
    )
    render(<BillingSummaryPanel />)
    expect(await screen.findByText(/aucun argent n’est encaissé/)).toBeTruthy()
    expect(screen.getByText(/test \(aucun encaissement réel\)/)).toBeTruthy()
    expect(screen.queryByText(/net/i)).toBeNull()
  })

  it("n'offre aucune action « marquer payé » sur un paiement en attente", async () => {
    session.me = me(["*"])
    fetchMock.mockResolvedValue(json(order("PENDING", "PENDING")))
    render(<OrderDetail orderId="1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d" />)
    expect(await screen.findByText("Interroger le prestataire")).toBeTruthy()
    expect(screen.queryByText(/marquer.*pay/i)).toBeNull()
    expect(screen.queryByText(/déclarer.*payé/i)).toBeNull()
    expect(screen.queryByText("Demander un remboursement")).toBeNull()
  })

  it("masque les actions sans permission (le serveur refait le contrôle)", async () => {
    session.me = me(["admin:access", "billing:read"])
    fetchMock.mockResolvedValue(json(order("PAID", "SUCCEEDED")))
    render(<OrderDetail orderId="1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d" />)
    expect(await screen.findByText(/la réconciliation retentera/)).toBeTruthy()
    expect(screen.queryByText("Interroger le prestataire")).toBeNull()
    expect(screen.queryByText("Demander un remboursement")).toBeNull()
  })

  it("propose la demande de remboursement sur un paiement réussi", async () => {
    session.me = me(["admin:access", "billing:read", "billing:refund_request"])
    fetchMock.mockResolvedValue(json(order("PAID", "SUCCEEDED")))
    render(<OrderDetail orderId="1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d" />)
    expect(await screen.findByText("Demander un remboursement")).toBeTruthy()
  })
})
