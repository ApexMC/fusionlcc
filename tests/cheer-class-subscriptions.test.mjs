import assert from "node:assert/strict"
import test from "node:test"
import { loadTypeScriptModule, loadTypeScriptModuleWithMocks as loadModule } from "./load-typescript.mjs"

const programs = await loadTypeScriptModule("../lib/programs.ts")
const parentPayments = await loadTypeScriptModule("../lib/account/parent-enrollments.ts")
const pagination = await loadTypeScriptModule("../lib/account/pagination.ts")
const stripeHelpers = await loadModule("../lib/stripe/server.ts", { "server-only": {}, stripe: {} })

function subscription(id, metadata, status = "active") {
  return {
    id, status, customer: "cus_family", metadata, default_payment_method: "pm_family",
    items: { data: [{ price: { id: `price_${metadata.subscription_role ?? "class"}` }, current_period_start: 1790812800, current_period_end: 1793491200 }] },
  }
}

async function fixture(options = {}) {
  const cheer = { enrollment_id: 42, athlete_id: 7, status: "approved", payment_status: "unpaid", tuition_subscription_id: "sub_tuition", fee_subscription_id: "sub_fee" }
  const classes = [
    { enrollment_id: 100, athlete_id: 7, status: "active", stripe_subscription_id: "sub_class", subscription_status: "active", payment_status: "paid", schedule_id: 20 },
    { enrollment_id: 101, athlete_id: 7, status: "approved", stripe_subscription_id: null, subscription_status: null, payment_status: null, schedule_id: 21 },
    { enrollment_id: 102, athlete_id: 8, status: "active", stripe_subscription_id: "sub_sibling", subscription_status: "active", payment_status: "paid", schedule_id: 20 },
    { enrollment_id: 103, athlete_id: 7, status: "canceled", stripe_subscription_id: "sub_historical", subscription_status: "canceled", payment_status: "paid", schedule_id: 20 },
    { enrollment_id: 104, athlete_id: 7, status: "pending", stripe_subscription_id: null, payment_status: null, schedule_id: 22 },
    { enrollment_id: 105, athlete_id: 7, status: "inactive", stripe_subscription_id: "sub_overdue", subscription_status: "past_due", payment_status: "payment_failed", schedule_id: 23 },
    { enrollment_id: 106, athlete_id: 7, status: "denied", stripe_subscription_id: null, payment_status: null, schedule_id: 20 },
  ].map(row => ({ ...row, current_period_start: "2026-10-01", current_period_end: "2026-11-01" }))
  const originalClasses = structuredClone(classes)
  const tuition = subscription("sub_tuition", { subscription_role: "tuition" }, options.tuitionStatus ?? "active")
  const fee = subscription("sub_fee", {
    subscription_role: "fee", enrollment_kind: "cheer", cheer_enrollment_id: "42", checkout_session_id: "cs_cheer",
  }, options.feeStatus ?? "active")
  const subscriptions = new Map([tuition, fee, ...classes.filter(row => row.stripe_subscription_id).map(row =>
    subscription(row.stripe_subscription_id, { enrollment_id: String(row.enrollment_id), athlete_id: String(row.athlete_id) }, row.subscription_status)
  )].map(row => [row.id, row]))
  const canceled = []
  const pages = []
  const controls = { cancelFailures: 0, cleanupFailures: 0, ...options }
  let classPayments
  const db = { from(table) {
    const filters = []
    let update
    const read = () => {
      if (table === "Enrollments" && !update && controls.classReadError) return { data: null, error: { message: controls.classReadError } }
      if (table === "Enrollments" && update?.stripe_subscription_id === null && controls.cleanupFailures > 0) {
        controls.cleanupFailures--
        return { data: null, error: { message: "Class cleanup failed" } }
      }
      if (table === "Enrollments" && update?.stripe_subscription_id && controls.beforeSubscriptionUpdate) {
        controls.beforeSubscriptionUpdate()
        controls.beforeSubscriptionUpdate = null
      }
      const rows = (table === "CheerEnrollments" ? [cheer] : classes).filter(row => filters.every(filter => filter(row)))
      if (update) for (const row of rows) Object.assign(row, update)
      return { data: structuredClone(rows), error: null, count: rows.length }
    }
    return {
      select() { return this }, order() { return this },
      eq(key, value) { filters.push(row => String(row[key]) === String(value)); return this },
      is(key, value) { filters.push(row => (row[key] ?? null) === value); return this },
      in(key, values) { filters.push(row => values.includes(row[key])); return this },
      or(expression) {
        filters.push(row => expression.split(",").some(condition => {
          const [key, operation, value] = condition.split(".")
          if (operation === "is") return (row[key] ?? null) === null && value === "null"
          if (operation === "neq") return row[key] != null && String(row[key]) !== value
          throw new Error(`Unexpected filter: ${condition}`)
        }))
        return this
      },
      update(value) { update = value; return this },
      then(resolve, reject) { return Promise.resolve(read()).then(resolve, reject) },
      async maybeSingle() { const result = read(); return { ...result, data: result.data?.[0] ?? null } },
      async range(from) {
        pages.push(from)
        const result = read()
        return { ...result, data: result.data?.slice(from, from + 1) ?? null }
      },
    }
  } }
  const session = {
    id: "cs_cheer", status: options.sessionStatus ?? "complete", customer: "cus_family", subscription: tuition.id, payment_status: options.sessionPaymentStatus ?? "no_payment_required",
    metadata: { enrollment_kind: "cheer", cheer_enrollment_id: "42", tuition_price_id: "price_tuition", fee_price_id: "price_fee" },
  }
  const stripe = {
    checkout: { sessions: { retrieve: async () => session, list: async () => ({ data: [session] }) } },
    customers: { update: async () => ({}) },
    subscriptions: {
      update: async (id, params) => {
        // Enforce Stripe's real metadata limits at this external boundary.
        // Otherwise an invalid tracking key can pass every cancellation test.
        for (const [key, value] of Object.entries(params.metadata ?? {})) {
          assert.ok(key.length <= 40, `Stripe metadata key exceeds 40 characters: ${key}`)
          assert.ok(value.length <= 500, `Stripe metadata value exceeds 500 characters: ${key}`)
        }
        if (controls.markerFailures > 0) { controls.markerFailures--; throw new Error("Marker save failed") }
        const row = subscriptions.get(id)
        Object.assign(row.metadata, params.metadata)
        return structuredClone(row)
      },
      retrieve: async id => {
        assert.ok(subscriptions.has(id), `Unknown subscription: ${id}`)
        return structuredClone(subscriptions.get(id))
      },
      list: async () => ({ data: [fee] }),
      cancel: async (id, params) => {
        if (controls.cancelFailures > 0) { controls.cancelFailures--; throw new Error("Stripe cancellation failed") }
        const row = subscriptions.get(id)
        if (row.status === "canceled") throw new Error("Subscription already canceled")
        row.status = "canceled"
        canceled.push({ id, params })
        if (controls.onCancel) await controls.onCancel({ classPayments, subscription: structuredClone(row) })
        if (controls.cancelResponseFailure) { controls.cancelResponseFailure = false; throw new Error("Response connection lost") }
        return structuredClone(row)
      },
    },
  }
  const dependencies = {
    "server-only": {}, stripe: {},
    "@/lib/programs": programs,
    "@/lib/account/auth": {},
    "@/lib/account/data": {},
    "@/lib/account/parent-enrollments": parentPayments,
    "@/lib/account/pagination": pagination,
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "@/lib/stripe/server": { ...stripeHelpers, getStripe: () => stripe },
  }
  classPayments = await loadModule("../lib/account/payments.ts", dependencies)
  const payments = await loadModule("../lib/account/cheer-payments.ts", { ...dependencies, "@/lib/account/payments": classPayments })
  return {
    cheer, classes, originalClasses, subscriptions, canceled, pages, controls, payments, classPayments, tuition, fee,
    complete: () => payments.finalizeCheerCheckout({ enrollmentId: 42, tuitionSubscription: tuition, feeSubscription: fee, paymentStatus: "paid" }),
  }
}

