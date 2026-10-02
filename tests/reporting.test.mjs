import assert from "node:assert/strict"
import test from "node:test"
import { loadTypeScriptModule } from "./load-typescript.mjs"

const {
  buildCheerScheduleRosterCounts,
  buildRecurringRevenueMetric,
  buildSubscriptionAuditRecords,
  escapeCsvValue,
  getCoverageState,
  hasBillingData,
  serializeCsv,
} = await loadTypeScriptModule("../lib/account/reporting.ts")
const { buildReportingExports } = await loadTypeScriptModule("../lib/account/reporting_exports.ts")

const coverageCases = [
  ["active class", "active", ["sub_class"], true, "subscribed"],
  ["trialing cheer", " TRIALING ", ["sub_tuition", "sub_fee"], true, "subscribed"],
  ["missing cheer fee", "active", ["sub_tuition", null], true, "attention"],
  ["missing class ID", "active", [null], true, "attention"],
  ["canceled with retained IDs", "canceled", ["sub_old"], true, "not-subscribed"],
  ["expired checkout", "incomplete_expired", ["sub_old"], true, "not-subscribed"],
  ["past due", "past_due", ["sub_class"], true, "attention"],
  ["no checkout", null, [null], true, "not-subscribed"],
  ["billing columns unavailable", null, [null], false, "unknown"],
  ["ID without a status", null, ["sub_class"], true, "unknown"],
  ["unrecognized status", "unexpected", ["sub_class"], true, "unknown"],
]

for (const [label, subscriptionStatus, subscriptionIds, billingDataAvailable, expected] of coverageCases) {
  test(`coverage: ${label}`, () => {
    assert.equal(getCoverageState({ subscriptionStatus, subscriptionIds, billingDataAvailable }), expected)
  })
}

const paymentCoverageCases = [
  ["payment exemption", "payment_not_required", null, [null], true, "payment-not-required"],
  ["legacy payment exemption", " NO_PAYMENT_REQUIRED ", "inactive", [null], true, "payment-not-required"],
  ["known exemption without billing columns", "payment_not_required", null, [null], false, "payment-not-required"],
  ["failed payment on an active subscription", "payment_failed", "active", ["sub_class"], true, "attention"],
  ["past-due payment on a trial", "past_due", "trialing", ["sub_class"], true, "attention"],
  ["unpaid checkout", "unpaid", null, [null], true, "attention"],
  ["paid active subscription", "paid", "active", ["sub_class"], true, "subscribed"],
  ["paid checkout missing a cheer fee", "paid", "active", ["sub_tuition", null], true, "attention"],
  ["paid enrollment missing a subscription", "paid", null, [null], true, "not-subscribed"],
  ["billing still unavailable", "payment_failed", "active", ["sub_class"], false, "unknown"],
]

for (const [label, paymentStatus, subscriptionStatus, subscriptionIds, billingDataAvailable, expected] of paymentCoverageCases) {
  test(`coverage: ${label}`, () => {
    assert.equal(getCoverageState({ paymentStatus, subscriptionStatus, subscriptionIds, billingDataAvailable }), expected)
  })
}

test("known empty billing fields differ from fields missing from a fallback query", () => {
  const fields = ["stripe_subscription_id", "subscription_status", "payment_status"]
  assert.equal(hasBillingData({ enrollment_id: 1 }, fields), false)
  assert.equal(hasBillingData({
    stripe_subscription_id: null, subscription_status: null, payment_status: null,
  }, fields), true)
})

test("the CSV preserves negative balances and protects textual formulas", () => {
  assert.equal(escapeCsvValue(-25.5), "-25.5")
  assert.equal(escapeCsvValue(0), "0")
  assert.equal(escapeCsvValue("=1+1"), "'=1+1")
  assert.equal(escapeCsvValue("-25.5"), "'-25.5")
  assert.equal(escapeCsvValue("  @SUM(A1)"), "'  @SUM(A1)")
  assert.equal(escapeCsvValue('Smith, "Alex"'), '"Smith, ""Alex"""')
  assert.equal(escapeCsvValue("first\nsecond"), '"first\nsecond"')
  assert.equal(escapeCsvValue(null), "")
  assert.equal(escapeCsvValue(Number.NaN), "")
})

test("CSV headers preserve fields from all combined row types", () => {
  assert.equal(serializeCsv([
    { Name: "First", Balance: -25.5 },
    { Name: "Second", Subscription: "sub_2" },
  ]), "Name,Balance,Subscription\r\nFirst,-25.5,\r\nSecond,,sub_2")
})

test("unavailable revenue differs from a verified zero", () => {
  const unavailable = buildRecurringRevenueMetric(null)
  const zero = buildRecurringRevenueMetric(0)
  const positive = buildRecurringRevenueMetric(12345)
  assert.equal(unavailable.value, "Unavailable")
  assert.equal(unavailable.amountCents, null)
  assert.equal(unavailable.available, false)
  assert.equal(zero.value, "0")
  assert.equal(zero.available, true)
  assert.equal(zero.amountCents, 0)
  assert.equal(positive.value, "123.45")
})

