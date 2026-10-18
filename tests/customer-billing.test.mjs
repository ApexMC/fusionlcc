import assert from "node:assert/strict"
import test from "node:test"
import { loadTypeScriptModule, loadTypeScriptModuleWithMocks as loadModule } from "./load-typescript.mjs"

const types = await loadTypeScriptModule("../lib/account/customer-billing-types.ts")
const pagination = await loadTypeScriptModule("../lib/account/pagination.ts")
const context = { userId: "user_family", customerIds: ["cus_family"], links: [
  { kind: "class", enrollmentId: "10", athleteName: "Jamie", subscriptionIds: ["sub_class"] },
  { kind: "cheer", enrollmentId: "20", athleteName: "Jamie", subscriptionIds: ["sub_tuition", "sub_fee"] },
] }

function sub(id, overrides = {}) {
  return { id, customer: "cus_family", metadata: {}, status: "active", currency: "usd",
    default_payment_method: null, default_source: null, schedule: null, cancel_at: null, cancel_at_period_end: false,
    ended_at: null, items: { data: [{ current_period_start: 1700000000, current_period_end: 1702600000,
      quantity: 1, price: { unit_amount: 5000, product: "prod_tuition", recurring: { interval: "month", interval_count: 1 } } }] },
    ...overrides }
}

function invoice(id = "in_owned", overrides = {}) {
  return { id, customer: "cus_family", status: "paid", number: "FUS-001", created: 1700000000,
    currency: "usd", subtotal: 6000, total: 5500, amount_paid: 5500, amount_remaining: 0, due_date: null,
    invoice_pdf: "https://example.com/invoice.pdf", hosted_invoice_url: "https://example.com/invoice",
    total_discount_amounts: [{ amount: 1000 }], total_taxes: [{ amount: 500 }], starting_balance: 0,
    pre_payment_credit_notes_amount: 0, post_payment_credit_notes_amount: 0, ...overrides }
}

function iterable(records) {
  return { async *[Symbol.asyncIterator]() { for (const record of records) yield record } }
}

function credit(id = "cbtxn_owned", overrides = {}) {
  return { id, customer: "cus_family", created: 1700000000, currency: "usd", type: "adjustment",
    amount: -5000, ending_balance: -5000, invoice: null, credit_note: null,
    description: "Internal staff note", metadata: { internal: "private" }, ...overrides }
}

