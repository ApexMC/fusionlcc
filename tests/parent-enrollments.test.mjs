import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"
import { loadTypeScriptModule } from "./load-typescript.mjs"

const payments = await loadTypeScriptModule("../lib/account/parent-enrollments.ts")
const pagination = await loadTypeScriptModule("../lib/account/pagination.ts")
const localTime = await loadTypeScriptModule("../lib/local_time.ts")
const scheduling = await loadTypeScriptModule("../lib/scheduling.ts")

const classEnrollment = { status: "approved", payment_status: "unpaid" }
const paidCheer = {
  status: "active", payment_status: "paid", subscription_status: "active",
  tuition_subscription_id: "sub_tuition", fee_subscription_id: "sub_fee",
}

function athleteWithPayments(classStatuses, cheerStatuses) {
  return {
    enrollments: classStatuses.map((paymentStatus) => ({ paymentStatus })),
    cheerEnrollments: cheerStatuses.map((paymentStatus) => ({ paymentStatus })),
  }
}

test("classes waive payment only for their own athlete's current cheer enrollment", () => {
  assert.equal(payments.getEnrollmentPaymentStatus(classEnrollment, "class", true), "payment_not_required")
  assert.equal(payments.getEnrollmentPaymentStatus(classEnrollment, "class", false), "payment_failed")
  assert.equal(payments.getEnrollmentPaymentStatus(paidCheer, "cheer", true), "paid")
  assert.equal(payments.getEnrollmentPaymentStatus({ status: "approved" }, "class"), "ready_to_pay")
})

test("paid cheer covers classes without hiding a cheer payment problem", () => {
  assert.equal(payments.getParentPaymentStatus([athleteWithPayments(["payment_not_required"], ["paid"])]), "paid")
  assert.equal(payments.getParentPaymentStatus([athleteWithPayments(["payment_not_required"], ["payment_failed"])]), "payment_failed")
  assert.equal(payments.getParentPaymentStatus([athleteWithPayments(["payment_not_required"], ["ready_to_pay"])]), "ready_to_pay")
})

test("mixed households retain class payment requirements for siblings without cheer", () => {
  assert.equal(payments.getParentPaymentStatus([
    athleteWithPayments(["payment_not_required"], ["paid"]),
    athleteWithPayments(["ready_to_pay"], []),
  ]), "ready_to_pay")
  assert.equal(payments.getParentPaymentStatus([
    athleteWithPayments(["payment_not_required"], ["paid"]),
    athleteWithPayments(["payment_failed"], []),
  ]), "payment_failed")
})

test("cheer checkout requires both tuition and fee subscriptions", () => {
  assert.equal(payments.getEnrollmentPaymentStatus({ ...paidCheer, status: "approved", fee_subscription_id: null }, "cheer"), "ready_to_pay")
  assert.equal(payments.getEnrollmentPaymentStatus({ ...paidCheer, payment_status: "past_due" }, "cheer"), "payment_failed")
})

test("canceled and denied enrollments are excluded; current and pending enrollments remain", () => {
  for (const status of ["canceled", "cancelled", " DENIED "]) {
    assert.equal(payments.isCurrentParentEnrollment({ status }), false)
  }
  for (const status of ["pending", "approved", "active", null]) {
    assert.equal(payments.isCurrentParentEnrollment({ status }), true)
  }
  assert.equal(payments.getParentPaymentStatus([]), "no_enrollments")
})

// Execute the real route with fixture-backed database and session boundaries.
let moduleId = 0
async function loadParentsRoute(tables, { failTable, compatibilityFallback = false, authorized = true } = {}) {
  const calls = []
  const createAdminClient = () => ({
    from(table) {
      let selection
      return {
        select(value) { selection = value; return this },
        order() { return this },
        range(from, to) {
          calls.push({ table, selection, from, to })
          if (table === failTable) return Promise.resolve({ data: null, error: { code: "XX000", message: "Database unavailable" } })
          if (compatibilityFallback && table === "Enrollments" && selection.includes("ClassSchedules")) {
            return Promise.resolve({ data: null, error: { code: "PGRST200", message: "Relationship unavailable" } })
          }
          const rows = tables[table] ?? []
          // Simulate an API page cap smaller than the requested page size.
          return Promise.resolve({ data: structuredClone(rows.slice(from, Math.min(to + 1, from + 2))), error: null, count: rows.length })
        },
      }
    },
  })
  const dependencies = {
    "next/server": { NextResponse: { json: (data, options) => Response.json(data, options) } },
    "@/functions/shared_functions": { formatPhoneNumber: (phone) => phone },
    "@/lib/account/auth": {
      getAccountSession: async () => authorized ? { isOwner: true } : null,
      requireAdminSession: (session) => { if (!session?.isOwner) throw new Error("Unauthorized") },
    },
    "@/lib/account/pagination": pagination,
    "@/lib/account/parent-enrollments": payments,
    "@/lib/local_time": localTime,
    "@/lib/scheduling": scheduling,
    "@/lib/supabase/admin": { createAdminClient },
  }
  const source = await readFile(new URL("../app/api/parents/route.ts", import.meta.url), "utf8")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  })
  const globalKey = `__parentRouteTest${moduleId++}`
  globalThis[globalKey] = dependencies
  const isolatedSource = outputText.replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g,
    (_, names, specifier) => `const {${names}} = globalThis[${JSON.stringify(globalKey)}][${JSON.stringify(specifier)}];`)
  try {
    const route = await import(`data:text/javascript;base64,${Buffer.from(isolatedSource).toString("base64")}`)
    return { GET: route.GET, calls }
  } finally {
    delete globalThis[globalKey]
  }
}

