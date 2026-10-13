import assert from "node:assert/strict"
import test from "node:test"
import Stripe from "stripe"
import { loadTypeScriptModuleWithMocks as loadModule } from "./load-typescript.mjs"

function configureStripe(t, values) {
  const names = ["STRIPE_SECRET_KEY", "STRIPE_CONNECTED_ACCOUNT_ID", "STRIPE_WEBHOOK_SECRET"]
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]))
  t.after(() => {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name]
      else process.env[name] = saved[name]
    }
  })
  for (const name of names) {
    if (values[name] === undefined) delete process.env[name]
    else process.env[name] = values[name]
  }
}

test("missing Connect credentials fail before constructing a Stripe client", async t => {
  configureStripe(t, {})
  const { getStripe } = await loadModule("../lib/stripe/server.ts", {
    "server-only": {},
    stripe: { default: class { constructor() { throw new Error("Unexpected Stripe client") } } },
  })
  assert.throws(getStripe, /STRIPE_SECRET_KEY is not configured/)
  process.env.STRIPE_SECRET_KEY = "sk_test_platform"
  assert.throws(getStripe, /STRIPE_CONNECTED_ACCOUNT_ID is not configured/)
  process.env.STRIPE_CONNECTED_ACCOUNT_ID = "  "
  assert.throws(getStripe, /STRIPE_CONNECTED_ACCOUNT_ID is not configured/)
})

test("the real Stripe SDK scopes creation and later billing requests to the gym account", async t => {
  configureStripe(t, {
    STRIPE_SECRET_KEY: " sk_test_platform ",
    STRIPE_CONNECTED_ACCOUNT_ID: " acct_gym ",
  })
  const requests = []
  // Replace only the transport; exercise Stripe's actual request headers.
  const httpClient = Stripe.createFetchHttpClient(async (url, init) => {
    requests.push({ url, ...init })
    return Response.json({ id: "test_object" })
  })
  const { getStripe } = await loadModule("../lib/stripe/server.ts", {
    "server-only": {},
    stripe: { default: class extends Stripe {
      constructor(key, options) { super(key, { ...options, httpClient, telemetry: false }) }
    } },
  })
  const stripe = getStripe()
  assert.equal(getStripe(), stripe)
  await stripe.customers.create({ name: "Parent" })
  await stripe.prices.retrieve("price_gym")
  await stripe.checkout.sessions.create({
    mode: "subscription", customer: "cus_gym", line_items: [{ price: "price_gym", quantity: 1 }],
    subscription_data: { application_fee_percent: 1.5 },
  })
  await stripe.subscriptions.create({ customer: "cus_gym", application_fee_percent: 1.5 })
  await stripe.subscriptions.retrieve("sub_gym")
  await stripe.subscriptions.update("sub_gym", { cancel_at_period_end: true })
  await stripe.setupIntents.create({ customer: "cus_gym", usage: "off_session" })
  assert.equal(requests.length, 7)
  for (const request of requests) {
    const headers = new Headers(request.headers)
    assert.equal(headers.get("stripe-account"), "acct_gym")
    assert.equal(headers.get("authorization"), "Bearer sk_test_platform")
  }
  assert.equal(new URLSearchParams(requests[2].body).get("subscription_data[application_fee_percent]"), "1.5")
  assert.equal(new URLSearchParams(requests[3].body).get("application_fee_percent"), "1.5")
})

test("signed Connect webhooks process only the gym's checkout events", async t => {
  configureStripe(t, {
    STRIPE_SECRET_KEY: "sk_test_platform",
    STRIPE_CONNECTED_ACCOUNT_ID: " acct_gym ",
    STRIPE_WEBHOOK_SECRET: "whsec_connect_test",
  })
  const handled = []
  const signer = new Stripe("sk_test_platform")
  const { POST } = await loadModule("../app/api/stripe/webhook/route.ts", {
    "next/server": { NextResponse: { json: (value, init) => Response.json(value, init) } },
    "@/lib/supabase/admin": { createAdminClient() { throw new Error("Unexpected database access") } },
    "@/lib/account/payments": {},
    "@/lib/account/cheer-payments": { splitAndFinalizeCheerCheckout: async args => handled.push(args) },
    "@/lib/stripe/server": { getStripe: () => ({ webhooks: signer.webhooks }) },
  })
  const session = { id: "cs_gym", metadata: {
    enrollment_kind: "cheer", cheer_enrollment_id: "42", tuition_price_id: "price_tuition", fee_price_id: "price_fee",
  } }
  for (const account of ["acct_other", undefined, "acct_gym"]) {
    const body = JSON.stringify({ account, type: "checkout.session.completed", data: { object: session } })
    const signature = signer.webhooks.generateTestHeaderString({ payload: body, secret: process.env.STRIPE_WEBHOOK_SECRET })
    const request = () => new Request("https://example.test/api/stripe/webhook", {
      method: "POST", body, headers: { "stripe-signature": signature },
    })
    const response = await POST(request())
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), account === "acct_gym"
      ? { received: true } : { received: true, ignored: true })
    if (account !== "acct_gym") assert.equal(handled.length, 0)
    else {
      const tampered = request()
      tampered.headers.set("stripe-signature", "invalid")
      assert.equal((await POST(tampered)).status, 400)
    }
  }
  assert.deepEqual(handled, [{ session, enrollmentId: "42", tuitionPriceId: "price_tuition", feePriceId: "price_fee" }])
})

