import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type {
  AdminCoachTimeClockGroup,
  AdminDashboardData,
  AdminEnrollmentAthleteOption,
  AdminTimeClockReviewData,
  AthleteRecord,
  CheerBillingRecord,
  CheerScheduleDisplayRecord,
  CheerSessionDisplayRecord,
  CheerTeamRecord,
  ClassBillingRecord,
  ClassOption,
  ChartDatum,
  CoachDashboardData,
  CoachTimeClockData,
  CoachTimeClockEntry,
  ClassRecord,
  ClassSessionAttendanceStatus,
  ClassScheduleDisplayRecord,
  ClassSessionDisplayRecord,
  ClassSessionExpectedAthlete,
  EnrollmentDisplayRecord,
  EnrollmentMetric,
  EnrollmentRecord,
  OperationsActionItem,
  ParentAthleteEnrollment,
  ParentRecord,
  TrendDatum,
} from "@/lib/account/types"

const enrollmentSelectWithPayments = `
  enrollment_id,
  schedule_id,
  athlete_id,
  status,
  created_at,
  stripe_customer_id,
  stripe_subscription_id,
  subscription_status,
  current_period_start,
  current_period_end,
  payment_status,
  Athletes(
    athlete_id,
    first_name,
    last_name,
    user_id,
    parent_id,
    Parents(parent_id, user_id, first_name, last_name, email)
  ),
  ClassSchedules(
    schedule_id,
    class_id,
    day_of_week,
    start_time,
    end_time,
    is_active,
    Classes(class_id, class_name, type, program_type, billing_day, stripe_price_id)
  )
`

const enrollmentSelectBase = `
  enrollment_id,
  schedule_id,
  athlete_id,
  status,
  Athletes(
    athlete_id,
    first_name,
    last_name,
    user_id,
    parent_id,
    Parents(parent_id, user_id, first_name, last_name, email)
  ),
  ClassSchedules(
    schedule_id,
    class_id,
    day_of_week,
    start_time,
    end_time,
    Classes(class_id, class_name, type)
  )
`

type ClassScheduleRow = {
  schedule_id: string | number
  class_id?: string | number | null
  day_of_week?: string | number | null
  start_time?: string | null
  end_time?: string | null
  is_active?: boolean | null
  created_at?: string | null
}

type CheerScheduleRow = {
  schedule_id: string | number
  team_id?: string | number | null
  day_of_week?: string | number | null
  start_time?: string | null
  end_time?: string | null
  is_active?: boolean | null
  created_at?: string | null
  archived_at?: string | null
}

type ClassSessionRow = {
  session_id: string | number
  class_id?: string | number | null
  schedule_id?: string | number | null
  session_date?: string | null
  starts_at?: string | null
  ends_at?: string | null
  status?: string | null
  type?: string | null
}

type CheerSessionRow = {
  session_id: string | number
  team_id?: string | number | null
  schedule_id?: string | number | null
  session_date?: string | null
  starts_at?: string | null
  ends_at?: string | null
  status?: string | null
  type?: string | null
}

type ClassSessionAttendanceRow = {
  attendance_id?: string | number
  session_id?: string | number | null
  enrollment_id?: string | number | null
  athlete_id?: string | number | null
  attendance_status?: ClassSessionAttendanceStatus | null
  notes?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
}

type CoachTimeClockRow = {
  time_clock_id?: string | number
  coach_user_id?: string | null
  work_date?: string | null
  clock_in_at?: string | null
  clock_out_at?: string | null
  clock_in_note?: string | null
  clock_out_note?: string | null
  status?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type CoachProfile = {
  coachName: string
  coachEmail: string | null
}

const dayOrder = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]
const rosterEnrollmentStatuses = new Set(["approved", "active"])
const timeClockSelectColumns =
  "time_clock_id,coach_user_id,work_date,clock_in_at,clock_out_at,clock_in_note,clock_out_note,status,created_at,updated_at"

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function toId(value: string | number | null | undefined) {
  return value === null || value === undefined ? null : String(value)
}

function normalizeDay(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value === 0 || value === 7) {
      return "sunday"
    }

    return dayOrder[value - 1] ?? String(value)
  }

  const normalized = String(value ?? "").trim().toLowerCase()
  const numericDay = Number(normalized)

  if (normalized && Number.isInteger(numericDay)) {
    return normalizeDay(numericDay)
  }

  return normalized
}

