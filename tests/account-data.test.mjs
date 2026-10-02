import assert from "node:assert/strict"
import test from "node:test"
import { accountDataFixture, tables } from "./fixtures/account-data.mjs"

const classTables = ["Enrollments", "Classes", "ClassSchedules", "ScheduleSeasons"]
const cheerTables = ["CheerEnrollments", "CheerTeams", "CheerSchedules"]
const sessionTables = [...classTables, "ClassSessions", "ClassSessionAttendance", "CheerTeams", "CheerSchedules", "CheerSessions"]
const loaderCases = [
  ["getAdminBillingData", ["Classes", "CheerTeams"], ["classBilling", "cheerBilling"]],
  ["getAdminSchedulesData", [...classTables, ...cheerTables], ["classBilling", "cheerBilling", "scheduleSeasons", "classSchedules", "cheerSchedules"]],
  ["getAdminEnrollmentsData", [...classTables, ...cheerTables, "Parents", "Athletes"], ["allEnrollments", "cheerEnrollments", "enrollmentAthletes", "classSchedules", "cheerBilling"]],
  ["getAdminSessionsData", sessionTables, ["classSessions", "cheerSessions"]],
]

for (const [loader, allowedTables, fields] of loaderCases) {
  test(`${loader} preserves dashboard records while reading only its own tables`, async () => {
    const complete = await accountDataFixture()
    const expected = await complete.data.getAdminDashboardData()
    const focused = await accountDataFixture({ allowedTables })
    const actual = await focused.data[loader]()
    assert.deepEqual(actual, Object.fromEntries(fields.map(key => [key, expected[key]])))
    assert.deepEqual(new Set(focused.calls.map(call => call.table)), new Set(allowedTables))
  })
}

test("billing retains every class across pages and survives unrelated session failures", async () => {
  const { data, calls } = await accountDataFixture({
    failures: { ClassSessions: { code: "XX000", message: "Sessions unavailable" } },
  })
  const result = await data.getAdminBillingData()
  assert.deepEqual(result.classBilling.map(row => row.classId), ["1", "2", "3"])
  assert.equal(result.classBilling[0].stripePriceId, "price_gym")
  assert.equal(result.classBilling[0].billingDay, 15)
  assert.deepEqual(calls.filter(call => call.table === "Classes").map(call => call.from), [0, 2])
  assert.equal(calls.some(call => call.table === "ClassSessions"), false)
})

test("focused billing preserves schema fallbacks and reports real database errors", async () => {
  const compatible = await accountDataFixture({ missingBillingColumns: true })
  const result = await compatible.data.getAdminBillingData()
  assert.equal(result.classBilling.length, 3)
  assert.equal(result.classBilling[0].className, "Gym")
  assert.equal(result.classBilling[0].stripePriceId, null)
  const failed = await accountDataFixture({ failures: { Classes: { code: "XX000", message: "Classes unavailable" } } })
  await assert.rejects(failed.data.getAdminBillingData(), /Classes unavailable/)
  assert.equal(failed.calls.filter(call => call.table === "Classes").length, 1)
})

test("class session review preserves sorting, makeup attendance, and unassigned options without time-clock reads", async () => {
  const originalRows = structuredClone(tables)
  const { data } = await accountDataFixture({ allowedTables: [...classTables, "ClassSessions", "ClassSessionAttendance"] })
  const sessions = await data.getClassSessionReviewData()
  assert.deepEqual(sessions[0].expectedAthletes.map(row => row.enrollmentId), ["2", "1", "3"])
  assert.equal(sessions[0].expectedAthletes[1].attendanceStatus, "present")
  assert.equal(sessions[0].expectedAthletes[1].attendanceNotes, "Reviewed")
  assert.equal(sessions[0].expectedAthletes[2].isMakeup, true)
  assert.equal(sessions[0].expectedAthletes[2].attendanceStatus, "excused")
  assert.deepEqual(sessions[0].makeupAthleteOptions.map(row => row.enrollmentId), ["4"])
  assert.deepEqual(sessions[1].expectedAthletes.map(row => row.enrollmentId), ["3"])
  assert.equal(sessions[1].expectedAthletes[0].attendanceStatus, null)
  assert.deepEqual(tables, originalRows)
})

test("schedule and enrollment pages preserve cheer team rosters and family details", async () => {
  const { data } = await accountDataFixture()
  const schedules = await data.getAdminSchedulesData()
  assert.equal(schedules.classSchedules[0].enrollmentCount, 2)
  assert.deepEqual(schedules.classSchedules[0].athleteNames, ["Amy Athlete", "Zoe Athlete"])
  assert.equal(schedules.classSchedules[0].seasonIsActive, true)
  assert.equal(schedules.cheerSchedules[0].enrollmentCount, 2)
  const enrollments = await data.getAdminEnrollmentsData()
  assert.equal(enrollments.cheerEnrollments[0].parentName, "Pat Parent")
  assert.equal(enrollments.cheerEnrollments[0].athleteName, "Zoe Athlete")
  assert.equal(enrollments.cheerEnrollments[0].teamName, "Stars")
  assert.equal(enrollments.cheerEnrollments[1].scheduleLabel, schedules.cheerSchedules[0].scheduleLabel)
})