async function fixture({ subscriptions = [sub("sub_class"), sub("sub_tuition"), sub("sub_fee")], defaultMethod = "pm_old", session,
  methodCustomer = "cus_family", database = {}, failUpdate, products = {}, customers = {},
  creditTransactions = [credit()], creditHasMore = false } = {}) {
  const updates = [], detached = [], queries = [], invoiceQueries = [], creditQueries = [], customerReads = [], setups = [], productReads = []
  let lineReads = 0
  const stripe = {
    subscriptions: {
      retrieve: async id => { const record = subscriptions.find(item => item.id === id); assert.ok(record, `Missing subscription ${id}`); return record },
      list: params => {
        for (const expansion of params.expand ?? []) {
          assert.ok(expansion.split(".").length <= 4, `Stripe expansion exceeds four levels: ${expansion}`)
        }
        return iterable(subscriptions.filter(record => record.customer === params.customer))
      },
      update: async (id, params) => { if (id === failUpdate) throw new Error("Stripe unavailable"); updates.push({ id, params }); Object.assign(subscriptions.find(item => item.id === id), params); return {} },
    },
    products: { retrieve: async id => { productReads.push(id); return products[id] ?? { id, name: "Tuition" } } },
    customers: {
      retrieve: async (id, params) => { customerReads.push({ id, params }); return { id, email: "family@example.com", balance: -5000, currency: "usd", invoice_settings: { default_payment_method: defaultMethod }, default_source: null, ...customers[id] } },
      listBalanceTransactions: async (id, params) => { creditQueries.push({ id, params }); return { data: creditTransactions.filter(transaction => transaction.customer === id), has_more: creditHasMore } },
      listPaymentMethods: () => iterable([{ id: "pm_old", card: { brand: "visa", last4: "4242", exp_month: 1, exp_year: 2030 } }, { id: "pm_new", card: { brand: "mastercard", last4: "4444", exp_month: 2, exp_year: 2030 } }]),
      update: async (id, params) => { updates.push({ id, params }); return {} },
    },
    paymentMethods: { retrieve: async id => ({ id, customer: methodCustomer }), detach: async id => { detached.push(id); return {} } },
    invoices: {
      list: async params => { invoiceQueries.push(params); return { data: [invoice()], has_more: true } },
      retrieve: async id => invoice(id, { customer: id === "in_foreign" ? "cus_foreign" : "cus_family" }),
      listLineItems: () => { lineReads++; return iterable(Array.from({ length: 105 }, (_, index) => ({ id: `il_${index}`, amount: 100, description: `Item ${index}`, quantity: 1, period: { start: 1700000000, end: 1702600000 } }))) },
    },
    setupIntents: { create: async params => { setups.push(params); return { client_secret: "seti_secret" } } },
  }
  const billing = await loadModule("../lib/account/customer-billing.ts", {
    "server-only": {}, "@/lib/account/customer-billing-types": types, "@/lib/account/pagination": pagination,
    "@/lib/account/auth": {
      getAccountSession: async () => session === undefined ? { userId: "user_family", isParent: true } : session,
      getParentForUser: async () => ({ parent_id: 1, stripe_customer_id: "cus_family" }),
    },
    "@/lib/stripe/server": { getStripe: () => stripe },
    "@/lib/supabase/admin": { createAdminClient: () => ({ from(table) {
      const filters = []; return {
        select() { return this }, order() { return this },
        eq(column, value) { filters.push([column, value]); return this },
        in(column, values) { filters.push([column, values]); return this },
        async range(from, to) {
          queries.push({ table, filters })
          const rows = (database[table] ?? []).filter(row => filters.every(([column, value]) => Array.isArray(value) ? value.includes(row[column]) : row[column] === value))
          return { data: rows.slice(from, to + 1), count: rows.length, error: null }
        },
      }
    } }) },
  })
  return { billing, stripe, updates, detached, queries, invoiceQueries, creditQueries, customerReads, setups, productReads, get lineReads() { return lineReads } }
}

test("subscription loading respects Stripe's expansion limit and resolves each distinct product once", async () => {
  const f = await fixture()
  const data = await f.billing.getCustomerBilling(context)
  assert.equal(data.subscriptions.length, 3)
  assert.ok(data.subscriptions.every(subscription => subscription.name === "Tuition"))
  assert.deepEqual(f.productReads, ["prod_tuition"])
})

test("expanded and deleted products keep usable subscription labels", async () => {
  const expanded = sub("sub_class")
  expanded.items.data[0].price.product = { id: "prod_expanded", name: "Beginner tumbling" }
  const deleted = sub("sub_old", { status: "canceled" })
  deleted.items.data[0].price.product = "prod_deleted"
  deleted.items.data[0].price.nickname = "Former tuition"
  const f = await fixture({ subscriptions: [expanded, deleted], products: { prod_deleted: { id: "prod_deleted", deleted: true } } })
  const data = await f.billing.getCustomerBilling(context)
  assert.equal(data.subscriptions[0].name, "Beginner tumbling")
  assert.equal(data.subscriptions[1].name, "Former tuition")
  assert.deepEqual(f.productReads, ["prod_deleted"])
})

