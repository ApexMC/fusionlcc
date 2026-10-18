import "server-only"

import { getAccountSession, requireAdminSession, requireStaffSession } from "@/lib/account/auth"
import { DatabaseReadError, fetchAllRows } from "@/lib/account/pagination"
import { createAdminClient } from "@/lib/supabase/admin"
import { getDateKey, getDateKeyInTimeZone, parseDateKeyParts } from "@/lib/date_keys"
import { buildAttendanceEvents, type AttendanceAthlete, type AttendanceEnrollment, type AttendanceSeason, type AttendanceSession, type AthleteAttendanceData, type CheerAttendanceData, type SavedAttendance } from "@/lib/account/attendance"

type Id = string | number
type AthleteRow = { athlete_id: Id; first_name?: string; last_name?: string; created_at?: string; parent_id?: Id; user_id?: string }
type EnrollmentRow = { enrollment_id: Id; athlete_id: Id; class_id?: Id; team_id?: Id; schedule_id?: Id; status: string; selection_required?: boolean; created_at?: string; enrolled_at?: string }
type SessionRow = { session_id: Id; class_id?: Id; team_id?: Id; schedule_id?: Id; date?: string; status?: string }
type ScheduleRow = { schedule_id: Id; class_id?: Id; team_id?: Id }
type AttendanceRow = { session_id: Id; athlete_id?: Id; enrollment_id?: Id; attendance_status?: string; notes?: string; reviewed_at?: string; reviewed_by?: string; is_makeup?: boolean }
type SeasonRow = { season_id: string; name: string; starts_on: string; ends_on: string }
type ParentRow = { parent_id: Id; user_id?: string; first_name?: string; last_name?: string; email?: string; phone?: string }

