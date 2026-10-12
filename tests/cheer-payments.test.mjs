import assert from "node:assert/strict"
import test from "node:test"
import { loadTypeScriptModule, loadTypeScriptModuleWithMocks as loadModule } from "./load-typescript.mjs"

const programs = await loadTypeScriptModule("../lib/programs.ts")
const parentPayments = await loadTypeScriptModule("../lib/account/parent-enrollments.ts")
const pagination = await loadTypeScriptModule("../lib/account/pagination.ts")
const stripeHelpers = await loadModule("../lib/stripe/server.ts", {
  "server-only": {}, "stripe": {},
})

function subscription(id, status, role) {
  return {
    id, status, customer: "cus_cheer",
    metadata: { subscription_role: role },
    default_payment_method: "pm_cheer",
    items: { data: [{ id: `si_${role}`, price: { id: `price_${role}` } }] },
  }
}

async function fixture({ tuitionStatus = "active", feeStatus = "active", result, sessionStatus = "complete",
  feeProrationEnd, existingFee = true, legacyFeeItem = false } = {}) {
  const row = { enrollment_id: "42", athlete_id: 7, status: "approved", payment_status: "unpaid",
    tuition_subscription_id: "sub_tuition", fee_subscription_id: "sub_fee" }
  const updates = []
  const tuition = subscription("sub_tuition", tuitionStatus, "tuition")
  if (legacyFeeItem) tuition.items.data.push({ id: "si_legacy_fee", price: { id: "price_fee" } })
  const fee = subscription("sub_fee", feeStatus, "fee")
  const createdFees = []
  const deletedItems = []
  let feeExists = existingFee
  const session = {
    id: "cs_cheer", status: sessionStatus, customer: "cus_cheer",
    subscription: tuition.id, payment_status: "no_payment_required",
    metadata: { enrollment_kind: "cheer", cheer_enrollment_id: row.enrollment_id,
      tuition_price_id: "price_tuition", fee_price_id: "price_fee" },
  }
  if (feeProrationEnd !== undefined) session.metadata.fee_proration_end = String(feeProrationEnd)
  const stripe = {
    checkout: { sessions: { retrieve: async () => session, list: async () => ({ data: [session] }) } },
    subscriptions: {
      retrieve: async (id) => {
        assert.ok([tuition.id, fee.id].includes(id))
        return id === tuition.id ? tuition : fee
      },
      list: async () => ({ data: feeExists ? [{ ...fee, metadata: {
        enrollment_kind: "cheer", cheer_enrollment_id: row.enrollment_id,
        subscription_role: "fee", checkout_session_id: session.id,
      } }] : [] }),
      create: async (params, options) => {
        createdFees.push({ params, options })
        feeExists = true
        fee.metadata = params.metadata
        return fee
      },
    },
    subscriptionItems: { del: async (id, params) => {
      deletedItems.push({ id, params })
      tuition.items.data = tuition.items.data.filter(item => item.id !== id)
    } },
    customers: { update: async () => ({}) },
  }
  const dependencies = {
    "server-only": {},
    "@/lib/programs": programs,
    "@/lib/account/auth": {},
    "@/lib/account/data": {},
    "@/lib/account/parent-enrollments": parentPayments,
    "@/lib/account/pagination": pagination,
    "@/lib/supabase/admin": { createAdminClient: () => ({
      from(table) {
        if (table === "Enrollments") {
          return {
            select() { return this }, eq() { return this }, in() { return this }, order() { return this },
            async range() { return { data: [], error: null, count: 0 } },
          }
        }
        assert.equal(table, "CheerEnrollments")
        let update
        return {
          update(value) { update = value; updates.push(value); return this },
          eq(column, id) { assert.equal(column, "enrollment_id"); assert.equal(id, row.enrollment_id); return this },
          select() { return this },
          async maybeSingle() {
            if (update) {
              if (result) return result
              Object.assign(row, update)
            }
            return { data: { ...row }, error: null }
          },
        }
      },
    }) },
    "@/lib/stripe/server": {
      ...stripeHelpers,
      getStripe: () => stripe,
    },
  }
  dependencies["@/lib/account/payments"] = await loadModule("../lib/account/payments.ts", dependencies)
  const payments = await loadModule("../lib/account/cheer-payments.ts", dependencies)
  return { payments, row, updates, tuition, fee, stripe, session, createdFees, deletedItems }
}