test("billing ownership is built only from this family's athletes and linked enrollment records", async () => {
  const f = await fixture({ database: {
    Athletes: [{ athlete_id: 7, parent_id: 1, user_id: "user_family", first_name: "Jamie" },
      { athlete_id: 8, parent_id: null, user_id: "user_family", first_name: "Morgan" },
      { athlete_id: 9, parent_id: 99, user_id: "user_other", first_name: "Other" }],
    Enrollments: [{ enrollment_id: 10, athlete_id: 7, stripe_customer_id: "cus_legacy", stripe_subscription_id: "sub_class" },
      { enrollment_id: 11, athlete_id: 8, stripe_customer_id: null, stripe_subscription_id: null },
      { enrollment_id: 99, athlete_id: 9, stripe_customer_id: "cus_foreign", stripe_subscription_id: "sub_foreign" }],
    CheerEnrollments: [{ enrollment_id: 20, athlete_id: 7, parent_id: 1, stripe_customer_id: "cus_family", tuition_subscription_id: "sub_tuition", fee_subscription_id: "sub_fee" },
      { enrollment_id: 21, athlete_id: 7, parent_id: 99, stripe_customer_id: "cus_foreign", tuition_subscription_id: "sub_foreign" }],
  } })
  const owned = await f.billing.getCustomerBillingContext()
  assert.deepEqual(owned.customerIds, ["cus_family", "cus_legacy"])
  assert.deepEqual(owned.links.map(link => link.enrollmentId), ["10", "11", "20"])
  assert.equal(owned.links[0].athleteName, "Jamie")
})

test("signed out and non-parent sessions cannot load billing context", async () => {
  for (const session of [null, { userId: "staff", isParent: false }]) {
    const f = await fixture({ session })
    await assert.rejects(f.billing.getCustomerBillingContext(), /Sign in|Parent access/)
    assert.equal(f.queries.length, 0)
  }
})

test("class cancellation schedules the paid period end and can be undone", async () => {
  const f = await fixture()
  await f.billing.changeBillingSubscription(context, "sub_class", "cancel")
  assert.deepEqual(f.updates, [{ id: "sub_class", params: { cancel_at_period_end: true, proration_behavior: "none" } }])
  await f.billing.changeBillingSubscription(context, "sub_class", "keep")
  assert.equal(f.updates[1].params.cancel_at_period_end, false)
})

test("cheer cancellation and undo always update both tuition and fee subscriptions", async () => {
  const f = await fixture()
  await f.billing.changeBillingSubscription(context, "sub_fee", "cancel")
  assert.deepEqual(f.updates.map(item => item.id), ["sub_tuition", "sub_fee"])
  await f.billing.changeBillingSubscription(context, "sub_tuition", "keep")
  assert.equal(f.updates.length, 4)
  assert.ok(f.updates.slice(2).every(item => item.params.cancel_at_period_end === false))
})

test("foreign, ended, scheduled, and historical subscriptions cannot be mutated", async () => {
  for (const override of [{ customer: "cus_foreign" }, { status: "canceled" }, { schedule: "sched_external" }, { cancel_at: 1800000000 }]) {
    const f = await fixture({ subscriptions: [sub("sub_class", override)] })
    await assert.rejects(f.billing.changeBillingSubscription(context, "sub_class", "cancel"))
    assert.deepEqual(f.updates, [])
  }
  const f = await fixture({ subscriptions: [sub("sub_old", { metadata: { enrollment_id: "10" } })] })
  await assert.rejects(f.billing.changeBillingSubscription(context, "sub_old", "cancel"))
  assert.deepEqual(f.updates, [])
})

test("cheer preflight prevents a half cancellation and refuses to restart an ended pair", async () => {
  const f = await fixture({ subscriptions: [sub("sub_tuition"), sub("sub_fee", { customer: "cus_foreign" })] })
  await assert.rejects(f.billing.changeBillingSubscription(context, "sub_tuition", "cancel"))
  assert.deepEqual(f.updates, [])
  const ended = await fixture({ subscriptions: [sub("sub_tuition", { cancel_at_period_end: true }), sub("sub_fee", { status: "canceled" })] })
  await assert.rejects(ended.billing.changeBillingSubscription(context, "sub_tuition", "keep"), /already ended/)
  assert.deepEqual(ended.updates, [])
})

test("a partial cheer failure can be retried without updating the already scheduled member", async () => {
  const f = await fixture({ failUpdate: "sub_fee" })
  await assert.rejects(f.billing.changeBillingSubscription(context, "sub_tuition", "cancel"), /Stripe unavailable/)
  assert.deepEqual(f.updates.map(item => item.id), ["sub_tuition"])
  let retried
  f.stripe.subscriptions.update = async (id, params) => { retried = { id, params } }
  await f.billing.changeBillingSubscription(context, "sub_fee", "cancel")
  assert.equal(retried.id, "sub_fee")
})

