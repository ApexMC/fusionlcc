import assert from "node:assert/strict"
import test from "node:test"
import { accountDataFixture, tables } from "./fixtures/account-data.mjs"

function familyTables() {
  const rows = structuredClone(tables)
  rows.Athletes.forEach((athlete, index) => {
    athlete.user_id = index < 2 ? "parent" : "another-parent"
  })
  rows.DeadPeriods = [{ period_id: 1, starts_at: "2026-10-12T00:00:00", ends_at: "2026-10-16T00:00:00" }]
  rows.ClassSessions[0].starts_at = "16:00:00"
  rows.ClassSessions[0].ends_at = "17:00:00"
  return rows
}

test("the personal calendar includes only the parent's athletes and selected classes", async () => {
  const { data } = await accountDataFixture({ tableData: familyTables() })
  const result = await data.getParentDashboardData("parent", "2026-10-17")
  assert.deepEqual(result.athletes.map(row => row.athleteId), ["1", "2"])
  assert.deepEqual(result.calendar.sessions.map(row => row.sessionId), ["class:100", "cheer:200"])
  assert.deepEqual(result.calendar.sessions.map(row => row.athleteNames), [
    ["Amy Athlete", "Zoe Athlete"], ["Amy Athlete", "Zoe Athlete"],
  ])
  assert.equal(result.calendar.sessions[0].timeLabel, "4:00 PM - 5:00 PM")
  assert.equal(result.calendar.sessions[1].timeLabel, "6:00 PM - 7:00 PM")
  assert.deepEqual(result.calendar.deadPeriods, [{ periodId: "1", startsAt: "2026-10-12", endsAt: "2026-10-16" }])
  assert.ok(result.calendar.sessions.every(row => !JSON.stringify(row).includes("Bea Athlete")))
})

test("personal classes reuse assigned makeup rosters and retain canceled and replacement sessions", async () => {
  const rows = familyTables()
  rows.ClassSessions[0].status = "canceled"
  rows.ClassSessions.push({ ...rows.ClassSessions[0], session_id: 102, date: "2026-10-08", status: "scheduled", type: "makeup" })
  // A sibling attends a session for a different slot only when explicitly assigned.
  rows.ClassSessionAttendance.push({ attendance_id: 3, session_id: 101, enrollment_id: 1, is_makeup: true })
  const { data } = await accountDataFixture({ tableData: rows })
  const { calendar } = await data.getParentDashboardData("parent", "2026-10-17")
  assert.deepEqual(calendar.sessions.map(row => row.sessionId), ["class:100", "class:101", "cheer:200", "class:102"])
  assert.equal(calendar.sessions[0].status, "canceled")
  assert.equal(calendar.sessions.at(-1).type, "makeup")
  assert.deepEqual(calendar.sessions[1].athleteNames, ["Zoe Athlete"])
})

test("cheer team enrollments attend all practices while selected slots stay scoped", async () => {
  const rows = familyTables()
  rows.CheerSchedules.push({ ...rows.CheerSchedules[0], schedule_id: 21 })
  rows.CheerSessions.push(
    { session_id: 201, schedule_id: 21, date: "2026-10-08", type: "makeup" },
    { session_id: 202, team_id: 2, date: "2026-10-09", type: "makeup" },
    { session_id: 203, team_id: 99, date: "2026-10-10" },
  )
  const { data } = await accountDataFixture({ tableData: rows })
  const { calendar } = await data.getParentDashboardData("parent", "2026-10-17")
  const cheer = calendar.sessions.filter(row => row.classId.startsWith("cheer:"))
  assert.deepEqual(cheer.map(row => row.sessionId), ["cheer:200", "cheer:201", "cheer:202"])
  assert.deepEqual(cheer.map(row => row.athleteNames), [
    ["Amy Athlete", "Zoe Athlete"], ["Zoe Athlete"], ["Amy Athlete", "Zoe Athlete"],
  ])
})