export function isAttendanceSchemaMissing(error: unknown) {
  return error instanceof DatabaseReadError && ["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code ?? "")
}

async function readRows<T>(table: string, columns: string, keys: string[]) {
  const db = createAdminClient()
  return fetchAllRows<T>((from, to) => {
    let query = db.from(table).select(columns, { count: from === 0 ? "exact" : undefined })
    for (const key of keys) query = query.order(key, { ascending: true })
    return query.range(from, to)
  })
}

async function optionalRows<T>(table: string, columns: string, keys: string[]) {
  try { return { rows: await readRows<T>(table, columns, keys), ready: true } }
  catch (error) {
    if (!isAttendanceSchemaMissing(error)) throw error
    return { rows: [] as T[], ready: false }
  }
}

function name(first?: string, last?: string) { return [first, last].filter(Boolean).join(" ") }
function date(value?: string) { return value ? getDateKey(value) || null : null }
function createdDate(value?: string) {
  if (!value) return null
  if (parseDateKeyParts(value)) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : getDateKeyInTimeZone(parsed)
}
function enrollments(rows: EnrollmentRow[]): AttendanceEnrollment[] {
  return rows.filter((row) => row.athlete_id != null).map((row) => ({
    id: String(row.enrollment_id), athleteId: String(row.athlete_id),
    programId: String(row.team_id ?? row.class_id ?? ""), scheduleId: row.schedule_id == null ? null : String(row.schedule_id),
    active: !row.selection_required && ["approved", "active"].includes(row.status?.toLowerCase()), startsOn: createdDate(row.enrolled_at ?? row.created_at),
  }))
}
function saved(rows: AttendanceRow[]): SavedAttendance[] {
  return rows.map((row) => ({
    sessionId: String(row.session_id), athleteId: row.athlete_id == null ? null : String(row.athlete_id),
    enrollmentId: row.enrollment_id == null ? null : String(row.enrollment_id),
    status: row.attendance_status ?? null, notes: row.notes ?? null, reviewedAt: row.reviewed_at ?? null,
    reviewedBy: row.reviewed_by ?? null, isMakeup: row.is_makeup === true,
  }))
}
function athleteRecords(rows: AthleteRow[], parents: ParentRow[] = []): AttendanceAthlete[] {
  const byId = new Map(parents.map((parent) => [String(parent.parent_id), parent]))
  const byUserId = new Map(parents.filter((parent) => parent.user_id).map((parent) => [parent.user_id, parent]))
  return rows.map((row) => {
    const parent = (row.parent_id == null ? null : byId.get(String(row.parent_id))) ?? (row.user_id ? byUserId.get(row.user_id) : null)
    return { id: String(row.athlete_id), name: name(row.first_name, row.last_name) || "Unnamed athlete", createdOn: createdDate(row.created_at),
      parentName: name(parent?.first_name, parent?.last_name) || "No linked parent", parentEmail: parent?.email ?? null, parentPhone: parent?.phone ?? null }
  })
}

async function loadCheerSource() {
  const [athletes, teams, schedules, enrollmentRows, sessionRows, attendance] = await Promise.all([
    readRows<AthleteRow>("Athletes", "athlete_id,first_name,last_name,created_at,parent_id,user_id", ["athlete_id"]),
    readRows<{ team_id: Id; team_name: string }>("CheerTeams", "team_id,team_name", ["team_id"]),
    readRows<ScheduleRow>("CheerSchedules", "schedule_id,team_id", ["schedule_id"]),
    readRows<EnrollmentRow>("CheerEnrollments", "enrollment_id,athlete_id,team_id,schedule_id,status,selection_required,enrolled_at,created_at", ["enrollment_id"]),
    readRows<SessionRow>("CheerSessions", "session_id,team_id,schedule_id,date,status", ["session_id"]),
    optionalRows<AttendanceRow>("CheerSessionAttendance", "session_id,athlete_id,enrollment_id,attendance_status,notes,reviewed_at,reviewed_by", ["session_id", "athlete_id"]),
  ])
  const teamById = new Map(teams.map((team) => [String(team.team_id), team.team_name]))
  const scheduleById = new Map(schedules.map((schedule) => [String(schedule.schedule_id), schedule]))
  const sessions: AttendanceSession[] = sessionRows.map((row) => {
    const programId = String(row.team_id ?? scheduleById.get(String(row.schedule_id))?.team_id ?? "")
    return { id: String(row.session_id), date: date(row.date), status: row.status ?? "scheduled", category: "cheer",
      programId, programName: teamById.get(programId) ?? "Unassigned team", scheduleId: row.schedule_id == null ? null : String(row.schedule_id) }
  })
  const memberships = enrollments(enrollmentRows).map((enrollment) => ({
    ...enrollment, programName: teamById.get(enrollment.programId) ?? "Unassigned team",
  }))
  return { athleteRows: athletes, sessions, enrollments: memberships, saved: saved(attendance.rows), ready: attendance.ready }
}

export async function getCheerAttendanceData(): Promise<CheerAttendanceData> {
  requireStaffSession(await getAccountSession())
  const [source, parents] = await Promise.all([
    loadCheerSource(),
    readRows<ParentRow>("Parents", "parent_id,user_id,first_name,last_name,email,phone", ["parent_id"]),
  ])
  const athletes = athleteRecords(source.athleteRows, parents)
  const events = buildAttendanceEvents({ ...source, athletes })
  const rosterIds = new Set(events.map((event) => event.athleteId))
  return { sessions: source.sessions, athletes: athletes.filter((athlete) => rosterIds.has(athlete.id)), events,
    ready: source.ready, today: getDateKeyInTimeZone(),
    notices: source.ready ? [] : ["Cheer attendance is unavailable until the attendance database migration has been applied."] }
}

export async function getAthleteAttendanceData({ includeReviewers = false } = {}): Promise<AthleteAttendanceData> {
  requireAdminSession(await getAccountSession())
  const [cheer, parents, classes, schedules, enrollmentRows, sessionRows, attendance, seasonRows] = await Promise.all([
    loadCheerSource(),
    readRows<ParentRow>("Parents", "parent_id,user_id,first_name,last_name,email,phone", ["parent_id"]),
    readRows<{ class_id: Id; class_name: string; type?: string }>("Classes", "class_id,class_name,type", ["class_id"]),
    readRows<ScheduleRow>("ClassSchedules", "schedule_id,class_id", ["schedule_id"]),
    readRows<EnrollmentRow>("Enrollments", "enrollment_id,athlete_id,class_id,schedule_id,status,selection_required,created_at", ["enrollment_id"]),
    readRows<SessionRow>("ClassSessions", "session_id,class_id,schedule_id,date,status", ["session_id"]),
    optionalRows<AttendanceRow>("ClassSessionAttendance", "session_id,athlete_id,enrollment_id,is_makeup,attendance_status,notes,reviewed_at,reviewed_by", ["session_id", "enrollment_id"]),
    optionalRows<SeasonRow>("AthleteAttendanceSeasons", "season_id,name,starts_on,ends_on", ["starts_on", "season_id"]),
  ])
  const athletes = athleteRecords(cheer.athleteRows, parents)
  const classById = new Map(classes.map((record) => [String(record.class_id), record]))
  const scheduleById = new Map(schedules.map((schedule) => [String(schedule.schedule_id), schedule]))
  const sessions: AttendanceSession[] = sessionRows.map((row) => {
    const programId = String(row.class_id ?? scheduleById.get(String(row.schedule_id))?.class_id ?? "")
    const record = classById.get(programId)
    return { id: String(row.session_id), date: date(row.date), status: row.status ?? "scheduled",
      category: /gym|tumbl/i.test(`${record?.type ?? ""} ${record?.class_name ?? ""}`) ? "gymnastics" : "other",
      programId, programName: record?.class_name ?? "Unassigned class", scheduleId: row.schedule_id == null ? null : String(row.schedule_id) }
  })
  const events = [
    ...buildAttendanceEvents({ sessions, athletes, enrollments: enrollments(enrollmentRows), saved: saved(attendance.rows) }),
    ...buildAttendanceEvents({ ...cheer, athletes }),
  ]
  const reviewers: Record<string, string> = {}
  const db = createAdminClient()
  await Promise.all((includeReviewers ? [...new Set(events.flatMap((event) => event.reviewedBy ? [event.reviewedBy] : []))] : []).map(async (id) => {
    const { data, error } = await db.auth.admin.getUserById(id)
    const metadata = data?.user?.user_metadata
    reviewers[id] = error ? "Former staff member" : String(metadata?.full_name || metadata?.name || name(metadata?.first_name, metadata?.last_name) || data?.user?.email || "Staff member")
  }))
  const seasons: AttendanceSeason[] = seasonRows.rows.map((row) => ({ id: row.season_id, name: row.name, startsOn: row.starts_on, endsOn: row.ends_on }))
  return { seasons, athletes, events, cheerMemberships: cheer.enrollments, reviewers, today: getDateKeyInTimeZone(), seasonsReady: seasonRows.ready,
    notices: [
      ...(!seasonRows.ready || !cheer.ready ? ["Attendance setup is incomplete. Apply migrations/20261018_athlete_attendance.sql to enable seasons and cheer attendance."] : []),
      ...(!attendance.ready ? ["Class attendance is unavailable. Apply migrations/20261018_athlete_attendance.sql before using gymnastics totals."] : []),
    ] }
}
