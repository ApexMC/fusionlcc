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

async function fixture({ tuitionStatus = "active", feeStatus = "active", result, sessionStatus = "complete" } = {}) {
  const row = { enrollment_id: "42", athlete_id: 7, status: "approved", payment_status: "unpaid",
    tuition_subscription_id: "sub_tuition", fee_subscription_id: "sub_fee" }
  const updates = []
  const tuition = subscription("sub_tuition", tuitionStatus, "tuition")
  const fee = subscription("sub_fee", feeStatus, "fee")
  const session = {
    id: "cs_cheer", status: sessionStatus, customer: "cus_cheer",
    subscription: tuition.id, payment_status: "no_payment_required",
    metadata: { enrollment_kind: "cheer", cheer_enrollment_id: row.enrollment_id,
      tuition_price_id: "price_tuition", fee_price_id: "price_fee" },
  }
  const stripe = {
    checkout: { sessions: { retrieve: async () => session, list: async () => ({ data: [session] }) } },
    subscriptions: {
      retrieve: async (id) => {
        assert.ok([tuition.id, fee.id].includes(id))
        return id === tuition.id ? tuition : fee
      },
      list: async () => ({ data: [{ ...fee, metadata: {
        enrollment_kind: "cheer", cheer_enrollment_id: row.enrollment_id,
        subscription_role: "fee", checkout_session_id: session.id,
      } }] }),
    },
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
  return { payments, row, updates, tuition, fee }
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
