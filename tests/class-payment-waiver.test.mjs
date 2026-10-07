import assert from "node:assert/strict"
import test from "node:test"
import { accountDataFixture, tables } from "./fixtures/account-data.mjs"
import { loadTypeScriptModule, loadTypeScriptModuleWithMocks as loadModule } from "./load-typescript.mjs"

const parentPayments = await loadTypeScriptModule("../lib/account/parent-enrollments.ts")
const pagination = await loadTypeScriptModule("../lib/account/pagination.ts")
const programs = await loadTypeScriptModule("../lib/programs.ts")
const enrollmentRules = await loadTypeScriptModule("../lib/enrollments.ts")
const localTime = await loadTypeScriptModule("../lib/local_time.ts")
const ui = names => Object.fromEntries(names.map(name => [name, name]))
const jsx = (type, props) => ({ type, props })
const { ParentEnrollments } = await loadModule("../components/account/parent_enrollments.tsx", {
  react: { useState: initial => [initial, () => {}] },
  "react/jsx-runtime": { jsx, jsxs: jsx },
  "lucide-react": ui(["AlertTriangle", "CalendarClock", "CreditCard", "Eye", "FileSignature", "Settings", "X"]),
  "next/navigation": { useRouter: () => ({ refresh() {} }) },
  "@/app/actions/enrollments": { cancelEnrollmentRequest() {}, selectEnrollmentScheduleSlot() {} },
  "@/components/account/cheer_contract_dialog": ui(["CheerContractDialog"]),
  "@/components/account/enrollment_status_badge": ui(["EnrollmentStatusBadge"]),
  "@/components/ui/badge": ui(["Badge"]),
  "@/components/ui/button": ui(["Button"]),
  "@/components/ui/card": ui(["Card", "CardContent", "CardHeader", "CardTitle"]),
  "@/components/ui/dialog": ui(["Dialog", "DialogContent", "DialogDescription", "DialogHeader", "DialogTitle"]),
  "@/components/ui/toast": { useToast: () => ({ toast() {} }) },
  "@/components/ui/smart-select": ui(["SmartSelect"]),
  "@/lib/account/parent-enrollments": parentPayments,
})

function findAll(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => findAll(child, predicate))
  if (!node || typeof node !== "object") return []
  return [...(predicate(node) ? [node] : []), ...findAll(node.props?.children, predicate)]
}

function payButtons(section) {
  return findAll(section, node => node.type === "Button" && [node.props.children].flat(Infinity).includes("Pay"))
}

function badges(section) {
  return findAll(section, node => node.type === "EnrollmentStatusBadge").map(node => node.props.status)
}

function billingTables(cheerStatus, subscriptionStatus = null) {
  const tableData = structuredClone(tables)
  for (const athlete of tableData.Athletes) athlete.user_id = "parent-fixture"
  for (const enrollment of tableData.Enrollments) {
    enrollment.status = "approved"
    enrollment.payment_status = "unpaid"
  }
  tableData.CheerEnrollments = cheerStatus === undefined ? [] : [{
    ...tableData.CheerEnrollments[0], status: cheerStatus,
    subscription_status: subscriptionStatus, payment_status: "payment_failed",
    contract_signed: true,
  }]
  return tableData
}

test("the real parent loader and dashboard waive classes for approved or active cheer regardless of Stripe status", async () => {
  for (const status of ["approved", "active"]) {
    for (const subscriptionStatus of [null, "active", "trialing", "incomplete", "past_due", "canceled"]) {
      const tableData = billingTables(status, subscriptionStatus)
      // Class Stripe problems also must not override the cheer waiver.
      tableData.Enrollments[0].subscription_status = subscriptionStatus
      tableData.Enrollments[0].stripe_subscription_id = subscriptionStatus ? "sub_class" : null
      const { data } = await accountDataFixture({ tableData })
      const dashboard = await data.getParentAthleteEnrollments("parent-fixture")
      assert.equal(dashboard.athletes[0].enrollments[0].paymentStatus, "payment_not_required")
      assert.equal(dashboard.athletes[0].cheerEnrollments[0].paymentStatus, "payment_failed")
      assert.equal(dashboard.athletes[1].enrollments[0].paymentStatus, "unpaid")
      const tree = ParentEnrollments(dashboard)
      const sections = findAll(tree, node => node.type === "section" && node.props["aria-labelledby"]?.endsWith("-classes-heading"))
      assert.equal(payButtons(sections[0]).length, 0, `${status}/${subscriptionStatus}`)
      assert.ok(badges(sections[0]).includes("payment_not_required"))
      assert.ok(!badges(sections[0]).includes("ready_to_pay"))
      assert.equal(payButtons(sections[1]).length, 1, "a sibling without eligible cheer still pays for classes")
      const cheerSection = findAll(tree, node => node.props?.["aria-labelledby"] === "1-cheer-heading")[0]
      assert.equal(payButtons(cheerSection).length, status === "approved" ? 1 : 0, "cheer checkout remains available")
    }
  }
})

