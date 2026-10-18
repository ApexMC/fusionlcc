import assert from "node:assert/strict"
import test from "node:test"
import { accountDataFixture, tables } from "./fixtures/account-data.mjs"

async function fixture(t, changeRows = () => {}, priceError = null) {
  const originalKey = process.env.STRIPE_SECRET_KEY
  process.env.STRIPE_SECRET_KEY = "sk_test_mrr"
  t.after(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = originalKey
  })

  const tableData = structuredClone(tables)
  Object.assign(tableData.Enrollments[0], {
    stripe_subscription_id: "sub_class", subscription_status: "active", payment_status: "paid",
  })
  Object.assign(tableData.CheerEnrollments[0], {
    tuition_subscription_id: "sub_tuition", fee_subscription_id: "sub_fee",
    subscription_status: "active", payment_status: "paid",
  })
  changeRows(tableData)
  const priceReads = []
  const { data } = await accountDataFixture({ tableData, stripe: { prices: {
    retrieve: async id => {
      priceReads.push(id)
      if (priceError) throw priceError
      return { id, unit_amount: 10000, recurring: { interval: "month" } }
    },
  } } })
  return { data, priceReads }
}

test("MRR includes active class and cheer subscriptions after the existing estimated fees", async t => {
  const f = await fixture(t)
  const { metrics } = await f.data.getAdminDashboardData()
  assert.equal(metrics.monthlyRecurringRevenue.available, true)
  assert.equal(metrics.monthlyRecurringRevenue.amountCents, 28380)
  assert.deepEqual(f.priceReads.sort(), ["price_fee", "price_gym", "price_tuition"])
})

for (const program of ["Enrollments", "CheerEnrollments"]) {
  test(`an active ${program} failed payment does not hide the entire MRR`, async t => {
    const f = await fixture(t, rows => { rows[program][0].payment_status = "payment_failed" })
    const { metrics } = await f.data.getAdminDashboardData()
    assert.equal(metrics.monthlyRecurringRevenue.available, true)
    assert.equal(metrics.monthlyRecurringRevenue.amountCents, 28380)
  })
}

test("a past-due cheer subscription is excluded while active class MRR remains available", async t => {
  const f = await fixture(t, rows => {
    Object.assign(rows.CheerEnrollments[0], { subscription_status: "past_due", payment_status: "payment_failed" })
  })
  const { metrics } = await f.data.getAdminDashboardData()
  assert.equal(metrics.monthlyRecurringRevenue.available, true)
  assert.equal(metrics.monthlyRecurringRevenue.amountCents, 9460)
  assert.deepEqual(f.priceReads, ["price_gym"])
})

test("an active cheer enrollment with a missing subscription still reports MRR as unavailable", async t => {
  const f = await fixture(t, rows => {
    Object.assign(rows.CheerEnrollments[0], { fee_subscription_id: null, payment_status: "payment_failed" })
  })
  const { metrics } = await f.data.getAdminDashboardData()
  assert.equal(metrics.monthlyRecurringRevenue.available, false)
  assert.equal(metrics.monthlyRecurringRevenue.amountCents, null)
  assert.deepEqual(f.priceReads, [])
})

test("Stripe read failures remain unavailable instead of displaying zero revenue", async t => {
  t.mock.method(console, "error", () => {})
  const f = await fixture(t, undefined, new Error("Stripe is unavailable"))
  const { metrics } = await f.data.getAdminDashboardData()
  assert.equal(metrics.monthlyRecurringRevenue.available, false)
  assert.equal(metrics.monthlyRecurringRevenue.amountCents, null)
})