test("completed checkout activates cheer even when a subscription is not yet active", async () => {
  const { payments, row, tuition, fee } = await fixture({ feeStatus: "incomplete" })
  await payments.finalizeCheerCheckout({
    enrollmentId: row.enrollment_id, tuitionSubscription: tuition, feeSubscription: fee, paymentStatus: "paid",
  })
  assert.equal(row.status, "active")
  assert.equal(row.subscription_status, "incomplete")
  assert.equal(row.payment_status, "paid")
})

test("the verified checkout return activates cheer when no upfront payment is required", async () => {
  const { payments, row } = await fixture({ tuitionStatus: "trialing" })
  await payments.finalizeCompletedCheerCheckoutSession({
    sessionId: "cs_cheer", enrollmentId: row.enrollment_id, customerId: "cus_cheer",
  })
  assert.equal(row.status, "active")
  assert.equal(row.payment_status, "upcoming")
  assert.equal(row.stripe_customer_id, "cus_cheer")
})

test("checkout recovery also activates cheer", async () => {
  const { payments, row } = await fixture({ feeStatus: "incomplete" })
  assert.equal(await payments.recoverCompletedCheerCheckout({
    enrollmentId: row.enrollment_id, customerId: "cus_cheer",
  }), "cs_cheer")
  assert.equal(row.status, "active")
})

test("an unfinished checkout does not activate cheer", async () => {
  const { payments, row, updates } = await fixture({ sessionStatus: "open" })
  await assert.rejects(payments.finalizeCompletedCheerCheckoutSession({
    sessionId: "cs_cheer", enrollmentId: row.enrollment_id, customerId: "cus_cheer",
  }), /not complete yet/)
  assert.equal(row.status, "approved")
  assert.equal(updates.length, 0)
})

test("later subscription events still update the enrollment lifecycle", async () => {
  for (const [tuitionStatus, feeStatus, expected] of [
    ["active", "active", "active"], ["past_due", "active", "inactive"], ["canceled", "canceled", "canceled"],
  ]) {
    const { payments, row, tuition } = await fixture({ tuitionStatus, feeStatus })
    await payments.updateCheerEnrollmentFromSubscription({ enrollmentId: row.enrollment_id, subscription: tuition })
    assert.equal(row.status, expected)
  }
})

test("checkout finalization reports database failures and status mismatches", async () => {
  for (const [result, expected] of [
    [{ data: null, error: { message: "Database unavailable" } }, /Database unavailable/],
    [{ data: null, error: null }, /was not found/],
    [{ data: { enrollment_id: "42", status: "approved" }, error: null }, /Expected active, received approved/],
  ]) {
    const { payments, row, tuition, fee } = await fixture({ result })
    await assert.rejects(payments.finalizeCheerCheckout({
      enrollmentId: row.enrollment_id, tuitionSubscription: tuition, feeSubscription: fee,
    }), expected)
  }
})

test("the initial cheer fee uses only Stripe's prorated line for its own billing period", async () => {
  const { payments, stripe } = await fixture()
  const billingAnchor = stripeHelpers.getNextBillingAnchorUnix(15)
  const periodStart = Math.floor(Date.now() / 1000)
  const line = {
    amount: 1234, currency: "usd",
    parent: { subscription_item_details: { proration: true } },
    pricing: { price_details: { price: "price_fee", product: "prod_fee" } },
    period: { start: periodStart, end: billingAnchor },
  }
  const calls = []
  stripe.invoices = { createPreview: async params => {
    calls.push(params)
    return { amount_due: 99999, lines: { data: [
      { ...line, parent: { subscription_item_details: { proration: false } }, amount: 5000 },
      { ...line, pricing: { price_details: { price: "price_unrelated" } } },
      { ...line, period: { start: periodStart, end: billingAnchor + 100 } },
      line,
    ] } }
  } }
  assert.deepEqual(await payments.getCheerCheckoutFeeProration({
    customerId: "cus_cheer", feePriceId: "price_fee", billingAnchor,
  }), {
    lineItem: { price_data: { currency: "usd", product: "prod_fee", unit_amount: 1234 }, quantity: 1 },
    periodStart, periodEnd: billingAnchor,
  })
  assert.deepEqual(calls, [{ customer: "cus_cheer", discounts: "", subscription_details: {
    items: [{ price: "price_fee", quantity: 1 }], billing_cycle_anchor: billingAnchor,
    proration_behavior: "create_prorations",
  } }])
})