function formatDay(value: string | number | null | undefined) {
  const normalized = normalizeDay(value)

  if (!normalized) {
    return "Unscheduled"
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function formatTime(value: string | null | undefined) {
  if (!value) {
    return "Time TBD"
  }

  const [hourText, minuteText = "00"] = value.split(":")
  const hour = Number(hourText)
  const minute = Number(minuteText)

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return value
  }

  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 || 12

  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`
}

function formatScheduleLabel(
  dayOfWeek: string | number | null | undefined,
  startTime: string | null | undefined,
  endTime: string | null | undefined
) {
  return `${formatDay(dayOfWeek)} ${formatTime(startTime)} - ${formatTime(endTime)}`
}

function getClassFallbackName(
  classId: string | number | null | undefined
): string {
  if (classId === null || classId === undefined) {
    return "Unassigned class"
  }

  return `Class #${classId}`
}

function getScheduleSummary(
  classId: string | number | null | undefined,
  scheduleRows: ClassScheduleRow[]
): string | null {
  if (classId === null || classId === undefined) {
    return null
  }

  const normalizedClassId = String(classId)
  const classScheduleRows = scheduleRows.filter(
    (row) =>
      toId(row.class_id) === normalizedClassId && (row.is_active ?? true)
  )

  if (!classScheduleRows.length) {
    return null
  }

  return classScheduleRows
    .map((row) =>
      formatScheduleLabel(row.day_of_week, row.start_time, row.end_time)
    )
    .join(", ")
}

function normalizeProgramType(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_")

  if (normalized.includes("cheer")) {
    return "competitive_cheer"
  }

  if (normalized.includes("gym")) {
    return "gymnastics"
  }

  return normalized
}

export function resolveBillingDay(
  classRecord: Pick<ClassRecord, "billing_day" | "program_type" | "type"> | null
) {
  if (classRecord?.billing_day === 1 || classRecord?.billing_day === 15) {
    return classRecord.billing_day
  }

  const programType = normalizeProgramType(
    classRecord?.program_type ?? classRecord?.type ?? null
  )

  if (programType === "competitive_cheer") {
    return 1
  }

  if (programType === "gymnastics") {
    return 15
  }

  return null
}

export function toDisplayEnrollment(
  enrollment: EnrollmentRecord
): EnrollmentDisplayRecord {
  const athlete = firstRelation(enrollment.Athletes)
  const parent = firstRelation(athlete?.Parents)
  const classSchedule = firstRelation(enrollment.ClassSchedules)
  const classRecord = firstRelation(classSchedule?.Classes)
  const athleteName = [athlete?.first_name, athlete?.last_name]
    .filter(Boolean)
    .join(" ")
  const parentName = [parent?.first_name, parent?.last_name]
    .filter(Boolean)
    .join(" ")
  const classId = toId(classSchedule?.class_id ?? classRecord?.class_id)
  const scheduleId = toId(enrollment.schedule_id ?? classSchedule?.schedule_id)
  const className = classRecord?.class_name ?? getClassFallbackName(classId)
  const scheduleLabel = classSchedule
    ? formatScheduleLabel(
        classSchedule.day_of_week,
        classSchedule.start_time,
        classSchedule.end_time
      )
    : null
  const programType = normalizeProgramType(
    classRecord?.program_type ?? classRecord?.type ?? null
  )

  return {
    enrollmentId: String(enrollment.enrollment_id),
    athleteId: toId(enrollment.athlete_id ?? athlete?.athlete_id),
    athleteName: athleteName || "Unknown athlete",
    parentName: parentName || "Unknown parent",
    parentEmail: parent?.email ?? null,
    scheduleId,
    classId,
    className,
    classType: classRecord?.type ?? null,
    scheduleLabel,
    programType,
    billingDay: resolveBillingDay(classRecord ?? null),
    status: enrollment.status ?? "unknown",
    createdAt: enrollment.created_at ?? null,
    stripePriceId: classRecord?.stripe_price_id ?? null,
    stripeCustomerId: enrollment.stripe_customer_id ?? null,
    stripeSubscriptionId: enrollment.stripe_subscription_id ?? null,
    subscriptionStatus: enrollment.subscription_status ?? null,
    paymentStatus: enrollment.payment_status ?? null,
    currentPeriodStart: enrollment.current_period_start ?? null,
    currentPeriodEnd: enrollment.current_period_end ?? null,
  }
}

async function fetchEnrollments() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("Enrollments")
    .select(enrollmentSelectWithPayments)
    .order("enrollment_id", { ascending: false })

  if (!error) {
    return (data ?? []) as EnrollmentRecord[]
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("Enrollments")
    .select(enrollmentSelectBase)
    .order("enrollment_id", { ascending: false })

  if (fallbackError) {
    throw new Error(fallbackError.message)
  }

  return (fallbackData ?? []) as EnrollmentRecord[]
}

async function fetchParentAthletes(userId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("Athletes")
    .select("athlete_id,user_id,parent_id,first_name,last_name,dob,phone,shirt_size")
    .eq("user_id", userId)
    .order("last_name", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as AthleteRecord[]
}

async function fetchParentEnrollments(athleteIds: string[]) {
  if (!athleteIds.length) {
    return []
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("Enrollments")
    .select(enrollmentSelectWithPayments)
    .in("athlete_id", athleteIds)
    .order("enrollment_id", { ascending: false })

  if (!error) {
    return (data ?? []) as EnrollmentRecord[]
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("Enrollments")
    .select(enrollmentSelectBase)
    .in("athlete_id", athleteIds)
    .order("enrollment_id", { ascending: false })

  if (fallbackError) {
    throw new Error(fallbackError.message)
  }

  return (fallbackData ?? []) as EnrollmentRecord[]
}

async function fetchParents() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("Parents")
    .select("parent_id,user_id,first_name,last_name,balance")

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ParentRecord[]
}

async function fetchAthletes() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("Athletes")
    .select(
      "athlete_id,user_id,parent_id,first_name,last_name,Parents(parent_id,first_name,last_name,email)"
    )

  if (!error) {
    return (data ?? []) as AthleteRecord[]
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("Athletes")
    .select("athlete_id,user_id,parent_id,first_name,last_name")

  if (fallbackError) {
    throw new Error(fallbackError.message)
  }

  return (fallbackData ?? []) as AthleteRecord[]
}

function buildAdminEnrollmentAthleteOptions(
  athletes: AthleteRecord[]
): AdminEnrollmentAthleteOption[] {
  return athletes
    .map((athlete) => {
      const parent = firstRelation(athlete.Parents)
      const athleteName = [athlete.first_name, athlete.last_name]
        .filter(Boolean)
        .join(" ")
      const parentName = [parent?.first_name, parent?.last_name]
        .filter(Boolean)
        .join(" ")

      return {
        athleteId: String(athlete.athlete_id),
        athleteName: athleteName || `Athlete #${athlete.athlete_id}`,
        parentId: toId(athlete.parent_id ?? parent?.parent_id),
        parentName: parentName || "No parent linked",
        parentEmail: parent?.email ?? null,
      }
    })
    .sort((first, second) =>
      first.athleteName.localeCompare(second.athleteName)
    )
}

async function fetchClasses() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("Classes")
    .select("class_id,class_name,type,program_type,billing_day,stripe_price_id,created_at")
    .order("class_id", { ascending: true })

  if (!error) {
    return (data ?? []) as ClassRecord[]
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("Classes")
    .select("class_id,class_name,type,created_at")
    .order("class_id", { ascending: true })

  if (fallbackError) {
    throw new Error(fallbackError.message)
  }

  return (fallbackData ?? []) as ClassRecord[]
}

async function fetchCheerTeams() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("CheerTeams")
    .select("team_id,team_name,type,program_type,billing_day,stripe_price_id,created_at")
    .order("team_id", { ascending: true })

  if (!error) {
    return (data ?? []) as CheerTeamRecord[]
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("CheerTeams")
    .select("team_id,team_name,type,created_at")
    .order("team_id", { ascending: true })

  if (fallbackError) {
    throw new Error(fallbackError.message)
  }

  return (fallbackData ?? []) as CheerTeamRecord[]
}

async function fetchClassScheduleRows() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("ClassSchedules")
    .select("schedule_id,class_id,day_of_week,start_time,end_time,is_active,created_at")
    .is("archived_at", null)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ClassScheduleRow[]
}

async function fetchCheerScheduleRows() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("CheerSchedules")
    .select(
      "schedule_id,team_id,day_of_week,start_time,end_time,is_active,created_at,archived_at"
    )
    .is("archived_at", null)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true })

  if (!error) {
    return (data ?? []) as CheerScheduleRow[]
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("CheerSchedules")
    .select("schedule_id,team_id,day_of_week,start_time,end_time")
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true })

  if (fallbackError) {
    throw new Error(fallbackError.message)
  }

  return (fallbackData ?? []) as CheerScheduleRow[]
}

