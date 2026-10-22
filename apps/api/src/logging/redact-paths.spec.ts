import { describe, expect, it } from "vitest"

import { redactUrl } from "./redact-paths"

describe("redactUrl", () => {
  it("masque le jeton des liens locaux signés", () => {
    expect(redactUrl("/api/v1/media/local/uploads/eyJvcCI6InB1dCJ9.c2ln")).toBe(
      "/api/v1/media/local/uploads/[redacted]",
    )
    expect(redactUrl("/api/v1/media/local/downloads/abc.def?x=1")).toBe(
      "/api/v1/media/local/downloads/[redacted]?x=1",
    )
  })

  it("masque les signatures en paramètre de requête", () => {
    expect(
      redactUrl(
        "/x?X-Amz-Credential=AKIA%2F1&X-Amz-Signature=deadbeef&ok=1&token=t",
      ),
    ).toBe(
      "/x?X-Amz-Credential=[redacted]&X-Amz-Signature=[redacted]&ok=1&token=[redacted]",
    )
  })

  it("laisse intactes les autres URL", () => {
    expect(redactUrl("/api/v1/media/local/public/id/card.webp")).toBe(
      "/api/v1/media/local/public/id/card.webp",
    )
    expect(redactUrl(undefined)).toBeUndefined()
  })
})