test("cheer checkout charges the fee preview once and anchors tuition and fees independently", async () => {
  const { payments, stripe } = await fixture()
  const previews = []
  const sessions = []
  stripe.invoices = { createPreview: async params => {
    previews.push(params)
    return { lines: { data: [{
      amount: 1234, currency: "usd",
      parent: { subscription_item_details: { proration: true } },
      pricing: { price_details: { price: "price_fee", product: "prod_fee" } },
      period: { start: Math.floor(Date.now() / 1000), end: params.subscription_details.billing_cycle_anchor },
    }] } }
  } }
  stripe.checkout.sessions.create = async (params, options) => {
    sessions.push({ params, options })
    return { url: "https://checkout.example.test" }
  }
  const context = {
    userId: "user_parent", enrollment: { enrollment_id: 42, status: "approved", contract_signed: true },
    parent: { parent_id: 1, stripe_customer_id: "cus_cheer" }, athlete: { athlete_id: 7 },
    team: { team_id: 2, tuition_price_id: "price_tuition", fee_price_id: "price_fee" },
  }
  const { POST } = await loadModule("../app/api/cheer-enrollments/[enrollmentId]/checkout/route.ts", {
    "next/headers": { headers: async () => new Map([["origin", "https://example.test"]]) },
    "next/server": { NextResponse: { json: (value, init) => Response.json(value, init) } },
    "@/lib/account/cheer-payments": {
      ...payments,
      getParentCheerEnrollmentPaymentContext: async () => context,
      saveCheerStripeCustomerId: async () => {},
      recoverCompletedCheerCheckout: async () => null,
    },
    "@/lib/account/checkout-confirmation": { getCheckoutConfirmationPath: () => "/account/checkout-confirmation" },
    "@/lib/stripe/server": { ...stripeHelpers, getStripe: () => stripe },
  })
  const start = () => POST(new Request("https://example.test"), { params: Promise.resolve({ enrollmentId: "42" }) })
  const response = await start()
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { url: "https://checkout.example.test" })
  assert.equal(previews[0].subscription_details.billing_cycle_anchor, stripeHelpers.getNextBillingAnchorUnix(15))
  assert.equal(sessions[0].params.subscription_data.billing_cycle_anchor, stripeHelpers.getNextBillingAnchorUnix(1))
  assert.equal(sessions[0].params.subscription_data.proration_behavior, "create_prorations")
  assert.deepEqual(sessions[0].params.line_items, [
    { price: "price_tuition", quantity: 1 },
    { price_data: { currency: "usd", product: "prod_fee", unit_amount: 1234 }, quantity: 1 },
  ])
  assert.equal(sessions[0].params.metadata.fee_proration_end, String(stripeHelpers.getNextBillingAnchorUnix(15)))
  assert.match(sessions[0].options.idempotencyKey, /^cheer-checkout-prorated:/)
  stripe.invoices.createPreview = async () => { throw new Error("Stripe preview unavailable") }
  const failed = await start()
  assert.equal(failed.status, 400)
  assert.equal((await failed.json()).error, "Stripe preview unavailable")
  assert.equal(sessions.length, 1, "a failed preview must not start a checkout with the wrong amount")
})

test("free cheer fees remain zero and unusable proration previews fail closed", async () => {
  const { payments, stripe } = await fixture()
  const billingAnchor = stripeHelpers.getNextBillingAnchorUnix(15)
  const args = { customerId: "cus_cheer", feePriceId: "price_fee", billingAnchor }
  const line = {
    amount: 0, currency: "usd",
    parent: { subscription_item_details: { proration: true } },
    pricing: { price_details: { price: "price_fee", product: "prod_fee" } },
    period: { start: Math.floor(Date.now() / 1000), end: billingAnchor },
  }
  stripe.invoices = { createPreview: async () => ({ lines: { data: [line] } }) }
  assert.equal((await payments.getCheerCheckoutFeeProration(args)).lineItem.price_data.unit_amount, 0)
  for (const data of [[], [{ ...line, amount: -100 }], [{ ...line, pricing: null }]]) {
    stripe.invoices.createPreview = async () => ({ lines: { data } })
    await assert.rejects(payments.getCheerCheckoutFeeProration(args), /could not calculate/)
  }
})