async function fetchClassSessionRows() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("ClassSessions")
    .select(
      "session_id,class_id,schedule_id,session_date,starts_at,ends_at,status,type"
    )
    .order("session_date", { ascending: false })
    .order("starts_at", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ClassSessionRow[]
}

async function fetchCheerSessionRows() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("CheerSessions")
    .select(
      "session_id,team_id,schedule_id,session_date,starts_at,ends_at,status,type"
    )
    .order("session_date", { ascending: false })
    .order("starts_at", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as CheerSessionRow[]
}

function isMissingAttendanceTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /ClassSessionAttendance|schema cache|does not exist/i.test(
      error.message ?? ""
    )
  )
}

async function fetchClassSessionAttendanceRows() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("ClassSessionAttendance")
    .select(
      "attendance_id,session_id,enrollment_id,athlete_id,attendance_status,notes,reviewed_at,reviewed_by"
    )
    .order("reviewed_at", { ascending: false })

  if (error) {
    if (isMissingAttendanceTableError(error)) {
      return [] as ClassSessionAttendanceRow[]
    }

    throw new Error(error.message)
  }

  return (data ?? []) as ClassSessionAttendanceRow[]
}

function normalizeTimeClockStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase() || "pending"
}

function toCoachTimeClockEntry(row: CoachTimeClockRow): CoachTimeClockEntry {
  const entryId = row.time_clock_id ?? row.clock_in_at ?? "unknown"

  return {
    entryId: String(entryId),
    coachUserId: row.coach_user_id ?? "",
    workDate: row.work_date ?? null,
    clockInAt: row.clock_in_at ?? "",
    clockOutAt: row.clock_out_at ?? null,
    clockInNote: row.clock_in_note ?? null,
    clockOutNote: row.clock_out_note ?? null,
    status: normalizeTimeClockStatus(row.status),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

function getCurrentPayPeriod(now = new Date()) {
  const year = now.getFullYear()
  const month = now.getMonth()
  const startDay = 1
  const start = new Date(year, month, startDay)
  const end = new Date(year, month + 1, 1)

  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  }
}

function isEntryInPeriod(
  entry: CoachTimeClockEntry,
  periodStart: string,
  periodEnd: string
) {
  const entryDate = entry.clockInAt || entry.workDate

  return Boolean(entryDate && entryDate >= periodStart && entryDate < periodEnd)
}

function getEntryDurationMinutes(entry: CoachTimeClockEntry, now: Date) {
  const start = new Date(entry.clockInAt)
  const end = entry.clockOutAt ? new Date(entry.clockOutAt) : now

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0
  }

  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000))
}

