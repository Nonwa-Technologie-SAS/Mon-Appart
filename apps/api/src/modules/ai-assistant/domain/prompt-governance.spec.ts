import { describe, expect, it } from "vitest"

import {
  ASSISTANT_REPLY_PROMPT_VERSION,
  composeAssistantSystemPrompt,
} from "./prompt-governance"

describe("prompt assistant", () => {
  it("versionne le prompt et borne les listingIds", () => {
    const allowed = "11111111-1111-4111-8111-111111111111"
    const prompt = composeAssistantSystemPrompt([allowed])
    expect(prompt).toContain(ASSISTANT_REPLY_PROMPT_VERSION)
    expect(prompt).toContain(allowed)
    expect(prompt).toMatch(/inventer/i)
  })
})