function fixtures() {
  return {
    Parents: [{ parent_id: 1, last_name: "Parent" }, { parent_id: 2, last_name: "Other" }],
    Athletes: [
      { athlete_id: 10, parent_id: 1, first_name: "Both" },
      { athlete_id: 11, parent_id: 1, first_name: "Class only" },
      { athlete_id: 12, parent_id: 2, first_name: "Cheer only" },
    ],
    Enrollments: [
      { enrollment_id: 1, athlete_id: 10, class_id: 20, ...classEnrollment,
        ClassSchedules: [{ schedule_id: 30, class_id: 20, day_of_week: "monday", start_time: "16:00", end_time: "17:00",
          Classes: [{ class_id: 20, class_name: "Tumbling" }] }] },
      { enrollment_id: 2, athlete_id: 11, class_id: 20, status: "approved" },
      { enrollment_id: 3, athlete_id: 10, status: "canceled" },
    ],
    CheerEnrollments: [
      { enrollment_id: 1, athlete_id: 10, team_id: 40, schedule_id: 50, ...paidCheer },
      { enrollment_id: 2, athlete_id: 11, team_id: 40, status: "denied" },
      { enrollment_id: 3, athlete_id: 12, team_id: 40, status: "approved" },
    ],
    Classes: [{ class_id: 20, class_name: "Tumbling" }],
    CheerTeams: [{ team_id: 40, team_name: "Fusion Cheer" }],
    CheerSchedules: [{ schedule_id: 50, team_id: 40, day_of_week: "tuesday", start_time: "18:00", end_time: "19:30" }],
  }
}

test("parents API returns class and cheer details across all pages and keeps waivers athlete-specific", async () => {
  const { GET, calls } = await loadParentsRoute(fixtures())
  const response = await GET()
  assert.equal(response.status, 200)
  const parents = await response.json()
  const parent = parents.find((row) => row.parent_id === 1)
  const both = parent.athletes.find((athlete) => athlete.athleteId === "10")
  const sibling = parent.athletes.find((athlete) => athlete.athleteId === "11")
  assert.equal(both.enrollments.length, 1)
  assert.equal(both.enrollments[0].className, "Tumbling")
  assert.equal(both.enrollments[0].paymentStatus, "payment_not_required")
  assert.equal(both.cheerEnrollments[0].teamName, "Fusion Cheer")
  assert.equal(both.cheerEnrollments[0].scheduleLabel, "Tuesday 6:00 PM - 7:30 PM")
  assert.equal(both.cheerEnrollments[0].paymentStatus, "paid")
  assert.equal(sibling.cheerEnrollments.length, 0)
  assert.equal(sibling.enrollments[0].paymentStatus, "ready_to_pay")
  assert.equal(parent.stripe_payment_status, "ready_to_pay")
  const cheerOnly = parents.find((row) => row.parent_id === 2)
  assert.equal(cheerOnly.athletes.length, 1)
  assert.equal(cheerOnly.athletes[0].enrollments.length, 0)
  assert.equal(cheerOnly.athletes[0].cheerEnrollments.length, 1)
  assert.equal(cheerOnly.stripe_payment_status, "ready_to_pay")
  assert.ok(calls.some((call) => call.table === "CheerEnrollments" && call.from === 2))
})

test("class names and cheer enrollments survive a missing class schedule relationship", async () => {
  const { GET } = await loadParentsRoute(fixtures(), { compatibilityFallback: true })
  const response = await GET()
  assert.equal(response.status, 200)
  const parents = await response.json()
  assert.equal(parents.find((row) => row.parent_id === 1).athletes[0].enrollments[0].className, "Tumbling")
})

test("a failed cheer read returns an error instead of hiding cheer and charging classes", async () => {
  const { GET } = await loadParentsRoute(fixtures(), { failTable: "CheerEnrollments" })
  const response = await GET()
  assert.equal(response.status, 500)
  assert.equal((await response.json()).error, "Database unavailable")
})

test("unauthorized requests do not read parent data", async () => {
  const { GET, calls } = await loadParentsRoute(fixtures(), { authorized: false })
  assert.equal((await GET()).status, 403)
  assert.equal(calls.length, 0)
})