function getEntriesDurationMinutes(entries: CoachTimeClockEntry[], now: Date) {
  return entries.reduce(
    (total, entry) => total + getEntryDurationMinutes(entry, now),
    0
  )
}

function getMetadataText(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key]

  return typeof value === "string" && value.trim() ? value.trim() : null
}

function getFallbackCoachName(userId: string) {
  return `Coach ${userId.slice(0, 8)}`
}

async function fetchCoachProfiles(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
  const supabase = createAdminClient()
  const profiles = new Map<string, CoachProfile>()

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const { data, error } = await supabase.auth.admin.getUserById(userId)

      if (error || !data.user) {
        profiles.set(userId, {
          coachName: getFallbackCoachName(userId),
          coachEmail: null,
        })
        return
      }

      const metadata = data.user.user_metadata as
        | Record<string, unknown>
        | undefined
      const firstName = getMetadataText(metadata, "first_name")
      const lastName = getMetadataText(metadata, "last_name")
      const fullName =
        getMetadataText(metadata, "full_name") ??
        getMetadataText(metadata, "name") ??
        [firstName, lastName].filter(Boolean).join(" ").trim()
      const email = data.user.email ?? null

      profiles.set(userId, {
        coachName:
          fullName ||
          (email ? email.split("@")[0] : null) ||
          getFallbackCoachName(userId),
        coachEmail: email,
      })
    })
  )

  return profiles
}

export async function getAdminTimeClockReviewData(): Promise<AdminTimeClockReviewData> {
  const now = new Date()
  const { periodStart, periodEnd } = getCurrentPayPeriod(now)
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("CoachTimeClockEntries")
    .select(timeClockSelectColumns)
    .order("clock_in_at", { ascending: false })

  if (error) {
    return {
      periodStart,
      periodEnd,
      coaches: [],
      tableReady: false,
      message: error.message,
    }
  }

  const historyEntries = ((data ?? []) as CoachTimeClockRow[]).map(
    toCoachTimeClockEntry
  )
  const profiles = await fetchCoachProfiles(
    historyEntries.map((entry) => entry.coachUserId)
  )
  const groupsByCoach = new Map<string, AdminCoachTimeClockGroup>()

  historyEntries.forEach((entry) => {
    const coachUserId = entry.coachUserId || "unknown"
    const profile = profiles.get(coachUserId) ?? {
      coachName: getFallbackCoachName(coachUserId),
      coachEmail: null,
    }
    const group =
      groupsByCoach.get(coachUserId) ??
      ({
        coachUserId,
        coachName: profile.coachName,
        coachEmail: profile.coachEmail,
        currentPeriodEntries: [],
        historyEntries: [],
        currentPeriodMinutes: 0,
        historyMinutes: 0,
        pendingCount: 0,
      } satisfies AdminCoachTimeClockGroup)

    group.historyEntries.push(entry)

    if (isEntryInPeriod(entry, periodStart, periodEnd)) {
      group.currentPeriodEntries.push(entry)
    }

    groupsByCoach.set(coachUserId, group)
  })

  const coaches = Array.from(groupsByCoach.values())
    .map((group) => ({
      ...group,
      currentPeriodMinutes: getEntriesDurationMinutes(
        group.currentPeriodEntries,
        now
      ),
      historyMinutes: getEntriesDurationMinutes(group.historyEntries, now),
      pendingCount: group.currentPeriodEntries.filter(
        (entry) => entry.status === "pending"
      ).length,
    }))
    .sort((first, second) => {
      if (first.pendingCount !== second.pendingCount) {
        return second.pendingCount - first.pendingCount
      }

      return first.coachName.localeCompare(second.coachName)
    })

  return {
    periodStart,
    periodEnd,
    coaches,
    tableReady: true,
    message: null,
  }
}