test("changing default updates subscription overrides and then the customer", async () => {
  const f = await fixture({ subscriptions: [sub("sub_class", { default_payment_method: "pm_old" }), sub("sub_cancelled", { status: "canceled" })] })
  await f.billing.changeBillingPaymentMethod(context, "cus_family", "pm_new", "default")
  assert.deepEqual(f.updates, [{ id: "sub_class", params: { default_payment_method: "pm_new" } },
    { id: "cus_family", params: { invoice_settings: { default_payment_method: "pm_new" } } }])
})

test("foreign cards, defaults, and subscription overrides cannot be detached", async () => {
  const foreign = await fixture({ methodCustomer: "cus_foreign" })
  await assert.rejects(foreign.billing.changeBillingPaymentMethod(context, "cus_family", "pm_new", "default"), /does not belong/)
  assert.deepEqual(foreign.updates, [])
  const f = await fixture({ subscriptions: [sub("sub_class", { default_payment_method: "pm_new" })] })
  for (const id of ["pm_old", "pm_new"]) await assert.rejects(f.billing.changeBillingPaymentMethod(context, "cus_family", id, "remove"), /different default/)
  assert.deepEqual(f.detached, [])
  const unused = await fixture()
  await unused.billing.changeBillingPaymentMethod(context, "cus_family", "pm_new", "remove")
  assert.deepEqual(unused.detached, ["pm_new"])
})

test("no default and running subscriptions require choosing a default before detaching", async () => {
  const f = await fixture({ defaultMethod: null })
  await assert.rejects(f.billing.changeBillingPaymentMethod(context, "cus_family", "pm_new", "remove"), /Set a default/)
  assert.deepEqual(f.detached, [])
})

test("invoice detail authorizes the customer before fetching every line and totals", async () => {
  const f = await fixture()
  await assert.rejects(f.billing.getBillingInvoice(context, "in_foreign"), /does not belong/)
  assert.equal(f.lineReads, 0)
  const detail = await f.billing.getBillingInvoice(context, "in_owned")
  assert.equal(detail.lines.length, 105)
  assert.equal(detail.discount, 1000)
  assert.equal(detail.tax, 500)
  assert.equal(detail.paymentUrl, null)
})

test("invoice history is paginated only within an authorized billing account", async () => {
  const f = await fixture()
  await assert.rejects(f.billing.getBillingInvoicePage(context, "cus_foreign"), /does not belong/)
  await assert.rejects(f.billing.getBillingInvoicePage(context, "cus_family", "invalid"), /Invalid/)
  assert.deepEqual(f.invoiceQueries, [])
  const page = await f.billing.getBillingInvoicePage(context, "cus_family", "in_previous")
  assert.equal(page.nextCursor, "in_owned")
  assert.equal(f.invoiceQueries[0].starting_after, "in_previous")
})

test("credit history is paginated only within an authorized billing account", async () => {
  const f = await fixture({ creditHasMore: true })
  await assert.rejects(f.billing.getBillingCreditPage(context, "cus_foreign"), /does not belong/)
  await assert.rejects(f.billing.getBillingCreditPage(context, "cus_family", "in_previous"), /Invalid credit history cursor/)
  assert.deepEqual(f.creditQueries, [])
  const page = await f.billing.getBillingCreditPage(context, "cus_family", "cbtxn_previous")
  assert.equal(page.nextCursor, "cbtxn_owned")
  assert.deepEqual(f.creditQueries, [{ id: "cus_family", params: { limit: 12,
    expand: ["data.invoice", "data.credit_note"], starting_after: "cbtxn_previous" } }])
  const empty = await fixture({ creditTransactions: [] })
  assert.deepEqual(await empty.billing.getBillingCreditPage(context, "cus_family"), { customerId: "cus_family", transactions: [], nextCursor: null })
})

