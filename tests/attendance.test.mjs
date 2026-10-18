import assert from "node:assert/strict"
import test from "node:test"
import { loadTypeScriptModule, loadTypeScriptModuleWithMocks } from "./load-typescript.mjs"

const attendance = await loadTypeScriptModule("../lib/account/attendance.ts")
const dates = await loadTypeScriptModule("../lib/date_keys.ts")
const pagination = await loadTypeScriptModule("../lib/account/pagination.ts")
const season = { id: "season", name: "2026–2027", startsOn: "2026-06-01", endsOn: "2027-05-31" }
const athlete = { id: "1", name: "Amy Athlete", createdOn: null, parentName: "Pat Parent", parentEmail: null, parentPhone: null }
const membership = { id: "21", athleteId: "1", programId: "2", scheduleId: null, active: true, startsOn: "2026-06-01" }
function event(id, status, overrides = {}) {
  return { sessionId: String(id), athleteId: "1", enrollmentId: "21", status, category: "cheer", date: "2026-10-05", programId: "2", programName: "Stars", sessionStatus: "completed", isMakeup: false, notes: null, reviewedAt: null, reviewedBy: null, ...overrides }
}
function summarize(events, overrides = {}) {
  return attendance.summarizeAthleteAttendance({ athletes: [athlete], events, cheerMemberships: [membership], today: "2026-10-17", ...overrides }, season)[0]
}

test("allowances distinguish approaching, at and over limits at each boundary", () => {
  for (const [excused, unexcused, expected] of [[0, 0, "within"], [2, 0, "within"], [3, 0, "approaching"], [4, 0, "at-limit"], [5, 0, "over-limit"], [0, 1, "approaching"], [0, 2, "at-limit"], [0, 3, "over-limit"], [4, 1, "at-limit"], [3, 3, "over-limit"]]) {
    assert.equal(attendance.getAbsenceStanding(excused, unexcused), expected)
  }
})

test("season counts include its boundaries and exclude future, canceled, other-season and optional makeup absences", () => {
  const result = summarize([
    event(1, "excused", { date: season.startsOn }), event(2, "absent"),
    event(3, "excused", { date: "2026-05-31" }), event(4, "absent", { date: "2027-06-01" }),
    event(5, "absent", { date: "2026-10-18" }), event(6, "absent", { sessionStatus: "canceled" }),
    event(7, "absent", { sessionStatus: "cancelled" }), event(8, "absent", { isMakeup: true }),
    event(9, null), event(10, "late"), event(11, "present"), event(12, "absent", { date: null }),
  ])
  assert.deepEqual(result.totals.cheer, { excused: 1, unexcused: 1, present: 1, late: 1, incomplete: 1, recorded: 4, standing: "approaching" })
  assert.equal(result.incomplete, 1)
  assert.equal(result.history.length, 6)
  const ended = attendance.summarizeAthleteAttendance({ athletes: [athlete], events: [event(1, "excused", { date: season.endsOn })], cheerMemberships: [membership], today: "2027-06-01" }, season)[0]
  assert.equal(ended.totals.cheer.excused, 1)
})

test("cheer and gymnastics retain independent allowances and other classes never consume either", () => {
  const result = summarize([
    ...[1, 2, 3].map((id) => event(id, "excused")),
    ...[4, 5, 6].map((id) => event(id, "excused", { category: "gymnastics" })),
    event(7, "absent", { category: "other" }), event(8, "unexcused", { category: "other" }),
  ])
  assert.equal(result.totals.cheer.excused, 3)
  assert.equal(result.totals.gymnastics.excused, 3)
  assert.equal(result.totals.other.unexcused, 2)
  assert.equal(result.standing, "approaching")
})

test("missing and unrecognized marks are incomplete, never absent or present", () => {
  const result = summarize([event(1, null), event(2, "unknown"), event(3, "constructor")])
  assert.equal(result.totals.cheer.unexcused, 0)
  assert.equal(result.totals.cheer.present, 0)
  assert.equal(result.incomplete, 3)
  assert.equal(result.standing, "no-records")
  assert.equal(summarize([event(1, "present")]).standing, "within")
})

