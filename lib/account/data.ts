import "server-only"

import { schedule } from "@/components/classes/class_schedules"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe/server"
import type {
  AdminDashboardData,
  AdminEnrollmentAthleteOption,
  AthleteRecord,
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

type ClassSessionRow = {
  session_id: string | number
  class_id?: string | number | null
  schedule_id?: string | number | null
  session_date?: string | null
  starts_at?: string | null
  ends_at?: string | null
  status?: string | null
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
  created_at?: string | null
  updated_at?: string | null
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

function getLocalClassName(classId: string | number | null | undefined) {
  if (classId === null || classId === undefined) {
    return "Unassigned class"
  }

  return (
    schedule.find((classSchedule) => classSchedule.id === Number(classId))
      ?.name ?? `Class #${classId}`
  )
}

function getScheduleSummary(classId: string | number | null | undefined) {
  if (classId === null || classId === undefined) {
    return null
  }

  const classSchedule = schedule.find((item) => item.id === Number(classId))
  const week = classSchedule?.schedule[0]

  if (!week) {
    return null
  }

  return Object.entries(week)
    .filter(([, times]) => times.some((time) => time !== "—" && time !== "-"))
    .flatMap(([day, times]) =>
      times
        .filter((time) => time !== "—" && time !== "-")
        .map((time) => `${day.slice(0, 3)} ${time}`)
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
  const className = classRecord?.class_name ?? getLocalClassName(classId)
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

async function fetchClassSessionRows() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("ClassSessions")
    .select("session_id,class_id,schedule_id,session_date,starts_at,ends_at,status")
    .order("session_date", { ascending: false })
    .order("starts_at", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ClassSessionRow[]
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
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

export async function getCoachTimeClockData(
  userId: string
): Promise<CoachTimeClockData> {
  const supabase = createAdminClient()
  const selectColumns =
    "time_clock_id,coach_user_id,work_date,clock_in_at,clock_out_at,clock_in_note,clock_out_note,created_at,updated_at"
  const [recentResult, activeResult] = await Promise.all([
    supabase
      .from("CoachTimeClockEntries")
      .select(selectColumns)
      .eq("coach_user_id", userId)
      .order("clock_in_at", { ascending: false })
      .limit(14),
    supabase
      .from("CoachTimeClockEntries")
      .select(selectColumns)
      .eq("coach_user_id", userId)
      .is("clock_out_at", null)
      .order("clock_in_at", { ascending: false })
      .limit(1),
  ])

  const error = recentResult.error ?? activeResult.error

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
  const classRows = classes.map<ClassBillingRecord>((classRecord) => {
    const billingDay = resolveBillingDay(classRecord)
    const programType = normalizeProgramType(
      classRecord.program_type ?? classRecord.type ?? null
    )

    return {
      classId: String(classRecord.class_id),
      className:
        classRecord.class_name ?? getLocalClassName(classRecord.class_id),
      classType: classRecord.type ?? null,
      programType,
      billingDay,
      stripePriceId: classRecord.stripe_price_id ?? null,
      createdAt: classRecord.created_at ?? null,
      source: "database",
    }
  })
  const classIds = new Set(classRows.map((row) => Number(row.classId)))
  const scheduleRows = schedule
    .filter((classSchedule) => !classIds.has(classSchedule.id))
    .map<ClassBillingRecord>((classSchedule) => ({
      classId: String(classSchedule.id),
      className: classSchedule.name,
      classType: null,
      programType: "gymnastics",
      billingDay: 15,
      stripePriceId: null,
      createdAt: null,
      source: "schedule",
    }))

  return [...classRows, ...scheduleRows]
}

function buildClassOptions(classes: ClassRecord[]) {
  return buildClassBillingRows(classes).map<ClassOption>((classRecord) => ({
    classId: classRecord.classId,
    className: classRecord.className,
    classType: classRecord.classType,
    programType: classRecord.programType,
    billingDay: classRecord.billingDay,
    scheduleSummary: getScheduleSummary(classRecord.classId),
    stripePriceId: classRecord.stripePriceId,
  }))
}

function buildClassNameById(classBilling: ClassBillingRecord[]) {
  return new Map(classBilling.map((classRecord) => [
    classRecord.classId,
    classRecord.className,
  ]))
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
          getLocalClassName(classId),
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
        getLocalClassName(classId),
      scheduleId,
      scheduleLabel: classSchedule?.scheduleLabel ?? null,
      sessionDate: row.session_date ?? null,
      startsAt: row.starts_at ?? null,
      endsAt: row.ends_at ?? null,
      status: row.status ?? "scheduled",
      expectedAthletes,
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

function centsToCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

async function estimateMonthlyRecurringRevenue(
  enrollments: EnrollmentDisplayRecord[]
) {
  const activeEnrollments = enrollments.filter((enrollment) =>
    ["active", "trialing"].includes(enrollment.subscriptionStatus ?? "")
  )
  const priceIds = Array.from(
    new Set(
      activeEnrollments
        .map((enrollment) => enrollment.stripePriceId)
        .filter((priceId): priceId is string => Boolean(priceId))
    )
  )

  if (!priceIds.length || !process.env.STRIPE_SECRET_KEY) {
    return null
  }

  try {
    const stripe = getStripe()
    const prices = await Promise.all(
      priceIds.map(async (priceId) => stripe.prices.retrieve(priceId))
    )
    const priceAmountById = new Map(
      prices.map((price) => [
        price.id,
        price.recurring?.interval === "month" ? price.unit_amount ?? 0 : 0,
      ])
    )

    return activeEnrollments.reduce(
      (total, enrollment) =>
        total + (priceAmountById.get(enrollment.stripePriceId ?? "") ?? 0),
      0
    )
  } catch {
    return null
  }
}

function buildMetrics(
  parents: ParentRecord[],
  athletes: AthleteRecord[],
  enrollments: EnrollmentDisplayRecord[],
  mrrCents: number | null
) {
  const statusCount = (statuses: string[]) =>
    enrollments.filter((enrollment) =>
      statuses.includes(enrollment.status.toLowerCase())
    ).length
  const activeAthleteIds = new Set(
    enrollments
      .filter((enrollment) =>
        ["approved", "active"].includes(enrollment.status.toLowerCase())
      )
      .map((enrollment) => enrollment.athleteId)
      .filter((athleteId): athleteId is string => Boolean(athleteId))
  )
  const activeSubscriptions = enrollments.filter((enrollment) =>
    ["active", "trialing"].includes(enrollment.subscriptionStatus ?? "")
  ).length

  return [
    {
      label: "Parent accounts",
      value: String(parents.length),
      detail: "Total parent records",
    },
    /*
    {
      label: "Total enrollments",
      value: String(enrollments.length),
      detail: "All enrollment requests",
    },
    */
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
    /*
    {
      label: "Active subscriptions",
      value: String(activeSubscriptions),
      detail: "Stripe subscription records on enrollments",
    },
    */
    {
      label: "Monthly recurring revenue",
      value: mrrCents === null ? "No Active Subs" : centsToCurrency(mrrCents),
      detail: "Estimated from active monthly Stripe prices",
    },
  ] satisfies EnrollmentMetric[]
}

function buildActionItems(
  enrollments: EnrollmentDisplayRecord[],
  classBilling: ClassBillingRecord[]
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
  const paymentProblems = enrollments.filter((enrollment) =>
    [enrollment.paymentStatus, enrollment.subscriptionStatus].some((status) =>
      ["payment_failed", "past_due", "unpaid"].includes(status ?? "")
    )
  ).length
  const missingBilling = classBilling.filter(
    (classRecord) =>
      (!classRecord.stripePriceId ||
        !classRecord.billingDay ||
        !classRecord.programType)
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
      label: "Payment attention",
      value: String(paymentProblems),
      detail: paymentProblems
        ? "Failed or past-due payment states"
        : "No payment issues detected",
      tone: paymentProblems ? "danger" : "success",
    },
    {
      label: "Class billing setup",
      value: String(missingBilling),
      detail: "Classes require additional setup",
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
    classScheduleRows,
    classSessionRows,
    classSessionAttendanceRows,
  ] = await Promise.all([
    fetchParents(),
    fetchAthletes(),
    fetchEnrollments(),
    fetchClasses(),
    fetchClassScheduleRows(),
    fetchClassSessionRows(),
    fetchClassSessionAttendanceRows(),
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
  const classSessions = buildClassSessionRows({
    sessionRows: classSessionRows,
    schedules: classSchedules,
    classNameById,
    enrollments,
    attendanceRows: classSessionAttendanceRows,
  })
  const mrrCents = await estimateMonthlyRecurringRevenue(enrollments)

  return {
    metrics: buildMetrics(parents, athletes, enrollments, mrrCents),
    actionItems: buildActionItems(enrollments, classBilling),
    pendingEnrollments: enrollments.filter(
      (enrollment) => enrollment.status.toLowerCase() === "pending"
    ),
    allEnrollments: enrollments,
    enrollmentAthletes: buildAdminEnrollmentAthleteOptions(athletes),
    classBilling,
    classSchedules,
    classSessions,
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
  const [athletes, classes] = await Promise.all([
    fetchParentAthletes(userId),
    fetchClasses(),
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
    classOptions: buildClassOptions(classes),
  }
}