test("pending, ended, inactive, or missing cheer enrollments do not waive class checkout in the dashboard", async () => {
  for (const status of ["pending", "denied", "canceled", "cancelled", "inactive", null, undefined]) {
    const { data } = await accountDataFixture({ tableData: billingTables(status, "active") })
    const dashboard = await data.getParentAthleteEnrollments("parent-fixture")
    const tree = ParentEnrollments(dashboard)
    const section = findAll(tree, node => node.props?.["aria-labelledby"] === "1-classes-heading")[0]
    assert.equal(dashboard.athletes[0].enrollments[0].paymentStatus, "unpaid")
    assert.equal(payButtons(section).length, 1, String(status))
    assert.ok(badges(section).includes("ready_to_pay"))
    assert.ok(!badges(section).includes("payment_not_required"))
  }
})

test("a failed cheer read prevents loading class payment options", async () => {
  const { data } = await accountDataFixture({
    tableData: billingTables("approved"),
    failures: { CheerEnrollments: { message: "Cheer unavailable" } },
  })
  await assert.rejects(data.getParentAthleteEnrollments("parent-fixture"), /Cheer unavailable/)
})

// Run the actual payment context, checkout handler, and approval action with
// database and Stripe boundaries replaced; no external billing or emails occur.
async function billingFixture({ cheerStatus = "approved", subscriptionStatus = null, cheerAthleteId = 1, cheerError } = {}) {
  const tableData = billingTables(cheerStatus, subscriptionStatus)
  tableData.CheerEnrollments[0].athlete_id = cheerAthleteId
  const enrollment = tableData.Enrollments[0]
  enrollment.Athletes.user_id = "parent-fixture"
  enrollment.Athletes.Parents.user_id = "parent-fixture"
  const mutations = []
  const sessions = []
  const emails = []
  let stripeAccesses = 0
  const createAdminClient = () => ({ from(table) {
    const filters = []
    let update
    let rowLimit = Infinity
    const read = () => {
      if (table === "CheerEnrollments" && cheerError) return { data: null, error: { message: cheerError } }
      const rows = (tableData[table] ?? []).filter(row => filters.every(filter => filter(row))).slice(0, rowLimit)
      if (update) {
        mutations.push({ table, update })
        for (const row of rows) Object.assign(row, update)
      }
      return { data: structuredClone(rows), error: null, count: rows.length }
    }
    return {
      select() { return this },
      eq(key, value) { filters.push(row => String(row[key]) === String(value)); return this },
      in(key, values) { filters.push(row => values.includes(row[key])); return this },
      limit(value) { rowLimit = value; return this },
      update(value) { update = value; return this },
      then(resolve, reject) { return Promise.resolve(read()).then(resolve, reject) },
      async maybeSingle() { const result = read(); return { ...result, data: result.data?.[0] ?? null } },
    }
  } })
  const session = { userId: "parent-fixture", roles: ["owner"] }
  const auth = { getAccountSession: async () => session, getParentForUser: async () => tableData.Parents[0], requireAdminSession: value => value }
  const payments = await loadModule("../lib/account/payments.ts", {
    "server-only": {}, stripe: {},
    "@/lib/programs": programs,
    "@/lib/account/auth": auth,
    "@/lib/account/data": { resolveBillingDay: record => record.billing_day },
    "@/lib/account/parent-enrollments": parentPayments,
    "@/lib/account/pagination": pagination,
    "@/lib/supabase/admin": { createAdminClient },
    "@/lib/stripe/server": {},
  })
  const { POST } = await loadModule("../app/api/enrollments/[enrollmentId]/checkout/route.ts", {
    "next/headers": { headers: async () => new Map([["origin", "https://fixture.example.test"]]) },
    "next/server": { NextResponse: { json: (value, options) => Response.json(value, options) } },
    "@/lib/account/payments": payments,
    "@/lib/account/checkout-confirmation": await loadModule("../lib/account/checkout-confirmation.ts", {
      "server-only": {},
      "@/lib/account/payments": payments,
      "@/lib/account/cheer-payments": {},
      "@/lib/stripe/server": {},
    }),
    "@/lib/stripe/server": {
      getNextBillingAnchorUnix: () => 1792022400,
      getStripe: () => {
        stripeAccesses++
        return {
          customers: { create: async () => ({ id: "cus_fixture" }) },
          checkout: { sessions: { create: async value => { sessions.push(value); return { url: "https://fixture.example.test/checkout" } } } },
        }
      },
    },
  })
  const actions = await loadModule("../app/actions/enrollments.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/account/auth": auth,
    "@/lib/account/parent-enrollments": parentPayments,
    "@/lib/contact/email": { sendContactEmail: async value => { emails.push(value) } },
    "@/lib/enrollments": enrollmentRules,
    "@/lib/local_time": localTime,
    "@/lib/supabase/admin": { createAdminClient },
    "@/lib/stripe/server": { getStripe() { throw new Error("Unexpected Stripe request") } },
  })
  return {
    enrollment, mutations, sessions, emails, actions,
    stripeAccesses: () => stripeAccesses,
    checkout: () => POST(new Request("https://fixture.example.test"), { params: Promise.resolve({ enrollmentId: "1" }) }),
  }
}