async function invoiceWebhookFixture(t, { kind = "class", updateError } = {}) {
  configureStripe(t, {
    STRIPE_SECRET_KEY: "sk_test_platform",
    STRIPE_CONNECTED_ACCOUNT_ID: "acct_gym",
    STRIPE_WEBHOOK_SECRET: "whsec_connect_test",
  })
  const signer = new Stripe("sk_test_platform")
  const subscription = {
    id: "sub_gym", customer: "cus_gym", status: "active", items: { data: [] },
    metadata: kind === "cheer" ? { cheer_enrollment_id: "42" } : { enrollment_id: "42" },
  }
  const reads = []
  const updates = []
  const update = async args => {
    if (updateError) throw new Error(updateError)
    updates.push({ kind, ...args })
  }
  const { POST } = await loadModule("../app/api/stripe/webhook/route.ts", {
    "next/server": { NextResponse: { json: (value, init) => Response.json(value, init) } },
    "@/lib/supabase/admin": { createAdminClient() { throw new Error("Unexpected database access") } },
    "@/lib/account/payments": { updateEnrollmentFromSubscription: update },
    "@/lib/account/cheer-payments": {
      findCheerEnrollmentIdBySubscription: async () => null,
      updateCheerEnrollmentFromSubscription: update,
    },
    "@/lib/stripe/server": { getStripe: () => ({
      webhooks: signer.webhooks,
      subscriptions: { retrieve: async id => { reads.push(id); assert.equal(id, subscription.id); return subscription } },
    }) },
  })
  return { subscription, reads, updates, async deliver(type, invoice) {
    const body = JSON.stringify({ account: "acct_gym", livemode: false, api_version: "2026-06-24.dahlia", type, data: { object: invoice } })
    const signature = signer.webhooks.generateTestHeaderString({ payload: body, secret: process.env.STRIPE_WEBHOOK_SECRET })
    return POST(new Request("https://example.test/api/stripe/webhook", {
      method: "POST", body, headers: { "stripe-signature": signature },
    }))
  } }
}

for (const kind of ["class", "cheer"]) {
  for (const [type, paymentStatus] of [["invoice.payment_succeeded", "paid"], ["invoice.payment_failed", "payment_failed"]]) {
    test(`${kind} ${type} updates enrollment from current Stripe invoice parents`, async t => {
      const f = await invoiceWebhookFixture(t, { kind })
      for (const reference of [f.subscription.id, { id: f.subscription.id }]) {
        const response = await f.deliver(type, {
          id: "in_gym", customer: { id: "cus_gym" },
          parent: { type: "subscription_details", subscription_details: { subscription: reference } },
        })
        assert.equal(response.status, 200)
        const expected = { kind, enrollmentId: "42", customerId: "cus_gym", subscription: f.subscription, paymentStatus }
        if (kind === "class") expected.eventType = type
        assert.deepEqual(f.updates.at(-1), expected)
      }
      assert.deepEqual(f.reads, [f.subscription.id, f.subscription.id])
      assert.equal(f.updates.length, 2)
    })
  }
}

test("legacy invoice events still resolve string and expanded subscription references", async t => {
  const f = await invoiceWebhookFixture(t)
  for (const reference of [f.subscription.id, { id: f.subscription.id }]) {
    assert.equal((await f.deliver("invoice.payment_succeeded", {
      id: "in_legacy", customer: "cus_gym", subscription: reference,
    })).status, 200)
  }
  assert.deepEqual(f.reads, [f.subscription.id, f.subscription.id])
  assert.equal(f.updates.length, 2)
  assert.ok(f.updates.every(update => update.paymentStatus === "paid"))
})

test("the current invoice parent takes precedence over a legacy subscription field", async t => {
  const f = await invoiceWebhookFixture(t)
  assert.equal((await f.deliver("invoice.payment_succeeded", {
    id: "in_gym", customer: "cus_gym", subscription: "sub_legacy",
    parent: { type: "subscription_details", subscription_details: { subscription: f.subscription.id } },
  })).status, 200)
  assert.deepEqual(f.reads, [f.subscription.id])
  assert.equal(f.updates.length, 1)
})

test("standalone and quote invoice events do not update subscription enrollments", async t => {
  const f = await invoiceWebhookFixture(t)
  for (const parent of [null, { type: "quote_details", quote_details: { quote: "qt_gym" } }]) {
    assert.equal((await f.deliver("invoice.payment_succeeded", { id: "in_standalone", customer: "cus_gym", parent })).status, 200)
  }
  assert.deepEqual(f.reads, [])
  assert.deepEqual(f.updates, [])
})

test("invoice enrollment update failures return 500 so Stripe can retry", async t => {
  const f = await invoiceWebhookFixture(t, { updateError: "Enrollment update failed" })
  const response = await f.deliver("invoice.payment_succeeded", {
    id: "in_gym", customer: "cus_gym",
    parent: { type: "subscription_details", subscription_details: { subscription: f.subscription.id } },
  })
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: "Enrollment update failed" })
  assert.deepEqual(f.reads, [f.subscription.id])
  assert.deepEqual(f.updates, [])
})