test("session review retains the missing-attendance-table fallback", async () => {
  const { data } = await accountDataFixture({ failures: { ClassSessionAttendance: { code: "42P01", message: "Missing attendance table" } } })
  const sessions = await data.getClassSessionReviewData()
  assert.equal(sessions[0].expectedAthletes.length, 2)
  assert.ok(sessions[0].expectedAthletes.every(row => row.attendanceStatus === null))
})

test("session rosters exclude athletes created later, including saved attendance and makeup choices", async () => {
  const tableData = structuredClone(tables)
  const createdDates = ["2026-10-06T17:00:00Z", "2026-10-04T17:00:00Z", "2026-10-06", "2026-10-06", null]
  tableData.Enrollments.forEach((enrollment, index) => {
    enrollment.Athletes.created_at = createdDates[index]
    // Enrollment creation must not replace the athlete's creation date.
    enrollment.created_at = "2026-10-08T17:00:00Z"
  })
  tableData.ClassSessions.push({ session_id: 102, schedule_id: 10, date: "2026-10-07" })
  const { data } = await accountDataFixture({ tableData })
  const sessions = await data.getClassSessionReviewData()
  assert.deepEqual(sessions[0].expectedAthletes.map(row => row.enrollmentId), ["2"])
  assert.deepEqual(sessions[0].makeupAthleteOptions, [])
  assert.deepEqual(sessions[1].expectedAthletes.map(row => row.enrollmentId), ["3"])
  assert.deepEqual(sessions[1].makeupAthleteOptions.map(row => row.enrollmentId), ["2", "4", "1"])
  assert.deepEqual(sessions[2].expectedAthletes.map(row => row.enrollmentId), ["2", "1"])
  assert.deepEqual(sessions[2].makeupAthleteOptions.map(row => row.enrollmentId), ["3", "4"])
  const adminSessions = await data.getAdminSessionsData()
  const dashboard = await data.getAdminDashboardData()
  assert.deepEqual(adminSessions.classSessions, sessions)
  assert.deepEqual(dashboard.classSessions, sessions)
  assert.equal(dashboard.classSchedules[0].enrollmentCount, 2)
})

const creationDateCases = [
  ["before the session", "2026-10-04T17:00:00Z", true],
  ["on the session date", "2026-10-05", true],
  ["late on the local session day, after UTC midnight", "2026-10-06T04:59:59Z", true],
  ["at the start of the following local day", "2026-10-06T05:00:00Z", false],
  ["with an explicit timezone offset", "2026-10-06T06:00:00+02:00", true],
  ["with an unknown creation date", null, true],
  ["with an invalid creation date", "invalid", true],
]

for (const [label, createdAt, expected] of creationDateCases) {
  test(`session eligibility: athlete created ${label}`, async () => {
    const tableData = structuredClone(tables)
    // Supabase relations can return either an object or an array.
    tableData.Enrollments[0].Athletes = [{ ...tableData.Enrollments[0].Athletes, created_at: createdAt }]
    const { data } = await accountDataFixture({ tableData })
    const sessions = await data.getClassSessionReviewData()
    assert.equal(sessions[0].expectedAthletes.some(row => row.enrollmentId === "1"), expected)
    assert.equal(sessions[0].makeupAthleteOptions.some(row => row.enrollmentId === "1"), false)
  })
}

test("undated sessions preserve the roster when a creation cutoff cannot be determined", async () => {
  const tableData = structuredClone(tables)
  tableData.Enrollments[0].Athletes.created_at = "2026-10-06T17:00:00Z"
  tableData.ClassSessions[0].date = null
  const { data } = await accountDataFixture({ tableData })
  const sessions = await data.getClassSessionReviewData()
  assert.deepEqual(sessions[0].expectedAthletes.map(row => row.enrollmentId), ["2", "1", "3"])
})

test("athlete creation dates are selected and retained when billing columns require a fallback", async () => {
  const tableData = structuredClone(tables)
  tableData.Enrollments[0].Athletes.created_at = "2026-10-06T17:00:00Z"
  const { data, calls } = await accountDataFixture({ tableData, missingBillingColumns: true })
  const sessions = await data.getClassSessionReviewData()
  assert.deepEqual(sessions[0].expectedAthletes.map(row => row.enrollmentId), ["2", "3"])
  const enrollmentCalls = calls.filter(call => call.table === "Enrollments")
  assert.ok(enrollmentCalls.some(call => call.selection.includes("stripe_subscription_id")))
  assert.ok(enrollmentCalls.some(call => !call.selection.includes("stripe_subscription_id")))
  assert.ok(enrollmentCalls.every(call => /Athletes\(\s*athlete_id,\s*created_at,/.test(call.selection)))
})
