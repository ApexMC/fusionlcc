import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"
import { loadTypeScriptModuleWithMocks as loadModule } from "./load-typescript.mjs"

const options = { priceId: "price_class", couponId: "coupon_family" }

async function fixture({ coupon = {}, price = {}, lookupError } = {}) {
  const calls = { coupons: [], prices: [], creates: [], sessions: [] }
  const source = { id: "coupon_family", valid: true, amount_off: 1000, currency: "usd", duration: "forever",
    duration_in_months: null, max_redemptions: null, redeem_by: null, ...coupon }
  const classPrice = { active: true, product: "prod_class", currency: "usd", unit_amount: 5900,
    recurring: { interval: "month", interval_count: 1 }, ...price }
  const stored = new Map()
  function expand(result, params) {
    const { applies_to, currency_options, ...base } = result
    return { ...base,
      ...(params?.expand?.includes("applies_to") ? { applies_to } : {}),
      ...(params?.expand?.includes("currency_options") ? { currency_options } : {}),
    }
  }
  const stripe = {
    coupons: {
      retrieve: async (id, params) => {
        calls.coupons.push({ id, params })
        if (id === source.id) return expand(source, params)
        if (lookupError) throw lookupError
        if (!stored.has(id)) throw Object.assign(new Error("No such coupon"), { code: "resource_missing" })
        return expand(stored.get(id), params)
      },
      create: async (params, requestOptions) => {
        calls.creates.push({ params, requestOptions })
        const result = { ...params, valid: true, amount_off: null,
          duration_in_months: params.duration_in_months ?? null, redeem_by: params.redeem_by ?? null }
        stored.set(params.id, result)
        return expand(result, params)
      },
    },
    prices: { retrieve: async id => { calls.prices.push(id); return { id, ...classPrice } } },
    checkout: { sessions: { create: async params => {
      calls.sessions.push(params)
      return { url: "https://checkout.stripe.test/session" }
    } } },
  }
  const stripeHelpers = { getStripe: () => stripe, getNextBillingAnchorUnix: () => 1794744000 }
  const pricing = await loadModule("../lib/account/class-checkout.ts", {
    "server-only": {}, "node:crypto": { createHash }, "@/lib/stripe/server": stripeHelpers,
  })
  return { pricing, calls, stripeHelpers, stored, source }
}

function monthlyNet(amount, percentOff) {
  return amount - Math.round(amount * percentOff / 100)
}

test("undiscounted classes keep the original price without extra billing reads", async () => {
  const { pricing, calls } = await fixture()
  const result = await pricing.getClassCheckoutPricing({ ...options, couponId: null })
  assert.deepEqual(result.lineItems, [{ price: "price_class", quantity: 1 }])
  assert.equal(result.discounts, undefined)
  assert.deepEqual(calls.coupons, [])
})

test("percentage coupons keep the original Stripe coupon without conversion", async () => {
  const { pricing, calls } = await fixture({ coupon: { amount_off: null, percent_off: 20 } })
  const result = await pricing.getClassCheckoutPricing(options)
  assert.deepEqual(result.discounts, [{ coupon: "coupon_family" }])
  assert.deepEqual(calls.prices, [])
  assert.deepEqual(calls.creates, [])
})

test("a $10 discount on a $59 class becomes an exact $49 monthly rate with native proration", async () => {
  const { pricing, calls } = await fixture()
  const result = await pricing.getClassCheckoutPricing(options)
  const coupon = calls.creates[0].params
  assert.equal(coupon.percent_off, 16.95)
  assert.equal(monthlyNet(5900, coupon.percent_off), 4900)
  assert.equal(coupon.duration, "forever")
  assert.deepEqual(coupon.applies_to, { products: ["prod_class"] })
  assert.deepEqual(coupon.metadata, { source_coupon_id: "coupon_family", source_price_id: "price_class" })
  assert.deepEqual(result.lineItems, [{ price: "price_class", quantity: 1 }])
  assert.deepEqual(result.discounts, [{ coupon: coupon.id }])
  assert.equal(result.metadata.multi_athlete_coupon_id, "coupon_family")
})

for (const [base, discount] of [[4800, 3300], [5900, 4400], [6400, 4900]]) {
  test(`3+ athlete pricing remains exactly $15 for a $${base / 100} class`, async () => {
    const { pricing, calls } = await fixture({ coupon: { amount_off: discount }, price: { unit_amount: base } })
    await pricing.getClassCheckoutPricing(options)
    assert.equal(monthlyNet(base, calls.creates[0].params.percent_off), 1500)
  })
}

test("one-invoice coupons remain one-invoice discounts", async () => {
  const { pricing, calls } = await fixture({ coupon: { duration: "once" } })
  await pricing.getClassCheckoutPricing(options)
  assert.equal(calls.creates[0].params.duration, "once")
})

test("repeating duration and expiration are preserved", async () => {
  const { pricing, calls } = await fixture({ coupon: { duration: "repeating", duration_in_months: 3, redeem_by: 1800000000 } })
  await pricing.getClassCheckoutPricing(options)
  assert.equal(calls.creates[0].params.duration, "repeating")
  assert.equal(calls.creates[0].params.duration_in_months, 3)
  assert.equal(calls.creates[0].params.redeem_by, 1800000000)
})

