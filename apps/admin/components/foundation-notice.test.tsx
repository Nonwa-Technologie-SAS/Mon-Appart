import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { FoundationNotice } from "./foundation-notice"

describe("FoundationNotice", () => {
  it("présente le socle du back-office", () => {
    render(<FoundationNotice />)
    expect(
      screen.getByRole("heading", { name: "Back-office Mon Appart" }),
    ).toBeTruthy()
  })
})