test("cheer rosters combine team practices and explicit schedules without duplicate athletes", () => {
  const counts = buildCheerScheduleRosterCounts([
    { enrollment_id: 1, athlete_id: 10, team_id: 1, schedule_id: null, status: "active" },
    { enrollment_id: 2, athlete_id: 10, team_id: 1, schedule_id: 100, status: "approved" },
    { enrollment_id: 3, athlete_id: 11, team_id: 1, schedule_id: 100, status: "active" },
    { enrollment_id: 4, athlete_id: 12, team_id: 1, schedule_id: null, status: "denied" },
    { enrollment_id: 5, athlete_id: 13, team_id: 2, schedule_id: null, status: "active" },
    { enrollment_id: 6, athlete_id: 14, team_id: 1, schedule_id: null, status: "pending" },
  ], [
    { schedule_id: 100, team_id: 1 },
    { schedule_id: 101, team_id: 1 },
    { schedule_id: 200, team_id: 2 },
    { schedule_id: 300, team_id: 3 },
  ])
  assert.equal(counts.get("100"), 2)
  assert.equal(counts.get("101"), 1)
  assert.equal(counts.get("200"), 1)
  assert.equal(counts.get("300"), 0)
})

test("subscription audits retain availability and unique keys across class and cheer IDs", () => {
  const rows = buildSubscriptionAuditRecords({
    allEnrollments: [{ enrollmentId: "1", billingDataAvailable: false }],
    cheerEnrollments: [{
      enrollmentId: "1", billingDataAvailable: true,
      subscriptionStatus: "active", tuitionSubscriptionId: "sub_tuition", feeSubscriptionId: null,
    }],
  })
  assert.equal(rows[0].coverageState, "unknown")
  assert.equal(rows[0].exportRow["Billing data available"], false)
  assert.equal(rows[1].coverageState, "attention")
  assert.notEqual(rows[0].key, rows[1].key)
})

test("subscription audit waivers match current cheer athletes without covering siblings or historical classes", () => {
  const classEnrollment = {
    status: "approved", billingDataAvailable: true,
    subscriptionStatus: null, stripeSubscriptionId: null, paymentStatus: "unpaid",
  }
  const cheerEnrollment = {
    status: "active", billingDataAvailable: true, paymentStatus: "payment_failed",
    subscriptionStatus: "active", tuitionSubscriptionId: "sub_tuition", feeSubscriptionId: "sub_fee",
  }
  const records = buildSubscriptionAuditRecords({
    allEnrollments: [
      { ...classEnrollment, enrollmentId: "1", athleteId: "cheer-athlete", billingDataAvailable: false },
      { ...classEnrollment, enrollmentId: "2", athleteId: "sibling" },
      { ...classEnrollment, enrollmentId: "3", athleteId: "former-cheer" },
      { ...classEnrollment, enrollmentId: "4", athleteId: "cheer-athlete", status: "canceled", paymentStatus: null },
      { ...classEnrollment, enrollmentId: "5", athleteId: null },
      { ...classEnrollment, enrollmentId: "6", athleteId: "pending-cheer" },
    ],
    cheerEnrollments: [
      { ...cheerEnrollment, enrollmentId: "1", athleteId: "cheer-athlete" },
      { ...cheerEnrollment, enrollmentId: "2", athleteId: "sibling", status: "denied" },
      { ...cheerEnrollment, enrollmentId: "3", athleteId: "former-cheer", status: " CANCELLED " },
      { ...cheerEnrollment, enrollmentId: "4", athleteId: null },
      { ...cheerEnrollment, enrollmentId: "5", athleteId: "pending-cheer", status: "pending" },
    ],
  })
  const byKey = new Map(records.map(record => [record.key, record]))
  const waived = byKey.get("class:1")
  assert.equal(waived.coverageState, "payment-not-required")
  assert.equal(waived.exportRow["Coverage state"], "Payment not required")
  assert.equal(waived.exportRow["Payment status"], "payment_not_required")
  assert.equal(waived.exportRow["Billing data available"], false)
  for (const key of ["class:2", "class:3", "class:5", "cheer:1"]) {
    assert.equal(byKey.get(key).coverageState, "attention", key)
  }
  assert.equal(byKey.get("class:4").coverageState, "not-subscribed")
  assert.equal(byKey.get("class:6").coverageState, "payment-not-required")
})

test("financial and schedule exports retain corrected values; failed time reads are marked unavailable", () => {
  const reports = buildReportingExports({
    allEnrollments: [], cheerEnrollments: [],
    reportingParents: [{ parentId: "1", parentName: "Parent", balance: -25.5 }],
    reportingAthletes: [], classBilling: [], cheerBilling: [],
    classSchedules: [], cheerSchedules: [{ scheduleId: "100", enrollmentCount: 2 }],
    classSessions: [], cheerSessions: [],
    timeClockReview: { coaches: [], tableReady: false },
  }, [])
  const balances = reports.find((report) => report.filename === "parent-balances.csv")
  const schedules = reports.find((report) => report.filename === "program-schedules.csv")
  const timeClock = reports.find((report) => report.filename === "staff-time-clock.csv")
  assert.equal(balances.rows[0].Balance, -25.5)
  assert.ok(serializeCsv(balances.rows).includes("-25.5"))
  assert.equal(schedules.rows[0].Enrollments, 2)
  assert.equal(timeClock.unavailableReason, "Staff time data is unavailable.")
})