test("the personal schedule excludes pending, ended, and unresolved enrollments regardless of billing", async () => {
  for (const status of ["pending", "denied", "canceled", "cancelled", "inactive"]) {
    const rows = familyTables()
    rows.Enrollments.forEach(row => { row.status = status; row.subscription_status = "active" })
    rows.CheerEnrollments.forEach(row => { row.status = status; row.subscription_status = "active" })
    const { data, calls } = await accountDataFixture({ tableData: rows })
    const { calendar } = await data.getParentDashboardData("parent", "2026-10-17")
    assert.deepEqual(calendar.sessions, [], status)
    assert.ok(!calls.some(call => ["ClassSessions", "CheerSessions", "ClassSessionAttendance"].includes(call.table)))
  }
  const rows = familyTables()
  rows.Enrollments.forEach(row => { row.selection_required = true })
  rows.CheerEnrollments.forEach(row => { row.selection_required = true })
  const { data } = await accountDataFixture({ tableData: rows })
  assert.deepEqual((await data.getParentDashboardData("parent", "2026-10-17")).calendar.sessions, [])
})

test("the calendar date window includes both bounds, crosses years, and preserves pagination", async () => {
  const rows = familyTables()
  rows.ClassSessions = ["2026-11-30", "2026-12-01", "2026-12-31", "2027-01-14", "2027-01-15"].map((date, index) => ({
    ...rows.ClassSessions[0], session_id: index, date,
  }))
  rows.CheerSessions = []
  const { data, calls } = await accountDataFixture({ tableData: rows })
  const { calendar } = await data.getParentDashboardData("parent", "2026-12-15")
  assert.deepEqual(calendar.sessions.map(row => row.sessionDate), ["2026-12-01", "2026-12-31", "2027-01-14"])
  assert.deepEqual(calls.filter(call => call.table === "ClassSessions").map(call => call.from), [0, 2])
})

test("weekly event counts span Sunday through Saturday across years, count shared events once, and exclude cancellations", async () => {
  const rows = familyTables()
  rows.ClassSessions = [
    ["2026-12-26", "scheduled"],
    ["2026-12-27", "completed"],
    ["2026-12-31", "scheduled"],
    ["2027-01-01", " CANCELED "],
    ["2027-01-03", "scheduled"],
  ].map(([date, status], index) => ({ ...rows.ClassSessions[0], session_id: 100 + index, date, status }))
  rows.CheerSessions = [
    { ...rows.CheerSessions[0], date: "2027-01-02" },
    { ...rows.CheerSessions[0], session_id: 201, date: "2027-01-01", status: "cancelled" },
  ]
  rows.ClassSessionAttendance = []
  const { data } = await accountDataFixture({ tableData: rows })

  for (const today of ["2027-01-01", "2027-01-02"]) {
    const result = await data.getParentDashboardData("parent", today)
    assert.equal(result.weeklyEventCount, 3, today)
    assert.ok(result.calendar.sessions.every(session => session.sessionDate >= "2027-01-01"))
    assert.deepEqual(result.calendar.sessions.find(session => session.sessionId === "cheer:200").athleteNames, ["Amy Athlete", "Zoe Athlete"])
    assert.equal(result.calendar.sessions.find(session => session.sessionId === "cheer:201").status, "cancelled")
  }

  assert.equal((await data.getParentDashboardData("parent", "2027-01-03")).weeklyEventCount, 1)
})

test("empty families show an empty calendar and missing attendance retains scheduled sessions", async () => {
  const empty = await accountDataFixture({ tableData: familyTables() })
  const result = await empty.data.getParentDashboardData("no-athletes", "2026-10-17")
  assert.deepEqual(result.calendar.sessions, [])
  assert.equal(result.weeklyEventCount, 0)
  assert.ok(!empty.calls.some(call => ["ClassSessions", "CheerSessions", "ClassSessionAttendance"].includes(call.table)))

  const missing = await accountDataFixture({
    tableData: familyTables(),
    failures: { ClassSessionAttendance: { code: "42P01", message: "Missing attendance table" } },
  })
  assert.equal((await missing.data.getParentDashboardData("parent", "2026-10-17")).calendar.sessions.length, 2)
})