test("credit history keeps Stripe's ledger amounts and public references without exposing staff notes", async () => {
  const transactions = [credit("cbtxn_used", { type: "applied_to_invoice", amount: 2000, ending_balance: -3000,
    invoice: { id: "in_owned", number: "FUS-001", metadata: { private: true } } }),
    credit("cbtxn_note", { type: "credit_note", credit_note: { id: "cn_owned", number: "CN-001" }, invoice: "in_original" })]
  const f = await fixture({ creditTransactions: transactions })
  const page = await f.billing.getBillingCreditPage(context, "cus_family")
  assert.deepEqual(page.transactions[0], { id: "cbtxn_used", customerId: "cus_family", created: 1700000000,
    currency: "usd", type: "applied_to_invoice", amount: 2000, endingBalance: -3000,
    invoiceId: "in_owned", invoiceNumber: "FUS-001", creditNoteNumber: null })
  assert.equal(page.transactions[1].creditNoteNumber, "CN-001")
  assert.equal(page.transactions[1].invoiceId, "in_original")
  assert.equal(page.transactions[1].invoiceNumber, null)
  assert.doesNotMatch(JSON.stringify(page), /Internal staff note|metadata|description/)
})

test("current credit balances come from Stripe rather than a partial history page", async () => {
  const f = await fixture({ customers: { cus_family: { balance: -2500 } } })
  const data = await f.billing.getCustomerBilling(context)
  assert.deepEqual(data.customers[0].balances, [{ currency: "usd", amount: -2500 }])
  assert.equal(data.creditPages[0].transactions[0].endingBalance, -5000)
  assert.deepEqual(f.customerReads[0], { id: "cus_family", params: { expand: ["invoice_credit_balance"] } })
})

test("multi-currency credits and carried-forward debits keep their currency and ledger signs", async () => {
  const f = await fixture({ customers: { cus_family: { balance: -2500, invoice_credit_balance: { usd: 2500, eur: -1200, jpy: 500 } } } })
  const data = await f.billing.getCustomerBilling(context)
  assert.deepEqual(data.customers[0].balances, [{ currency: "usd", amount: -2500 }, { currency: "eur", amount: 1200 }, { currency: "jpy", amount: -500 }])
  const debit = await fixture({ customers: { cus_family: { balance: 1800 } } })
  assert.deepEqual((await debit.billing.getCustomerBilling(context)).customers[0].balances, [{ currency: "usd", amount: 1800 }])
})

test("credit histories remain separate for each owned billing account", async () => {
  const f = await fixture({ customers: { cus_legacy: { balance: 0, currency: "jpy" } },
    creditTransactions: [credit(), credit("cbtxn_legacy", { customer: "cus_legacy", currency: "jpy" })] })
  const data = await f.billing.getCustomerBilling({ ...context, customerIds: ["cus_family", "cus_legacy"] })
  assert.deepEqual(data.creditPages.map(page => [page.customerId, page.transactions.map(item => item.id)]),
    [["cus_family", ["cbtxn_owned"]], ["cus_legacy", ["cbtxn_legacy"]]])
  assert.deepEqual(data.customers[1].balances, [{ currency: "jpy", amount: 0 }])
})

test("history retains cancelled Stripe subscriptions even when local IDs were cleared", async () => {
  const f = await fixture({ subscriptions: [sub("sub_class"), sub("sub_old", { status: "canceled", metadata: { enrollment_id: "10" }, ended_at: 1700000000 })] })
  const data = await f.billing.getCustomerBilling(context)
  assert.equal(data.subscriptions.length, 2)
  assert.equal(data.subscriptions[1].athleteName, "Jamie")
  assert.equal(data.subscriptions[1].canManage, false)
  assert.equal(data.customers[0].methods[0].isDefault, true)
  assert.equal(data.customers[0].methods[0].inUse, true)
})

test("a family without a billing account loads empty billing data", async () => {
  const f = await fixture()
  const data = await f.billing.getCustomerBilling({ ...context, customerIds: [] })
  assert.deepEqual(data.customers, [])
  assert.deepEqual(data.subscriptions, [])
  assert.deepEqual(data.invoicePages, [])
  assert.deepEqual(data.creditPages, [])
})

test("currency formatting uses the correct minor unit", () => {
  assert.equal(types.formatBillingMoney(12345, "usd"), "$123.45")
  assert.equal(types.formatBillingMoney(12345, "jpy"), "¥12,345")
  assert.equal(types.formatBillingMoney(500, "isk"), "ISK 5")
  assert.equal(types.formatBillingMoney(500, "ugx"), "UGX 5")
})

