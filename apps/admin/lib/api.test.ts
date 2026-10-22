import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  ApiError,
  api,
  login,
  onSessionExpired,
  setAccessToken,
  withQuery,
} from "./api"

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function headersOf(call: unknown[]): Record<string, string> {
  return ((call[1] as RequestInit).headers ?? {}) as Record<string, string>
}

describe("client API du back-office", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    document.cookie = "ma_csrf=csrf-value; path=/"
    setAccessToken(null)
    onSessionExpired(null)
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
    document.cookie = "ma_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"
  })

  it("se connecte en mode cookie sans rien écrire dans le stockage local", async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { accessToken: "a1", user: { id: "u" } }),
    )
    await login("awa@example.test", "secret")

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("/api/v1/auth/login")
    expect(headersOf(fetchMock.mock.calls[0]!)["X-Auth-Transport"]).toBe(
      "cookie",
    )
    expect((init as RequestInit).credentials).toBe("same-origin")
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it("renouvelle le jeton sur 401 avec l'en-tête CSRF puis rejoue la requête", async () => {
    setAccessToken("expired")
    fetchMock
      .mockResolvedValueOnce(json(401, { code: "TOKEN_EXPIRED", message: "x" }))
      .mockResolvedValueOnce(json(200, { accessToken: "fresh", user: {} }))
      .mockResolvedValueOnce(json(200, { ok: true }))

    await expect(api("/admin/me")).resolves.toEqual({ ok: true })

    expect(fetchMock.mock.calls[1]![0]).toBe("/api/v1/auth/refresh")
    expect(headersOf(fetchMock.mock.calls[1]!)["X-CSRF-Token"]).toBe(
      "csrf-value",
    )
    expect(headersOf(fetchMock.mock.calls[2]!).Authorization).toBe(
      "Bearer fresh",
    )
  })

  it("mutualise les renouvellements concurrents", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      if (input === "/api/v1/auth/refresh") {
        return json(200, { accessToken: "fresh", user: {} })
      }
      const auth = ((init?.headers ?? {}) as Record<string, string>)
        .Authorization
      return auth === "Bearer fresh"
        ? json(200, { ok: true })
        : json(401, { code: "UNAUTHENTICATED", message: "x" })
    })

    await Promise.all([api("/a"), api("/b"), api("/c")])

    const refreshes = fetchMock.mock.calls.filter(
      (call) => call[0] === "/api/v1/auth/refresh",
    )
    expect(refreshes).toHaveLength(1)
  })

  it("signale la perte de session si le renouvellement échoue", async () => {
    const lost = vi.fn()
    onSessionExpired(lost)
    fetchMock
      .mockResolvedValueOnce(json(401, { code: "TOKEN_EXPIRED", message: "x" }))
      .mockResolvedValueOnce(json(401, { code: "CSRF_INVALID", message: "y" }))

    await expect(api("/admin/me")).rejects.toBeInstanceOf(ApiError)
    expect(lost).toHaveBeenCalledOnce()
  })

  it("ne tente aucun renouvellement sans cookie CSRF", async () => {
    document.cookie = "ma_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"
    fetchMock.mockResolvedValueOnce(
      json(401, { code: "UNAUTHENTICATED", message: "x" }),
    )
    await expect(api("/admin/me")).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("expose l'enveloppe d'erreur de l'API", async () => {
    setAccessToken("valid")
    fetchMock.mockResolvedValueOnce(
      json(409, {
        statusCode: 409,
        code: "LISTING_STATUS_CHANGED",
        message: "Le statut a changé.",
        requestId: "req-1",
      }),
    )
    await expect(
      api("/admin/listings/x/approve", { method: "POST", body: {} }),
    ).rejects.toMatchObject({
      status: 409,
      code: "LISTING_STATUS_CHANGED",
      requestId: "req-1",
    })
  })

  it("omet les paramètres vides de la requête", () => {
    expect(
      withQuery("/admin/users", { q: "", status: "ACTIVE", cursor: undefined }),
    ).toBe("/admin/users?status=ACTIVE")
    expect(withQuery("/admin/users", {})).toBe("/admin/users")
  })
})