function assertClassesFree(fixture) {
  for (const id of [100, 101, 105]) {
    const row = fixture.classes.find(row => row.enrollment_id === id)
    assert.equal(row.status, "active")
    assert.equal(row.payment_status, "payment_not_required")
    assert.equal(row.stripe_subscription_id, null)
    assert.equal(row.subscription_status, null)
    assert.equal(row.current_period_start, null)
    assert.equal(row.current_period_end, null)
    assert.equal(row.schedule_id, fixture.originalClasses.find(row => row.enrollment_id === id).schedule_id)
  }
  for (const id of [102, 103, 104, 106]) {
    assert.deepEqual(fixture.classes.find(row => row.enrollment_id === id), fixture.originalClasses.find(row => row.enrollment_id === id))
  }
}

test("cheer checkout cancels the athlete's class subscriptions immediately and keeps current classes active and free", async () => {
  const result = await fixture({ feeStatus: "incomplete" })
  await result.complete()
  assert.equal(result.cheer.status, "active")
  assertClassesFree(result)
  assert.deepEqual(result.canceled, [
    { id: "sub_class", params: { invoice_now: false, prorate: false } },
    { id: "sub_overdue", params: { invoice_now: false, prorate: false } },
  ])
  assert.deepEqual(result.pages, [0, 1, 2], "all class enrollment pages are processed")
  assert.equal(result.subscriptions.get("sub_tuition").status, "active")
  assert.equal(result.subscriptions.get("sub_fee").status, "incomplete")
  assert.equal(result.subscriptions.get("sub_sibling").status, "active")
})

