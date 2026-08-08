import { describe, expect, it } from "vitest"

import { checkRateLimit } from "../lib/security/rate-limit"

describe("checkRateLimit", () => {
  it("blocks requests after the configured limit and resets after the window", () => {
    const key = `test-${crypto.randomUUID()}`
    const options = { key, limit: 2, windowMs: 1_000 }

    expect(checkRateLimit({ ...options, now: 0 }).allowed).toBe(true)
    expect(checkRateLimit({ ...options, now: 100 }).allowed).toBe(true)
    expect(checkRateLimit({ ...options, now: 200 }).allowed).toBe(false)
    expect(checkRateLimit({ ...options, now: 1_001 }).allowed).toBe(true)
  })
})