test("class checkout rejects approved or active cheer before any Stripe or database mutation", async () => {
  for (const cheerStatus of ["approved", "active"]) {
    for (const subscriptionStatus of [null, "active", "incomplete", "past_due", "canceled"]) {
      const fixture = await billingFixture({ cheerStatus, subscriptionStatus })
      const response = await fixture.checkout()
      assert.equal(response.status, 400)
      assert.match((await response.json()).error, /Payment is not required/)
      assert.equal(fixture.stripeAccesses(), 0)
      assert.deepEqual(fixture.mutations, [])
    }
  }
})

test("class checkout remains available for ineligible cheer and siblings without cheer", async () => {
  for (const options of [
    ...["pending", "denied", "canceled", "cancelled", "inactive", null].map(cheerStatus => ({ cheerStatus, subscriptionStatus: "active" })),
    { cheerStatus: "active", cheerAthleteId: 2 },
  ]) {
    const fixture = await billingFixture(options)
    const response = await fixture.checkout()
    assert.equal(response.status, 200, JSON.stringify(options))
    assert.equal(fixture.sessions.length, 1)
    assert.equal(fixture.sessions[0].mode, "subscription")
    assert.deepEqual(fixture.sessions[0].line_items, [{ price: "price_gym", quantity: 1 }])
    assert.equal(fixture.sessions[0].success_url,
      "https://fixture.example.test/account/checkout-confirmation?kind=class&enrollment=1&session_id={CHECKOUT_SESSION_ID}")
  }
})

test("class checkout fails closed when cheer eligibility cannot be read", async () => {
  const fixture = await billingFixture({ cheerError: "Cheer unavailable" })
  const response = await fixture.checkout()
  assert.equal(response.status, 400)
  assert.match((await response.json()).error, /Unable to determine whether class payment is required/)
  assert.equal(fixture.stripeAccesses(), 0)
  assert.deepEqual(fixture.mutations, [])
})

test("class approval grants waivers only for the same athlete's approved or active cheer enrollment", async () => {
  for (const options of [
    ...["approved", "active", "pending", "denied", "canceled", "inactive"].map(cheerStatus => ({ cheerStatus, subscriptionStatus: "past_due" })),
    { cheerStatus: "active", cheerAthleteId: 2 },
  ]) {
    const fixture = await billingFixture(options)
    fixture.enrollment.status = "pending"
    const result = await fixture.actions.updateEnrollmentAdminStatus({ enrollmentId: "1", status: "approved" })
    const waived = options.cheerAthleteId !== 2 && ["approved", "active"].includes(options.cheerStatus)
    assert.equal(result.ok, true)
    assert.equal(fixture.enrollment.status, waived ? "active" : "approved", JSON.stringify(options))
    assert.equal(fixture.enrollment.payment_status, waived ? "not required" : "unpaid")
    assert.equal(fixture.emails.length, 1)
    assert.equal(fixture.emails[0].message.includes("No payment is required"), waived)
  }
})
