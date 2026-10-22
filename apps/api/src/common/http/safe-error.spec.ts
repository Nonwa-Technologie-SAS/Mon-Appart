import { safeErrorMessage } from "./safe-error"

describe("safeErrorMessage", () => {
  it("masque les URL de connexion", () => {
    const error = new Error(
      "connect ECONNREFUSED postgresql://mon_appart:secret@localhost:5432/mon_appart",
    )
    expect(safeErrorMessage(error)).not.toContain("secret")
    expect(safeErrorMessage(error)).toContain("[redacted]")
  })
})
