import { resolveRequestId } from "./request-id"

describe("resolveRequestId", () => {
  it("réutilise un identifiant déjà posé", () => {
    expect(resolveRequestId("ignored-value", "abc12345")).toBe("abc12345")
  })

  it("accepte un en-tête sûr", () => {
    expect(resolveRequestId("req_12345678")).toBe("req_12345678")
  })

  it("ignore un en-tête porteur de caractères de contrôle", () => {
    const id = resolveRequestId("bad\r\nheader")
    expect(id).not.toContain("\n")
    expect(id.length).toBeGreaterThan(8)
  })
})