export async function getCoachTimeClockData(
  userId: string
): Promise<CoachTimeClockData> {
  const supabase = createAdminClient()
  const [recentResult, activeResult] = await Promise.all([
    supabase
      .from("CoachTimeClockEntries")
      .select(timeClockSelectColumns)
      .eq("coach_user_id", userId)
      .order("clock_in_at", { ascending: false })
      .limit(14),
    supabase
      .from("CoachTimeClockEntries")
      .select(timeClockSelectColumns)
      .eq("coach_user_id", userId)
      .is("clock_out_at", null)
      .order("clock_in_at", { ascending: false })
      .limit(1),
  ])

  const error = recentResult.error ?? activeResult.error

  if (error) {
    return {
      activeEntry: null,
      recentEntries: [],
      tableReady: false,
      message: error.message,
    }
  }

  const recentEntries = ((recentResult.data ?? []) as CoachTimeClockRow[]).map(
    toCoachTimeClockEntry
  )
  const activeEntry =
    ((activeResult.data ?? []) as CoachTimeClockRow[])[0] ?? null

  return {
    activeEntry: activeEntry ? toCoachTimeClockEntry(activeEntry) : null,
    recentEntries,
    tableReady: true,
    message: null,
  }
}

function buildClassBillingRows(classes: ClassRecord[]) {
  return classes.map<ClassBillingRecord>((classRecord) => {
    const billingDay = resolveBillingDay(classRecord)
    const programType = normalizeProgramType(
      classRecord.program_type ?? classRecord.type ?? null
    )

    return {
      classId: String(classRecord.class_id),
      className:
        classRecord.class_name ?? getClassFallbackName(classRecord.class_id),
      classType: classRecord.type ?? null,
      programType,
      billingDay,
      stripePriceId: classRecord.stripe_price_id ?? null,
      createdAt: classRecord.created_at ?? null,
    }
  })
}

function buildCheerBillingRows(teams: CheerTeamRecord[]) {
  return teams.map<CheerBillingRecord>((teamRecord) => {
    const programType =
      normalizeProgramType(teamRecord.program_type ?? teamRecord.type ?? null) ??
      "competitive_cheer"

    return {
      teamId: String(teamRecord.team_id),
      teamName: teamRecord.team_name ?? `Team #${teamRecord.team_id}`,
      teamType: teamRecord.type ?? null,
      programType,
      billingDay: "1/15",
      stripePriceId: teamRecord.stripe_price_id ?? null,
      createdAt: teamRecord.created_at ?? null,
    }
  })
}

function buildClassOptions(
  classes: ClassRecord[],
  scheduleRows: ClassScheduleRow[]
): ClassOption[] {
  return buildClassBillingRows(classes).map<ClassOption>((classRecord) => ({
    classId: classRecord.classId,
    className: classRecord.className,
    classType: classRecord.classType,
    programType: classRecord.programType,
    billingDay: classRecord.billingDay,
    scheduleSummary: getScheduleSummary(classRecord.classId, scheduleRows),
    stripePriceId: classRecord.stripePriceId,
  }))
}

function buildClassNameById(classBilling: ClassBillingRecord[]) {
  return new Map(classBilling.map((classRecord) => [
    classRecord.classId,
    classRecord.className,
  ]))
}

function buildCheerTeamNameById(cheerBilling: CheerBillingRecord[]) {
  return new Map(
    cheerBilling.map((teamRecord) => [
      teamRecord.teamId,
      teamRecord.teamName,
    ])
  )
}

function buildEnrollmentCountBySchedule(
  enrollments: EnrollmentDisplayRecord[]
) {
  const athleteIdsBySchedule = new Map<string, Set<string>>()

  enrollments.forEach((enrollment) => {
    const scheduleId = enrollment.scheduleId

    if (
      !scheduleId ||
      !rosterEnrollmentStatuses.has(enrollment.status.toLowerCase())
    ) {
      return
    }

    const athleteIds = athleteIdsBySchedule.get(scheduleId) ?? new Set<string>()
    athleteIds.add(enrollment.athleteId ?? enrollment.enrollmentId)
    athleteIdsBySchedule.set(scheduleId, athleteIds)
  })

  return new Map(
    Array.from(athleteIdsBySchedule.entries()).map(([scheduleId, athleteIds]) => [
      scheduleId,
      athleteIds.size,
    ])
  )
}

function buildClassScheduleRows(
  scheduleRows: ClassScheduleRow[],
  classNameById: Map<string, string>,
  enrollmentCountBySchedule: Map<string, number>
): ClassScheduleDisplayRecord[] {
  return scheduleRows
    .map((row) => {
      const classId = toId(row.class_id)
      const dayOfWeek = normalizeDay(row.day_of_week)
      const scheduleId = String(row.schedule_id)

      return {
        scheduleId,
        classId,
        className:
          (classId ? classNameById.get(classId) : null) ??
          getClassFallbackName(classId),
        dayOfWeek,
        startTime: row.start_time ?? null,
        endTime: row.end_time ?? null,
        isActive: row.is_active ?? true,
        enrollmentCount: enrollmentCountBySchedule.get(scheduleId) ?? 0,
        createdAt: row.created_at ?? null,
        scheduleLabel: formatScheduleLabel(
          dayOfWeek,
          row.start_time,
          row.end_time
        ),
      }
    })
    .sort((first, second) => {
      const firstDay = dayOrder.indexOf(first.dayOfWeek)
      const secondDay = dayOrder.indexOf(second.dayOfWeek)
      const dayComparison =
        (firstDay === -1 ? dayOrder.length : firstDay) -
        (secondDay === -1 ? dayOrder.length : secondDay)

      if (dayComparison !== 0) {
        return dayComparison
      }

      return (first.startTime ?? "").localeCompare(second.startTime ?? "")
    })
}