test("recreational athletes are tracking only; saved cheer attendance preserves policy after enrollment ends", () => {
  const events = [1, 2, 3, 4, 5].map((id) => event(id, "absent", { category: "gymnastics" }))
  assert.equal(summarize(events, { cheerMemberships: [] }).standing, "not-applicable")
  assert.equal(summarize([...events, event(6, "present")], { cheerMemberships: [{ ...membership, active: false }] }).standing, "over-limit")
  assert.equal(summarize(events, { cheerMemberships: [{ ...membership, startsOn: "2027-06-01" }] }).standing, "not-applicable")
})

test("the default season uses current dates, then latest past or nearest future", () => {
  const old = { ...season, id: "old", startsOn: "2025-06-01", endsOn: "2026-05-31" }
  const future = { ...season, id: "future", startsOn: "2027-06-01", endsOn: "2028-05-31" }
  assert.equal(attendance.selectAttendanceSeason([future, old, season], "2026-10-17").id, "season")
  assert.equal(attendance.selectAttendanceSeason([future, old, season], "2029-01-01").id, "future")
  assert.equal(attendance.selectAttendanceSeason([future, season], "2025-01-01").id, "season")
  assert.equal(attendance.selectAttendanceSeason([], "2026-10-17"), null)
})

test("cheer rosters respect join dates while retaining and deduplicating saved history across schedules", () => {
  const sessions = [{ id: "1", date: "2026-10-05", status: "completed", category: "cheer", programId: "2", programName: "Stars", scheduleId: "20" }]
  const enrollments = [membership, { ...membership, id: "22" }, { ...membership, id: "23", athleteId: "2", startsOn: "2026-10-06" }, { ...membership, id: "24", athleteId: "3", scheduleId: "21" }]
  const athletes = [athlete, { ...athlete, id: "2" }, { ...athlete, id: "3" }]
  const saved = [event(1, "absent", { enrollmentId: "21", athleteId: null, reviewedAt: "2026-10-06T12:00:00Z" }), event(1, "excused", { enrollmentId: "22", reviewedAt: "2026-10-07T12:00:00Z" })]
  const events = attendance.buildAttendanceEvents({ sessions, enrollments, athletes, saved })
  assert.deepEqual(events.map((event) => event.athleteId), ["1", "3"])
  assert.equal(events[0].status, "excused")
  assert.equal(events[1].enrollmentId, "24")
  assert.equal(events[1].status, null)
  const moved = attendance.buildAttendanceEvents({ sessions, enrollments: enrollments.map((row) => ({ ...row, active: false, scheduleId: "99" })), athletes, saved })
  assert.equal(moved.length, 1)
  assert.equal(moved[0].athleteId, "1")
  assert.equal(moved[0].status, "excused")
})

test("cheer expects eligible team members at every practice regardless of enrollment schedule", () => {
  const sessions = ["20", "21", null].map((scheduleId, index) => ({
    id: String(index + 1), date: "2026-10-05", status: "scheduled", category: "cheer",
    programId: "2", programName: "Stars", scheduleId,
  }))
  const athletes = Array.from({ length: 7 }, (_, index) => ({ ...athlete, id: String(index + 1) }))
  athletes[6].createdOn = "2026-10-06"
  const enrollments = [
    { ...membership, scheduleId: "20" },
    { ...membership, id: "22", athleteId: "2", scheduleId: "21" },
    { ...membership, id: "23", athleteId: "3" },
    { ...membership, id: "24", athleteId: "4", programId: "3" },
    { ...membership, id: "25", athleteId: "5", active: false },
    { ...membership, id: "26", athleteId: "6", startsOn: "2026-10-06" },
    { ...membership, id: "27", athleteId: "7" },
    { ...membership, id: "28", scheduleId: "21" },
  ]
  const events = attendance.buildAttendanceEvents({ sessions, enrollments, athletes, saved: [] })
  for (const session of sessions) {
    assert.deepEqual(events.filter((event) => event.sessionId === session.id).map((event) => event.athleteId), ["1", "2", "3"])
  }
})

