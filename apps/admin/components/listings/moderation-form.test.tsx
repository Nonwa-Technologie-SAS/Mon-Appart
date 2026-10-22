import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { setAccessToken } from "@/lib/api"
import type { ModerationReason } from "@/lib/types"

import { ModerationForm } from "./listing-detail"

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const PHOTOS: ModerationReason = {
  code: "PHOTOS_QUALITY",
  action: "REQUEST_CHANGES",
  label: "Photos insuffisantes",
  ownerMessage: "Ajoutez des photos nettes.",
  isActive: true,
  sortOrder: 10,
  updatedAt: "2026-10-13T00:00:00.000Z",
}

describe("formulaire de décision de modération", () => {
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

  it("exige un motif et envoie le statut attendu (verrou optimiste)", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "DRAFT" }), { status: 200 }),
    )
    const onDone = vi.fn()
    render(
      <ModerationForm
        decision="REQUEST_CHANGES"
        listing={{
          status: "PENDING_REVIEW",
          reasons: { REQUEST_CHANGES: [PHOTOS] },
        }}
        base="/admin/listings/l1"
        onDone={onDone}
        onCancel={() => undefined}
      />,
    )

    const submit = screen.getByRole("button", {
      name: "Confirmer la décision",
    }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText("Motif (obligatoire)"), {
      target: { value: "PHOTOS_QUALITY" },
    })
    expect(screen.getByText(/Ajoutez des photos nettes/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Note interne/), {
      target: { value: "Salon absent" },
    })
    expect(submit.disabled).toBe(false)
    fireEvent.click(submit)

    await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("/api/v1/admin/listings/l1/request-changes")
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      expectedStatus: "PENDING_REVIEW",
      reasonCode: "PHOTOS_QUALITY",
      internalNote: "Salon absent",
    })
  })

  it("bloque la décision quand aucun motif n'est actif", () => {
    render(
      <ModerationForm
        decision="REJECT"
        listing={{ status: "PENDING_REVIEW", reasons: { REJECT: [] } }}
        base="/admin/listings/l1"
        onDone={() => undefined}
        onCancel={() => undefined}
      />,
    )
    expect(screen.getByRole("alert").textContent).toMatch(/Aucun motif actif/)
    expect(
      screen.queryByRole("button", { name: "Confirmer la décision" }),
    ).toBeNull()
  })

  it("exige une justification interne pour republier", () => {
    render(
      <ModerationForm
        decision="RESTORE"
        listing={{ status: "SUSPENDED", reasons: {} }}
        base="/admin/listings/l1"
        onDone={() => undefined}
        onCancel={() => undefined}
      />,
    )
    const submit = screen.getByRole("button", {
      name: "Confirmer la décision",
    }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/Justification interne/), {
      target: { value: "Signalement écarté après vérification" },
    })
    expect(submit.disabled).toBe(false)
  })

  it("affiche le conflit de version renvoyé par l'API", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "LISTING_STATUS_CHANGED",
          message: "Le statut de l'annonce a changé.",
        }),
        { status: 409 },
      ),
    )
    const onDone = vi.fn()
    render(
      <ModerationForm
        decision="APPROVE"
        listing={{ status: "PENDING_REVIEW", reasons: {} }}
        base="/admin/listings/l1"
        onDone={onDone}
        onCancel={() => undefined}
      />,
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer la décision" }),
    )
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Rechargez la page/,
    )
    expect(onDone).not.toHaveBeenCalled()
  })
})