test("the webhook completion, verified return, and checkout recovery all convert paid classes to free classes", async () => {
  for (const path of ["webhook", "return", "recovery"]) {
    const result = await fixture({ tuitionStatus: "trialing" })
    if (path === "webhook") await result.payments.splitAndFinalizeCheerCheckout({
      session: { id: "cs_cheer", customer: "cus_family", subscription: "sub_tuition", payment_status: "paid" },
      enrollmentId: "42", tuitionPriceId: "price_tuition", feePriceId: "price_fee",
    })
    else if (path === "return") await result.payments.finalizeCompletedCheerCheckoutSession({ sessionId: "cs_cheer", enrollmentId: "42", customerId: "cus_family" })
    else assert.equal(await result.payments.recoverCompletedCheerCheckout({ enrollmentId: "42", customerId: "cus_family" }), "cs_cheer")
    assertClassesFree(result)
    assert.equal(result.canceled.length, 2, path)
  }
})

test("incomplete checkout never cancels class billing", async () => {
  for (const options of [{ sessionStatus: "open" }, { sessionPaymentStatus: "unpaid" }]) {
    const result = await fixture(options)
    await assert.rejects(result.payments.finalizeCompletedCheerCheckoutSession({ sessionId: "cs_cheer", enrollmentId: "42", customerId: "cus_family" }), /not complete yet/)
    assert.deepEqual(result.classes, result.originalClasses)
    assert.deepEqual(result.canceled, [])
  }
})

test("the confirmation retains the cancellation notice when the webhook clears class IDs before the return", async () => {
  const result = await fixture()
  await result.payments.splitAndFinalizeCheerCheckout({
    session: { id: "cs_cheer", customer: "cus_family", subscription: "sub_tuition", payment_status: "paid" },
    enrollmentId: "42", tuitionPriceId: "price_tuition", feePriceId: "price_fee",
  })
  assertClassesFree(result)
  assert.deepEqual(await result.payments.finalizeCompletedCheerCheckoutSession({
    sessionId: "cs_cheer", enrollmentId: "42", customerId: "cus_family",
  }), { classSubscriptionsCanceled: true })
  assert.equal(result.canceled.length, 2)
})

test("cheer confirmation has no cancellation notice when this athlete had no class subscription", async () => {
  const result = await fixture()
  for (const row of result.classes.filter(row => row.athlete_id === 7 && ["active", "approved", "inactive"].includes(row.status))) {
    row.stripe_subscription_id = null
  }
  assert.deepEqual(await result.payments.finalizeCompletedCheerCheckoutSession({
    sessionId: "cs_cheer", enrollmentId: "42", customerId: "cus_family",
  }), { classSubscriptionsCanceled: false })
  assert.deepEqual(result.canceled, [])
  assert.equal(result.tuition.metadata.class_cancellation_requested, undefined)
})

test("confirmation reports success only after every class cancellation finishes and preserves the notice on retry", async () => {
  let canceledOnce = false
  const result = await fixture({ onCancel: async () => {
    if (!canceledOnce) { canceledOnce = true; result.controls.cancelFailures = 1 }
  } })
  const complete = () => result.payments.finalizeCompletedCheerCheckoutSession({
    sessionId: "cs_cheer", enrollmentId: "42", customerId: "cus_family",
  })
  await assert.rejects(complete(), /Stripe cancellation failed/)
  assert.equal(result.classes[0].stripe_subscription_id, null)
  assert.equal(result.tuition.metadata.class_cancellation_requested, "true")
  assert.deepEqual(await complete(), { classSubscriptionsCanceled: true })
  assertClassesFree(result)
})

test("cancellation evidence is saved before class subscription IDs can be erased", async () => {
  const result = await fixture({ markerFailures: 1 })
  await assert.rejects(result.complete(), /Marker save failed/)
  assert.equal(result.classes[0].stripe_subscription_id, "sub_class")
  assert.deepEqual(result.canceled, [])
  await result.complete()
  assertClassesFree(result)
})

test("sequential and concurrent duplicate cheer completions are safe", async () => {
  const result = await fixture()
  await Promise.all([result.complete(), result.complete()])
  await result.complete()
  assertClassesFree(result)
  assert.deepEqual(result.canceled.map(row => row.id).sort(), ["sub_class", "sub_overdue"])
})