test("class attendance still requires a matching enrollment schedule", () => {
  const enrollments = [
    { ...membership, scheduleId: "20" },
    { ...membership, id: "22", athleteId: "2", scheduleId: "21" },
    { ...membership, id: "23", athleteId: "3" },
  ]
  const athletes = [athlete, { ...athlete, id: "2" }, { ...athlete, id: "3" }]
  for (const category of ["gymnastics", "other"]) {
    for (const scheduleId of ["20", "21", null]) {
      const sessions = [{ id: "1", date: "2026-10-05", status: "scheduled", category, programId: "2", programName: "Class", scheduleId }]
      const events = attendance.buildAttendanceEvents({ sessions, enrollments, athletes, saved: [] })
      assert.deepEqual(events.map((event) => event.athleteId), scheduleId === "20" ? ["1"] : scheduleId === "21" ? ["2"] : [])
    }
  }
})

function roleSession(role) { return role ? { userId: "staff", isOwner: role === "owner", isAdmin: role === "admin", isCoach: role === "coach" } : null }
function auth(role) {
  return {
    getAccountSession: async () => roleSession(role),
    requireAdminSession(session) { if (!session || (!session.isOwner && !session.isAdmin)) throw new Error("Unauthorized"); return session },
    requireStaffSession(session) { if (!session || (!session.isOwner && !session.isAdmin && !session.isCoach)) throw new Error("Unauthorized"); return session },
  }
}
const tableFixture = {
  Athletes: [{ athlete_id: 1, first_name: "Amy", last_name: "Athlete", parent_id: 1, created_at: "2026-10-06T04:59:59Z" }],
  Parents: [{ parent_id: 1, first_name: "Pat", last_name: "Parent", email: "parent@example.test" }],
  CheerTeams: [{ team_id: 2, team_name: "Stars" }], CheerSchedules: [{ schedule_id: 20, team_id: 2 }],
  CheerEnrollments: [{ enrollment_id: 21, athlete_id: 1, team_id: 2, status: "active", enrolled_at: "2026-10-06T04:59:59Z" }],
  CheerSessions: [{ session_id: 200, schedule_id: 20, date: "2026-10-05", status: "completed" }],
  CheerSessionAttendance: [{ session_id: 200, athlete_id: 1, enrollment_id: 21, attendance_status: "excused", reviewed_by: "staff", reviewed_at: "2026-10-07T12:00:00Z" }],
  Classes: [{ class_id: 1, class_name: "Gymnastics", type: "gymnastics" }], ClassSchedules: [{ schedule_id: 10, class_id: 1 }],
  Enrollments: [{ enrollment_id: 1, athlete_id: 1, class_id: 1, schedule_id: 10, status: "active" }],
  ClassSessions: [{ session_id: 100, schedule_id: 10, date: "2026-10-05", status: "completed" }], ClassSessionAttendance: [],
  AthleteAttendanceSeasons: [{ season_id: "season", name: season.name, starts_on: season.startsOn, ends_on: season.endsOn }],
}
async function dataFixture({ role = "admin", failures = {}, tables = tableFixture } = {}) {
  const calls = []
  const db = { from(table) {
    const query = { select() { return this }, order() { return this }, range(from) {
      calls.push(table)
      return Promise.resolve(failures[table] ? { data: null, error: failures[table] } : { data: structuredClone(tables[table].slice(from, from + 1)), count: tables[table].length, error: null })
    } }
    return query
  }, auth: { admin: { getUserById: async (id) => { calls.push(`auth:${id}`); return { data: { user: { user_metadata: { full_name: "Coach Pat" } } }, error: null } } } } }
  const loaded = await loadTypeScriptModuleWithMocks("../lib/account/attendance-data.ts", {
    "server-only": {}, "@/lib/account/auth": auth(role), "@/lib/account/pagination": pagination,
    "@/lib/supabase/admin": { createAdminClient: () => db }, "@/lib/date_keys": dates, "@/lib/account/attendance": attendance,
  })
  return { module: loaded, calls }
}