test("card setup uses the existing publishable-key setting and never exposes a secret key", async t => {
  const savedPublic = process.env.STRIPE_PUBLISHABLE_KEY
  const savedAccount = process.env.STRIPE_CONNECTED_ACCOUNT_ID
  t.after(() => {
    if (savedPublic === undefined) delete process.env.STRIPE_PUBLISHABLE_KEY
    else process.env.STRIPE_PUBLISHABLE_KEY = savedPublic
    if (savedAccount === undefined) delete process.env.STRIPE_CONNECTED_ACCOUNT_ID
    else process.env.STRIPE_CONNECTED_ACCOUNT_ID = savedAccount
  })
  process.env.STRIPE_PUBLISHABLE_KEY = "pk_test_demo"
  process.env.STRIPE_CONNECTED_ACCOUNT_ID = " acct_gym "
  const f = await fixture()
  await assert.rejects(f.billing.createBillingSetupIntent(context, "cus_foreign"), /does not belong/)
  const result = await f.billing.createBillingSetupIntent(context, "cus_family")
  assert.equal(result.publishableKey, "pk_test_demo")
  assert.equal(result.stripeAccount, "acct_gym")
  assert.deepEqual(Object.keys(result).sort(), ["clientSecret", "publishableKey", "stripeAccount"])
  assert.deepEqual(f.setups[0].payment_method_types, ["card"])
  assert.equal(f.setups[0].usage, "off_session")
  assert.equal(f.setups[0].customer, "cus_family")
  delete process.env.STRIPE_CONNECTED_ACCOUNT_ID
  await assert.rejects(f.billing.createBillingSetupIntent(context, "cus_family"), /not configured/)
  process.env.STRIPE_CONNECTED_ACCOUNT_ID = "acct_gym"
  process.env.STRIPE_PUBLISHABLE_KEY = "sk_test_accident"
  await assert.rejects(f.billing.createBillingSetupIntent(context, "cus_family"), /not configured/)
  assert.equal(f.setups.length, 1)
})

test("billing API rejects cross-site writes and malformed action IDs before Stripe changes", async () => {
  const f = await fixture()
  const route = await loadModule("../app/api/account/billing/route.ts", {
    "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
    "@/lib/account/customer-billing": f.billing,
  })
  const foreign = await route.POST(new Request("https://fusion.test/api/account/billing", {
    method: "POST", headers: { origin: "https://other.test" }, body: JSON.stringify({ action: "cancel", subscriptionId: "sub_class" }),
  }))
  assert.equal(foreign.status, 403)
  const invalid = await route.POST(new Request("https://fusion.test/api/account/billing", {
    method: "POST", headers: { origin: "https://fusion.test" }, body: JSON.stringify({ action: "cancel", subscriptionId: 10 }),
  }))
  assert.equal(invalid.status, 400)
  assert.deepEqual(f.updates, [])
  const empty = await route.POST(new Request("https://fusion.test/api/account/billing", { method: "POST", body: "null" }))
  assert.equal(empty.status, 400)
})

test("billing API serves private credit history and rejects invalid or foreign accounts", async () => {
  const f = await fixture({ creditHasMore: true })
  const route = await loadModule("../app/api/account/billing/route.ts", {
    "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
    "@/lib/account/customer-billing": f.billing,
  })
  for (const [query, status] of [["history=credits", 400], ["history=credits&customerId=cus_foreign", 403],
    ["history=credits&customerId=cus_family&cursor=invalid", 400]]) {
    assert.equal((await route.GET(new Request(`https://fusion.test/api/account/billing?${query}`))).status, status)
  }
  assert.deepEqual(f.creditQueries, [])
  const response = await route.GET(new Request("https://fusion.test/api/account/billing?history=credits&customerId=cus_family&cursor=cbtxn_previous"))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("cache-control"), "private, no-store")
  assert.equal((await response.json()).transactions[0].id, "cbtxn_owned")
  assert.equal(f.invoiceQueries.length, 0)
})