function buildCheerScheduleRows(
  scheduleRows: CheerScheduleRow[],
  teamNameById: Map<string, string>
): CheerScheduleDisplayRecord[] {
  return scheduleRows
    .map((row) => {
      const teamId = toId(row.team_id)
      const dayOfWeek = normalizeDay(row.day_of_week)
      const scheduleId = String(row.schedule_id)

      return {
        scheduleId,
        teamId,
        teamName:
          (teamId ? teamNameById.get(teamId) : null) ??
          (teamId ? `Team #${teamId}` : "Unassigned team"),
        dayOfWeek,
        startTime: row.start_time ?? null,
        endTime: row.end_time ?? null,
        isActive: row.is_active ?? true,
        enrollmentCount: 0,
        createdAt: row.created_at ?? null,
        scheduleLabel: formatScheduleLabel(
          dayOfWeek,
          row.start_time,
          row.end_time
        ),
      }
    })
    .sort((first, second) => {
      const firstDay = dayOrder.indexOf(first.dayOfWeek)
      const secondDay = dayOrder.indexOf(second.dayOfWeek)
      const dayComparison =
        (firstDay === -1 ? dayOrder.length : firstDay) -
        (secondDay === -1 ? dayOrder.length : secondDay)

      if (dayComparison !== 0) {
        return dayComparison
      }

      return (first.startTime ?? "").localeCompare(second.startTime ?? "")
    })
}

function buildExpectedAthletesBySchedule(
  enrollments: EnrollmentDisplayRecord[]
) {
  const expectedByScheduleId = new Map<string, ClassSessionExpectedAthlete[]>()

  enrollments.forEach((enrollment) => {
    const scheduleId = enrollment.scheduleId

    if (
      !scheduleId ||
      !rosterEnrollmentStatuses.has(enrollment.status.toLowerCase())
    ) {
      return
    }

    expectedByScheduleId.set(scheduleId, [
      ...(expectedByScheduleId.get(scheduleId) ?? []),
      {
        athleteId: enrollment.athleteId ?? "unknown",
        athleteName: enrollment.athleteName,
        enrollmentId: enrollment.enrollmentId,
        enrollmentStatus: enrollment.status,
        parentName: enrollment.parentName,
        parentPhone: null,
        parentEmail: enrollment.parentEmail,
        attendanceStatus: null,
        attendanceNotes: null,
        attendanceReviewedAt: null,
        attendanceReviewedBy: null,
      },
    ])
  })

  return expectedByScheduleId
}

function getAttendanceKey(sessionId: string, enrollmentId: string) {
  return `${sessionId}:${enrollmentId}`
}

function buildAttendanceBySessionEnrollment(
  attendanceRows: ClassSessionAttendanceRow[]
) {
  const attendanceByKey = new Map<string, ClassSessionAttendanceRow>()

  attendanceRows.forEach((row) => {
    const sessionId = toId(row.session_id)
    const enrollmentId = toId(row.enrollment_id)

    if (!sessionId || !enrollmentId) {
      return
    }

    attendanceByKey.set(getAttendanceKey(sessionId, enrollmentId), row)
  })

  return attendanceByKey
}

function buildClassSessionRows({
  sessionRows,
  schedules,
  classNameById,
  enrollments,
  attendanceRows,
}: {
  sessionRows: ClassSessionRow[]
  schedules: ClassScheduleDisplayRecord[]
  classNameById: Map<string, string>
  enrollments: EnrollmentDisplayRecord[]
  attendanceRows: ClassSessionAttendanceRow[]
}): ClassSessionDisplayRecord[] {
  const scheduleById = new Map(
    schedules.map((classSchedule) => [
      classSchedule.scheduleId,
      classSchedule,
    ])
  )
  const expectedByScheduleId = buildExpectedAthletesBySchedule(enrollments)
  const attendanceByKey = buildAttendanceBySessionEnrollment(attendanceRows)

  return sessionRows.map((row) => {
    const scheduleId = toId(row.schedule_id)
    const classSchedule = scheduleId ? scheduleById.get(scheduleId) : null
    const classId = toId(row.class_id) ?? classSchedule?.classId ?? null
    const sessionId = String(row.session_id)
    const expectedAthletes = scheduleId
      ? (expectedByScheduleId.get(scheduleId) ?? []).map((athlete) => {
          const attendance = attendanceByKey.get(
            getAttendanceKey(sessionId, athlete.enrollmentId)
          )

          return {
            ...athlete,
            attendanceStatus: attendance?.attendance_status ?? null,
            attendanceNotes: attendance?.notes ?? null,
            attendanceReviewedAt: attendance?.reviewed_at ?? null,
            attendanceReviewedBy: attendance?.reviewed_by ?? null,
          }
        })
      : []

    return {
      sessionId,
      classId,
      className:
        (classId ? classNameById.get(classId) : null) ??
        classSchedule?.className ??
        getClassFallbackName(classId),
      scheduleId,
      scheduleLabel: classSchedule?.scheduleLabel ?? null,
      sessionDate: row.session_date ?? null,
      startsAt: row.starts_at ?? null,
      endsAt: row.ends_at ?? null,
      status: row.status ?? "scheduled",
      type: row.type ?? null,
      expectedAthletes,
    }
  })
}