test("attendance loaders paginate, use local join dates and resolve saved reviewers only when requested", async () => {
  const tables = structuredClone(tableFixture)
  tables.Athletes.push({ athlete_id: 2, first_name: "Zoe", parent_id: 1 })
  tables.CheerEnrollments.push({ enrollment_id: 22, athlete_id: 2, team_id: 2, status: "approved", selection_required: true })
  const { module, calls } = await dataFixture({ tables })
  const data = await module.getAthleteAttendanceData({ includeReviewers: true })
  assert.equal(data.athletes.length, 2)
  assert.equal(data.athletes[0].createdOn, "2026-10-05")
  assert.equal(data.events.filter((event) => event.category === "cheer").length, 1)
  assert.equal(data.reviewers.staff, "Coach Pat")
  assert.equal(data.notices.length, 0)
  assert.equal(data.athletes[0].parentEmail, "parent@example.test")
  assert.equal(calls.filter((table) => table === "Athletes").length, 2)
  const lightweight = await dataFixture()
  await lightweight.module.getAthleteAttendanceData()
  assert.equal(lightweight.calls.some((call) => call.startsWith("auth:")), false)
})

test("missing attendance tables are visibly unavailable; operational errors are not swallowed", async () => {
  const failures = Object.fromEntries(["CheerSessionAttendance", "ClassSessionAttendance", "AthleteAttendanceSeasons"].map((table) => [table, { code: "42P01", message: "Missing table" }]))
  const missing = await dataFixture({ failures })
  const data = await missing.module.getAthleteAttendanceData()
  assert.equal(data.seasonsReady, false)
  assert.equal(data.notices.length, 2)
  const cheer = await missing.module.getCheerAttendanceData()
  assert.equal(cheer.ready, false)
  assert.equal(cheer.events[0].status, null)
  const failed = await dataFixture({ failures: { CheerSessionAttendance: { code: "XX000", message: "Database unavailable" } } })
  await assert.rejects(failed.module.getAthleteAttendanceData(), /Database unavailable/)
})

test("loaders authorize before database access and coaches receive cheer rosters with matching parent details", async () => {
  for (const role of [null, "parent", "coach"]) {
    const fixture = await dataFixture({ role })
    await assert.rejects(fixture.module.getAthleteAttendanceData(), /Unauthorized/)
    assert.deepEqual(fixture.calls, [])
  }
  const fixture = await dataFixture({ role: "coach" })
  const cheer = await fixture.module.getCheerAttendanceData()
  assert.equal(cheer.events.length, 1)
  assert.equal(cheer.athletes[0].parentName, "Pat Parent")
  assert.equal(cheer.athletes[0].parentEmail, "parent@example.test")
  assert.equal(fixture.calls.includes("ClassSessions"), false)
})

test("cheer parent details also resolve through the family's user account and exclude unrelated athletes", async () => {
  const tables = structuredClone(tableFixture)
  tables.Athletes[0].parent_id = null
  tables.Athletes[0].user_id = "family"
  tables.Parents[0].user_id = "family"
  tables.Parents[0].phone = "555-0100"
  tables.Athletes.push({ athlete_id: 2, first_name: "Unrelated", parent_id: 1 })
  const fixture = await dataFixture({ tables, role: "coach" })
  const data = await fixture.module.getCheerAttendanceData()
  assert.equal(data.athletes.length, 1)
  assert.equal(data.athletes[0].parentName, "Pat Parent")
  assert.equal(data.athletes[0].parentPhone, "555-0100")
  assert.equal(data.athletes[0].parentEmail, "parent@example.test")
})

async function actionFixture({ role = "admin", data, error = null } = {}) {
  const writes = [], refreshes = []
  const db = { from(table) { return {
    upsert(rows, options) { writes.push({ table, rows, options }); return { error } },
    insert(values) { writes.push({ table, values }); return this },
    update(values) { writes.push({ table, values }); return this }, eq() { return this }, select() { return this },
    single() { return { data: { season_id: "saved-season" }, error } },
  } } }
  const loaded = await loadTypeScriptModuleWithMocks("../app/actions/attendance.ts", {
    "next/cache": { revalidatePath: (...args) => refreshes.push(args) }, "@/lib/account/auth": auth(role),
    "@/lib/account/attendance-data": { getCheerAttendanceData: async () => data ?? {
      ready: true, today: "2026-10-17", sessions: [{ id: "200", date: "2026-10-05", status: "completed" }],
      events: [{ sessionId: "200", athleteId: "1", enrollmentId: "21" }],
    } }, "@/lib/account/attendance": attendance, "@/lib/date_keys": dates,
    "@/lib/supabase/admin": { createAdminClient: () => db },
  })
  return { module: loaded, writes, refreshes }
}
const validInput = { sessionId: "200", attendance: [{ athleteId: "1", status: "excused", notes: " Illness " }] }

