import { describe, expect, it } from "vitest"

import { getStripeIdempotencyKey } from "../lib/stripe/idempotency"

describe("getStripeIdempotencyKey", () => {
  it("returns a stable key for repeated checkout requests", () => {
    expect(getStripeIdempotencyKey("checkout-session", "enrollment 42")).toBe(
      "fusionlcc:checkout-session:enrollment-42:v1"
    )
    expect(getStripeIdempotencyKey("checkout-session", "enrollment 42")).toBe(
      getStripeIdempotencyKey("checkout-session", "enrollment 42")
    )
  })
})