function buildCheerSessionRows({
  sessionRows,
  schedules,
  teamNameById,
}: {
  sessionRows: CheerSessionRow[]
  schedules: CheerScheduleDisplayRecord[]
  teamNameById: Map<string, string>
}): CheerSessionDisplayRecord[] {
  const scheduleById = new Map(
    schedules.map((cheerSchedule) => [
      cheerSchedule.scheduleId,
      cheerSchedule,
    ])
  )

  return sessionRows.map((row) => {
    const scheduleId = toId(row.schedule_id)
    const cheerSchedule = scheduleId ? scheduleById.get(scheduleId) : null
    const teamId = toId(row.team_id) ?? cheerSchedule?.teamId ?? null

    return {
      sessionId: String(row.session_id),
      teamId,
      teamName:
        (teamId ? teamNameById.get(teamId) : null) ??
        cheerSchedule?.teamName ??
        (teamId ? `Team #${teamId}` : "Unassigned team"),
      scheduleId,
      scheduleLabel: cheerSchedule?.scheduleLabel ?? null,
      sessionDate: row.session_date ?? null,
      startsAt: row.starts_at ?? cheerSchedule?.startTime ?? null,
      endsAt: row.ends_at ?? cheerSchedule?.endTime ?? null,
      status: row.status ?? "scheduled",
      type: row.type ?? null,
    }
  })
}

function buildStatusBreakdown(enrollments: EnrollmentDisplayRecord[]) {
  const colors = [
    "#7c3aed",
    "#f97316",
    "#16a34a",
    "#dc2626",
    "#64748b",
    "#0891b2",
  ]
  const counts = new Map<string, number>()

  enrollments.forEach((enrollment) => {
    const status = enrollment.status.toLowerCase()
    counts.set(status, (counts.get(status) ?? 0) + 1)
  })

  return Array.from(counts.entries()).map<ChartDatum>(
    ([status, value], index) => ({
      name: status,
      label: status.replace(/_/g, " "),
      value,
      fill: colors[index % colors.length],
    })
  )
}

function buildMonthlyTrend(enrollments: EnrollmentDisplayRecord[]) {
  const monthCounts = new Map<string, number>()
  const now = new Date()

  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1))
    monthCounts.set(
      date.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
      0
    )
  }

  enrollments.forEach((enrollment) => {
    if (!enrollment.createdAt) {
      return
    }

    const date = new Date(enrollment.createdAt)
    const key = date.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    })

    if (monthCounts.has(key)) {
      monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1)
    }
  })

  return Array.from(monthCounts.entries()).map<TrendDatum>(
    ([month, enrollments]) => ({
      month,
      enrollments,
    })
  )
}

function buildMetrics(
  parents: ParentRecord[],
  athletes: AthleteRecord[],
  enrollments: EnrollmentDisplayRecord[],
) {
  const statusCount = (statuses: string[]) =>
    enrollments.filter((enrollment) =>
      statuses.includes(enrollment.status.toLowerCase())
    ).length
  return [
    {
      label: "Parent accounts",
      value: String(parents.length),
      detail: "Total parent records",
    },
    {
      label: "Approved / active",
      value: String(statusCount(["approved", "active"])),
      detail: "Ready for payment or currently active",
    },
    {
      label: "Denied / canceled",
      value: String(statusCount(["denied", "canceled"])),
      detail: "Not moving forward",
    },
  ] satisfies EnrollmentMetric[]
}