test("retries reuse a deterministic coupon and creation uses an idempotency key", async () => {
  const { pricing, calls } = await fixture()
  const first = await pricing.getClassCheckoutPricing(options)
  const second = await pricing.getClassCheckoutPricing(options)
  assert.deepEqual(first, second)
  assert.equal(calls.creates.length, 1)
  assert.equal(calls.creates[0].requestOptions.idempotencyKey,
    `class-checkout-coupon:${first.discounts[0].coupon}`)
  assert.ok(first.discounts[0].coupon.length <= 40)
})

test("equivalent coupons cannot be shared with a different price", async () => {
  const { pricing } = await fixture()
  const first = await pricing.getClassCheckoutPricing(options)
  const second = await pricing.getClassCheckoutPricing({ ...options, priceId: "price_other" })
  assert.notEqual(first.discounts[0].coupon, second.discounts[0].coupon)
})

test("an expired source discount is rejected even if a derived coupon already exists", async () => {
  const { pricing, source } = await fixture()
  await pricing.getClassCheckoutPricing(options)
  source.valid = false
  await assert.rejects(pricing.getClassCheckoutPricing(options), /no longer available/)
})

test("fully discounted classes cap the percentage at 100", async () => {
  const { pricing, calls } = await fixture({ coupon: { amount_off: 10000 } })
  await pricing.getClassCheckoutPricing(options)
  assert.equal(calls.creates[0].params.percent_off, 100)
  assert.equal(monthlyNet(5900, calls.creates[0].params.percent_off), 0)
})

test("free classes require no replacement coupon", async () => {
  const { pricing, calls } = await fixture({ price: { unit_amount: 0 } })
  const result = await pricing.getClassCheckoutPricing(options)
  assert.equal(result.discounts, undefined)
  assert.deepEqual(calls.creates, [])
})

test("a stored coupon with missing provenance cannot be used for checkout", async () => {
  const { pricing, stored } = await fixture()
  const first = await pricing.getClassCheckoutPricing(options)
  stored.get(first.discounts[0].coupon).metadata = null
  await assert.rejects(pricing.getClassCheckoutPricing(options), /could not be verified/)
})

test("currency-specific amounts are used for multi-currency coupons", async () => {
  const { pricing, calls } = await fixture({ coupon: { currency: "eur", currency_options: { usd: { amount_off: 2000 } } } })
  await pricing.getClassCheckoutPricing(options)
  assert.equal(monthlyNet(5900, calls.creates[0].params.percent_off), 3900)
})

for (const [label, changes] of [
  ["expired coupon", { coupon: { valid: false } }],
  ["shared redemption limit", { coupon: { max_redemptions: 10 } }],
  ["wrong currency", { coupon: { currency: "eur" } }],
  ["wrong product", { coupon: { applies_to: { products: ["prod_other"] } } }],
  ["unsupported interval", { price: { recurring: { interval: "year", interval_count: 1 } } }],
  ["unrepresentable exact discount", { price: { unit_amount: 100001 }, coupon: { amount_off: 1001 } }],
  ["Stripe permission failure", { lookupError: Object.assign(new Error("Not permitted"), { code: "permission_denied" }) }],
]) {
  test(`${label} cannot produce an incorrect discount`, async () => {
    const { pricing, calls } = await fixture(changes)
    await assert.rejects(pricing.getClassCheckoutPricing(options))
    assert.deepEqual(calls.creates, [])
  })
}

test("class checkout retains the original price, native proration, billing date, and platform fee", async () => {
  const { pricing, calls, stripeHelpers } = await fixture()
  const { POST } = await loadModule("../app/api/enrollments/[enrollmentId]/checkout/route.ts", {
    "next/headers": { headers: async () => new Map([["origin", "https://fusion.test"]]) },
    "next/server": { NextResponse: { json: (value, init) => Response.json(value, init) } },
    "@/lib/account/class-checkout": pricing,
    "@/lib/stripe/server": stripeHelpers,
    "@/lib/account/checkout-confirmation": { getCheckoutConfirmationPath: () => "/account/checkout-confirmation" },
    "@/lib/account/payments": {
      getParentEnrollmentPaymentContext: async () => ({ userId: "parent", scheduleId: "10",
        parent: { parent_id: 1, stripe_customer_id: "cus_family" }, athlete: { athlete_id: 2 },
        enrollment: { enrollment_id: 3, class_id: 4 }, classRecord: { class_id: 4 } }),
      ensureApprovedEnrollment() {}, ensureClassPaymentRequired: async () => {}, ensureNoActiveSubscription() {},
      getClassBillingConfig: () => ({ stripePriceId: "price_class", billingDay: 15, programType: "gymnastics" }),
      getMultiAthleteCouponId: async () => "coupon_family", saveStripeCustomerId: async () => {},
    },
  })
  const response = await POST(new Request("https://fusion.test"), { params: Promise.resolve({ enrollmentId: "3" }) })
  assert.equal(response.status, 200)
  const session = calls.sessions[0]
  assert.equal(session.mode, "subscription")
  assert.equal(session.subscription_data.billing_cycle_anchor, 1794744000)
  assert.equal(session.subscription_data.application_fee_percent, 1.5)
  assert.equal(session.subscription_data.proration_behavior, "create_prorations")
  assert.deepEqual(session.line_items, [{ price: "price_class", quantity: 1 }])
  assert.equal(session.discounts[0].coupon, calls.creates[0].params.id)
  assert.equal(session.payment_method_collection, "always")
  assert.equal(session.subscription_data.metadata.multi_athlete_coupon_id, "coupon_family")
})