test("failed Stripe cancellation retains the subscription ID so completion can retry", async () => {
  const result = await fixture({ cancelFailures: 1 })
  await assert.rejects(result.complete(), /Stripe cancellation failed/)
  assert.equal(result.classes[0].status, "active")
  assert.equal(result.classes[0].payment_status, "payment_not_required")
  assert.equal(result.classes[0].stripe_subscription_id, "sub_class")
  assert.equal(result.subscriptions.get("sub_class").status, "active")
  await result.complete()
  assertClassesFree(result)
  assert.equal(result.canceled.length, 2)
})

test("database cleanup failures retry without canceling an already canceled subscription again", async () => {
  const result = await fixture({ cleanupFailures: 1 })
  await assert.rejects(result.complete(), /Class cleanup failed/)
  assert.equal(result.classes[0].stripe_subscription_id, "sub_class")
  assert.equal(result.subscriptions.get("sub_class").status, "canceled")
  await result.complete()
  assertClassesFree(result)
  assert.equal(result.canceled.length, 2)
})

test("a lost Stripe response after successful cancellation still completes cleanup", async () => {
  const result = await fixture({ cancelResponseFailure: true })
  await result.complete()
  assertClassesFree(result)
  assert.equal(result.canceled.length, 2)
})

test("class read failures and mismatched Stripe subscription metadata are reported", async () => {
  const unavailable = await fixture({ classReadError: "Class read failed" })
  await assert.rejects(unavailable.complete(), /Class read failed/)
  assert.deepEqual(unavailable.classes, unavailable.originalClasses)
  assert.deepEqual(unavailable.canceled, [])
  const mismatch = await fixture()
  mismatch.subscriptions.get("sub_class").metadata.athlete_id = "8"
  await assert.rejects(mismatch.complete(), /does not match this athlete/)
  assert.deepEqual(mismatch.canceled, [])
})

test("cancellation and late invoice or subscription events cannot deactivate free classes or reattach billing", async () => {
  const result = await fixture({ onCancel: async ({ classPayments, subscription }) => {
    await classPayments.updateEnrollmentFromSubscription({ enrollmentId: subscription.metadata.enrollment_id, subscription, eventType: "customer.subscription.deleted" })
  } })
  await result.complete()
  for (const [eventType, status, paymentStatus] of [
    ["customer.subscription.deleted", "canceled"],
    ["customer.subscription.updated", "active"],
    ["invoice.payment_failed", "past_due", "payment_failed"],
    ["invoice.payment_succeeded", "active", "paid"],
    ["checkout.session.completed", "active", "paid"],
  ]) {
    await result.classPayments.updateEnrollmentFromSubscription({
      enrollmentId: 100, subscription: subscription("sub_class", { enrollment_id: "100" }, status), eventType, paymentStatus,
    })
    assertClassesFree(result)
  }
})

test("a cheer waiver saved between a class webhook read and write is preserved atomically", async () => {
  const result = await fixture()
  result.controls.beforeSubscriptionUpdate = () => {
    result.classes[0].payment_status = "payment_not_required"
    result.classes[0].status = "active"
  }
  await result.classPayments.updateEnrollmentFromSubscription({
    enrollmentId: 100, subscription: subscription("sub_class", {}, "active"), eventType: "checkout.session.completed",
  })
  assert.equal(result.classes[0].status, "active")
  assert.equal(result.classes[0].payment_status, "payment_not_required")
  assert.equal(result.subscriptions.get("sub_class").status, "canceled")
})

test("class Checkout arriving after cheer completion is canceled without reattaching class billing", async () => {
  const result = await fixture()
  await result.complete()
  const lateSubscription = subscription("sub_late_class", { enrollment_id: "100", athlete_id: "7" })
  result.subscriptions.set(lateSubscription.id, lateSubscription)
  await result.classPayments.updateEnrollmentFromSubscription({
    enrollmentId: 100, subscription: structuredClone(lateSubscription), eventType: "checkout.session.completed", paymentStatus: "paid",
  })
  assertClassesFree(result)
  assert.equal(result.subscriptions.get(lateSubscription.id).status, "canceled")
  assert.equal(result.canceled.length, 3)
})

test("subscription events still update paid class enrollments normally", async () => {
  for (const [status, eventType, expected] of [
    ["active", "checkout.session.completed", "active"],
    ["past_due", "invoice.payment_failed", "inactive"],
    ["canceled", "customer.subscription.deleted", "canceled"],
  ]) {
    const result = await fixture()
    await result.classPayments.updateEnrollmentFromSubscription({ enrollmentId: 100, subscription: subscription("sub_class", {}, status), eventType, paymentStatus: "paid" })
    assert.equal(result.classes[0].status, expected)
    assert.equal(result.classes[0].stripe_subscription_id, "sub_class")
    assert.equal(result.classes[0].subscription_status, status)
  }
})