function buildActionItems(
  enrollments: EnrollmentDisplayRecord[],
  classBilling: ClassBillingRecord[],
  cheerBilling: CheerBillingRecord[]
) {
  const countByStatus = (statuses: string[]) =>
    enrollments.filter((enrollment) =>
      statuses.includes(enrollment.status.toLowerCase())
    ).length
  const pending = countByStatus(["pending"])
  const readyToPay = enrollments.filter(
    (enrollment) =>
      enrollment.status === "approved" && !enrollment.stripeSubscriptionId
  ).length
  const missingBilling = classBilling.filter(
    (classRecord) =>
      (!classRecord.stripePriceId ||
        !classRecord.billingDay ||
        !classRecord.programType)
  ).length + cheerBilling.filter(
    (teamRecord) =>
      (!teamRecord.stripePriceId ||
        !teamRecord.billingDay ||
        !teamRecord.programType)
  ).length

  return [
    {
      label: "Review queue",
      value: String(pending),
      detail: pending ? "Enrollment requests need a decision" : "No requests waiting",
      tone: pending ? "warning" : "success",
    },
    {
      label: "Ready to bill",
      value: String(readyToPay),
      detail: readyToPay
        ? "Approved enrollments need checkout"
        : "No approved enrollments waiting for payment",
      tone: readyToPay ? "warning" : "success",
    },
    {
      label: "Class billing setup",
      value: String(missingBilling),
      detail: "Classes and cheer teams require additional setup",
      tone: missingBilling ? "warning" : "success",
    },
  ] satisfies OperationsActionItem[]
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [
    parents,
    athletes,
    enrollmentRows,
    classes,
    cheerTeams,
    classScheduleRows,
    cheerScheduleRows,
    classSessionRows,
    cheerSessionRows,
    classSessionAttendanceRows,
    timeClockReview,
  ] = await Promise.all([
    fetchParents(),
    fetchAthletes(),
    fetchEnrollments(),
    fetchClasses(),
    fetchCheerTeams(),
    fetchClassScheduleRows(),
    fetchCheerScheduleRows(),
    fetchClassSessionRows(),
    fetchCheerSessionRows(),
    fetchClassSessionAttendanceRows(),
    getAdminTimeClockReviewData(),
  ])
  const enrollments = enrollmentRows.map(toDisplayEnrollment)
  const classBilling = buildClassBillingRows(classes)
  const cheerBilling = buildCheerBillingRows(cheerTeams)
  const classNameById = buildClassNameById(classBilling)
  const cheerTeamNameById = buildCheerTeamNameById(cheerBilling)
  const enrollmentCountBySchedule = buildEnrollmentCountBySchedule(enrollments)
  const classSchedules = buildClassScheduleRows(
    classScheduleRows,
    classNameById,
    enrollmentCountBySchedule
  )
  const cheerSchedules = buildCheerScheduleRows(
    cheerScheduleRows,
    cheerTeamNameById
  )
  const classSessions = buildClassSessionRows({
    sessionRows: classSessionRows,
    schedules: classSchedules,
    classNameById,
    enrollments,
    attendanceRows: classSessionAttendanceRows,
  })
  const cheerSessions = buildCheerSessionRows({
    sessionRows: cheerSessionRows,
    schedules: cheerSchedules,
    teamNameById: cheerTeamNameById,
  })

  return {
    metrics: buildMetrics(parents, athletes, enrollments),
    actionItems: buildActionItems(enrollments, classBilling, cheerBilling),
    pendingEnrollments: enrollments.filter(
      (enrollment) => enrollment.status.toLowerCase() === "pending"
    ),
    allEnrollments: enrollments,
    enrollmentAthletes: buildAdminEnrollmentAthleteOptions(athletes),
    classBilling,
    cheerBilling,
    classSchedules,
    cheerSchedules,
    classSessions,
    cheerSessions,
    timeClockReview,
    statusBreakdown: buildStatusBreakdown(enrollments),
    monthlyTrend: buildMonthlyTrend(enrollments),
  }
}

export async function getCoachDashboardData(
  userId: string
): Promise<CoachDashboardData> {
  const [
    enrollmentRows,
    classes,
    classScheduleRows,
    classSessionRows,
    classSessionAttendanceRows,
    timeClock,
  ] = await Promise.all([
    fetchEnrollments(),
    fetchClasses(),
    fetchClassScheduleRows(),
    fetchClassSessionRows(),
    fetchClassSessionAttendanceRows(),
    getCoachTimeClockData(userId),
  ])
  const enrollments = enrollmentRows.map(toDisplayEnrollment)
  const classBilling = buildClassBillingRows(classes)
  const classNameById = buildClassNameById(classBilling)
  const enrollmentCountBySchedule = buildEnrollmentCountBySchedule(enrollments)
  const classSchedules = buildClassScheduleRows(
    classScheduleRows,
    classNameById,
    enrollmentCountBySchedule
  )

  return {
    classSessions: buildClassSessionRows({
      sessionRows: classSessionRows,
      schedules: classSchedules,
      classNameById,
      enrollments,
      attendanceRows: classSessionAttendanceRows,
    }),
    timeClock,
  }
}

export async function getParentAthleteEnrollments(
  userId: string
): Promise<{
  athletes: ParentAthleteEnrollment[]
  classOptions: ClassOption[]
}> {
  const [athletes, classes, classScheduleRows] = await Promise.all([
    fetchParentAthletes(userId),
    fetchClasses(),
    fetchClassScheduleRows(),
  ])
  const athleteIds = athletes.map((athlete) => String(athlete.athlete_id))
  const enrollments = (await fetchParentEnrollments(athleteIds)).map(
    toDisplayEnrollment
  )

  return {
    athletes: athletes.map((athlete) => {
      const athleteId = String(athlete.athlete_id)
      const athleteName = [athlete.first_name, athlete.last_name]
        .filter(Boolean)
        .join(" ")

      return {
        athleteId,
        athleteName: athleteName || "Unnamed athlete",
        enrollments: enrollments.filter(
          (enrollment) => enrollment.athleteId === athleteId
        ),
      }
    }),
    classOptions: buildClassOptions(classes, classScheduleRows),
  }
}