test("prepaid cheer fee subscriptions start billing on the quoted 15th without charging again", async () => {
  const feeProrationEnd = stripeHelpers.getNextBillingAnchorUnix(15)
  const { payments, row, session, createdFees, deletedItems } = await fixture({ feeProrationEnd, existingFee: false })
  session.payment_status = "paid"
  const args = { session, enrollmentId: row.enrollment_id, tuitionPriceId: "price_tuition", feePriceId: "price_fee" }
  await payments.splitAndFinalizeCheerCheckout(args)
  assert.equal(row.status, "active")
  assert.equal(row.payment_status, "paid")
  assert.deepEqual(deletedItems, [])
  assert.equal(createdFees.length, 1)
  assert.deepEqual(createdFees[0].params.items, [{ price: "price_fee", quantity: 1 }])
  assert.equal(createdFees[0].params.billing_cycle_anchor, feeProrationEnd)
  assert.equal(createdFees[0].params.proration_behavior, "none")
  assert.equal(createdFees[0].params.default_payment_method, "pm_cheer")
  assert.equal(createdFees[0].params.backdate_start_date, undefined)
  assert.equal(createdFees[0].options.idempotencyKey, "cheer-fee-subscription:42:cs_cheer")
  await payments.splitAndFinalizeCheerCheckout(args)
  assert.equal(createdFees.length, 1, "repeated completion must reuse the fee subscription")
})

test("late cheer checkout recovery bills only time after the prepaid fee period", async () => {
  const feeProrationEnd = Math.floor(Date.now() / 1000) - 86400
  const { payments, row, session, createdFees } = await fixture({ feeProrationEnd, existingFee: false })
  session.payment_status = "paid"
  await payments.splitAndFinalizeCheerCheckout({
    session, enrollmentId: row.enrollment_id, tuitionPriceId: "price_tuition", feePriceId: "price_fee",
  })
  assert.equal(createdFees[0].params.billing_cycle_anchor, stripeHelpers.getNextBillingAnchorUnix(15))
  assert.equal(createdFees[0].params.proration_behavior, "create_prorations")
  assert.equal(createdFees[0].params.backdate_start_date, feeProrationEnd)
})

test("legacy cheer checkout completion keeps its original fee billing behavior", async () => {
  const { payments, row, session, createdFees, deletedItems } = await fixture({ existingFee: false, legacyFeeItem: true })
  await payments.splitAndFinalizeCheerCheckout({
    session, enrollmentId: row.enrollment_id, tuitionPriceId: "price_tuition", feePriceId: "price_fee",
  })
  assert.deepEqual(deletedItems, [{ id: "si_legacy_fee", params: { proration_behavior: "none" } }])
  assert.equal(createdFees[0].params.proration_behavior, "none")
  assert.equal(createdFees[0].params.billing_cycle_anchor, stripeHelpers.getNextBillingAnchorUnix(15))
})

test("invalid prepaid periods stop cheer completion before Stripe mutations", async () => {
  for (const feeProrationEnd of ["invalid", -1, 0, 1.5]) {
    const { payments, row, session, createdFees, deletedItems } = await fixture({ feeProrationEnd, existingFee: false })
    await assert.rejects(payments.splitAndFinalizeCheerCheckout({
      session, enrollmentId: row.enrollment_id, tuitionPriceId: "price_tuition", feePriceId: "price_fee",
    }), /invalid fee proration period/)
    assert.deepEqual(createdFees, [])
    assert.deepEqual(deletedItems, [])
    assert.equal(row.status, "approved")
  }
})

test("billing anchors follow each renewal day across month, year, and leap-year boundaries", () => {
  for (const [day, now, expected] of [
    [1, "2026-10-07T12:00:00Z", "2026-11-01T12:00:00Z"],
    [15, "2026-10-07T12:00:00Z", "2026-10-15T12:00:00Z"],
    [15, "2026-10-15T11:59:59Z", "2026-10-15T12:00:00Z"],
    [15, "2026-10-15T12:00:00Z", "2026-11-15T12:00:00Z"],
    [1, "2026-12-31T12:00:00Z", "2027-01-01T12:00:00Z"],
    [15, "2028-02-29T12:00:00Z", "2028-03-15T12:00:00Z"],
  ]) assert.equal(stripeHelpers.getNextBillingAnchorUnix(day, new Date(now)), Date.parse(expected) / 1000)
})