test("cheer saves use the verified roster and staff identity, trim notes and refresh all account views", async () => {
  const fixture = await actionFixture({ role: "coach" })
  assert.equal((await fixture.module.saveCheerAttendance(validInput)).ok, true)
  assert.equal(fixture.writes[0].rows[0].enrollment_id, "21")
  assert.equal(fixture.writes[0].rows[0].reviewed_by, "staff")
  assert.equal(fixture.writes[0].rows[0].notes, "Illness")
  assert.ok(fixture.writes[0].rows[0].reviewed_at)
  assert.equal(fixture.writes[0].options.onConflict, "session_id,athlete_id")
  assert.deepEqual(fixture.refreshes, [["/account", "layout"]])
})

test("cheer rejects invalid, duplicate, out-of-roster, future, canceled, undated and unavailable attendance without writes", async () => {
  for (const input of [null, { ...validInput, attendance: [] }, { ...validInput, attendance: [validInput.attendance[0], validInput.attendance[0]] }, { ...validInput, attendance: [{ athleteId: "1", status: "unknown", notes: "" }] }, { ...validInput, attendance: [{ athleteId: "2", status: "present", notes: "" }] }, { ...validInput, attendance: [{ athleteId: "1", status: "present", notes: "x".repeat(2001) }] }]) {
    const fixture = await actionFixture()
    assert.equal((await fixture.module.saveCheerAttendance(input)).ok, false)
    assert.equal(fixture.writes.length, 0)
  }
  for (const session of [{ id: "200", date: "2026-10-18", status: "scheduled" }, { id: "200", date: "2026-10-05", status: "cancelled" }, { id: "200", date: null, status: "completed" }]) {
    const fixture = await actionFixture({ data: { ready: true, today: "2026-10-17", sessions: [session], events: [] } })
    assert.equal((await fixture.module.saveCheerAttendance(validInput)).ok, false)
    assert.equal(fixture.writes.length, 0)
  }
  const unavailable = await actionFixture({ data: { ready: false } })
  assert.equal((await unavailable.module.saveCheerAttendance(validInput)).ok, false)
})

test("mutation authorization is enforced separately for seasons and attendance", async () => {
  for (const role of [null, "parent"]) {
    const fixture = await actionFixture({ role })
    await assert.rejects(fixture.module.saveCheerAttendance(validInput), /Unauthorized/)
    assert.equal(fixture.writes.length, 0)
  }
  const coach = await actionFixture({ role: "coach" })
  await assert.rejects(coach.module.saveAttendanceSeason({ name: "Season", startsOn: "2026-06-01", endsOn: "2027-05-31" }), /Unauthorized/)
  assert.equal(coach.writes.length, 0)
})

test("season setup validates real dates, persists exact bounds and reports overlaps and save failures", async () => {
  const input = { name: "  2026–2027  ", startsOn: "2026-06-01", endsOn: "2027-05-31" }
  for (const invalid of [null, {}, { ...input, startsOn: undefined }, { ...input, startsOn: "2026-02-30" }, { ...input, endsOn: "2026-01-01" }, { ...input, id: "bad-id" }]) {
    const fixture = await actionFixture()
    assert.equal((await fixture.module.saveAttendanceSeason(invalid)).ok, false)
    assert.equal(fixture.writes.length, 0)
  }
  const fixture = await actionFixture({ role: "owner" })
  assert.equal((await fixture.module.saveAttendanceSeason(input)).ok, true)
  assert.deepEqual(fixture.writes[0].values, { name: "2026–2027", starts_on: input.startsOn, ends_on: input.endsOn })
  for (const code of ["23505", "23P01", "XX000"]) {
    const failed = await actionFixture({ error: { code } })
    const result = await failed.module.saveAttendanceSeason(input)
    assert.equal(result.ok, false)
    assert.equal(failed.refreshes.length, 0)
    if (code !== "XX000") assert.match(result.message, /overlap/)
  }
  const failed = await actionFixture({ error: { code: "XX000" } })
  assert.equal((await failed.module.saveCheerAttendance(validInput)).ok, false)
  assert.equal(failed.refreshes.length, 0)
})
