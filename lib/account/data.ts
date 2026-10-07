import "server-only"

import { getDateKey, getDateKeyInTimeZone, parseDateKeyParts } from "@/lib/date_keys"
import { normalizeProgramType } from "@/lib/programs"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe/server"
import { getAccountSession, requireAdminSession } from "@/lib/account/auth"
import { fetchAllRows, isSchemaCompatibilityError } from "@/lib/account/pagination"
import { isClassPaymentWaiverCheerEnrollment } from "@/lib/account/parent-enrollments"
import {
  buildCheerScheduleRosterCounts,
  buildRecurringRevenueMetric,
  getCoverageState,
  hasBillingData,
} from "@/lib/account/reporting"
import {
  formatDay,
  getWeekdaySortIndex,
  normalizeDay,
} from "@/lib/scheduling"
import { formatLocalTime } from "@/lib/local_time"
import type {
  AdminCoachTimeClockGroup,
  AdminDashboardData,
  AdminDashboardMetrics,
  AdminEnrollmentAthleteOption,
  AdminReportingAthlete,
  AdminReportingData,
  AdminReportingParent,
  AdminTimeClockReviewData,
  AthleteRecord,
  CheerBillingRecord,
  CheerEnrollmentDisplayRecord,
  CheerEnrollmentRecord,
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
  DeadPeriodRecord,
  EnrollmentDisplayRecord,
  EnrollmentRecord,
  OperationsActionItem,
  ParentAthleteEnrollment,
  ParentRecord,
  ProgramEnrollmentDatum,
  ScheduleSeasonRecord,
  TrendDatum,
} from "@/lib/account/types"

const enrollmentSelectWithPayments = `
  enrollment_id,
  class_id,
  schedule_id,
  athlete_id,
  status,
  selection_required,
  created_at,
  stripe_customer_id,
  stripe_subscription_id,
  subscription_status,
  current_period_start,
  current_period_end,
  payment_status,
  Athletes(
    athlete_id,
    created_at,
    first_name,
    last_name,
    user_id,
    parent_id,
    Parents(parent_id, user_id, first_name, last_name, phone, email)
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
  class_id,
  schedule_id,
  athlete_id,
  status,
  selection_required,
  Athletes(
    athlete_id,
    created_at,
    first_name,
    last_name,
    user_id,
    parent_id,
    Parents(parent_id, user_id, first_name, last_name, phone, email)
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

const cheerEnrollmentSelect = `
  enrollment_id,
  athlete_id,
  team_id,
  status,
  contract_signed,
  enrolled_at,
  created_at,
  parent_id,
  stripe_customer_id,
  subscription_status,
  current_period_start,
  current_period_end,
  payment_status,
  schedule_id,
  selection_required,
  tuition_subscription_id,
  fee_subscription_id
`

type ClassScheduleRow = {
  schedule_id: string | number
  class_id?: string | number | null
  season_id?: string | number | null
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

type ScheduleSeasonRow = {
  season_id: string | number
  season?: string | null
  is_active?: boolean | null
}

type ClassSessionRow = {
  session_id: string | number
  class_id?: string | number | null
  schedule_id?: string | number | null
  date?: string | null
  starts_at?: string | null
  ends_at?: string | null
  status?: string | null
  type?: string | null
}

type CheerSessionRow = {
  session_id: string | number
  team_id?: string | number | null
  schedule_id?: string | number | null
  date?: string | null
  starts_at?: string | null
  ends_at?: string | null
  status?: string | null
  type?: string | null
}

type DeadPeriodRow = {
  period_id: string | number
  starts_at?: string | null
  ends_at?: string | null
}

type ClassSessionAttendanceRow = {
  attendance_id?: string | number
  session_id?: string | number | null
  enrollment_id?: string | number | null
  athlete_id?: string | number | null
  is_makeup?: boolean | null
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
  coachPhone: string | null
}

const seasonOrder = ["spring", "summer", "fall", "winter"]
const rosterEnrollmentStatuses = new Set(["approved", "active"])
const timeClockSelectColumns =
  "time_clock_id,coach_user_id,work_date,clock_in_at,clock_out_at,clock_in_note,clock_out_note,status,created_at,updated_at"

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function toId(value: string | number | null | undefined) {
  return value === null || value === undefined ? null : String(value)
}

function normalizeSeason(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase()
}

function formatSeason(value: string | null | undefined) {
  const normalized = normalizeSeason(value)

  if (!normalized) {
    return "Unassigned"
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function formatScheduleLabel(
  dayOfWeek: string | number | null | undefined,
  startTime: string | null | undefined,
  endTime: string | null | undefined
) {
  return `${formatDay(dayOfWeek)} ${formatLocalTime(
    startTime
  )} - ${formatLocalTime(endTime)}`
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
  const classId = toId(
    enrollment.class_id ?? classSchedule?.class_id ?? classRecord?.class_id
  )
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
    athleteCreatedAt: athlete?.created_at ?? null,
    athleteName: athleteName || "Unknown athlete",
    parentName: parentName || "Unknown parent",
    parentPhone: parent?.phone ?? null,
    parentEmail: parent?.email ?? null,
    scheduleId,
    classId,
    className,
    classType: classRecord?.type ?? null,
    scheduleLabel,
    selectionRequired: enrollment.selection_required === true,
    programType,
    billingDay: resolveBillingDay(classRecord ?? null),
    status: enrollment.status ?? "unknown",
    createdAt: enrollment.created_at ?? null,
    stripePriceId: classRecord?.stripe_price_id ?? null,
    stripeCustomerId: enrollment.stripe_customer_id ?? null,
    stripeSubscriptionId: enrollment.stripe_subscription_id ?? null,
    billingDataAvailable: hasBillingData(enrollment, [
      "stripe_subscription_id", "subscription_status", "payment_status",
    ]),
    subscriptionStatus: enrollment.subscription_status ?? null,
    paymentStatus: enrollment.payment_status ?? null,
    currentPeriodStart: enrollment.current_period_start ?? null,
    currentPeriodEnd: enrollment.current_period_end ?? null,
  }
}

function toDisplayCheerEnrollment(
  enrollment: CheerEnrollmentRecord,
  indexes: {
    athleteById: Map<string, AthleteRecord>
    parentById: Map<string, ParentRecord>
    teamNameById: Map<string, string>
    scheduleById: Map<string, CheerScheduleDisplayRecord>
  }
): CheerEnrollmentDisplayRecord {
  const athleteId = toId(enrollment.athlete_id)
  const athlete = athleteId ? indexes.athleteById.get(athleteId) : null
  const athleteParent = firstRelation(athlete?.Parents)
  const parentId = toId(enrollment.parent_id ?? athlete?.parent_id)
  const parent = parentId
    ? indexes.parentById.get(parentId) ?? athleteParent
    : athleteParent
  const teamId = toId(enrollment.team_id)
  const scheduleId = toId(enrollment.schedule_id)
  const schedule = scheduleId ? indexes.scheduleById.get(scheduleId) : null
  const athleteName = [athlete?.first_name, athlete?.last_name]
    .filter(Boolean)
    .join(" ")
  const parentName = [parent?.first_name, parent?.last_name]
    .filter(Boolean)
    .join(" ")

  return {
    enrollmentId: String(enrollment.enrollment_id),
    athleteId,
    athleteName:
      athleteName || (athleteId ? `Athlete #${athleteId}` : "Unknown athlete"),
    parentId,
    parentName: parentName || "Unknown parent",
    parentPhone: parent?.phone ?? null,
    parentEmail: parent?.email ?? null,
    teamId,
    teamName:
      (teamId ? indexes.teamNameById.get(teamId) : null) ??
      schedule?.teamName ??
      (teamId ? `Team #${teamId}` : "Unassigned team"),
    scheduleId,
    scheduleLabel: schedule?.scheduleLabel ?? null,
    status: enrollment.status ?? "unknown",
    contractSigned: enrollment.contract_signed === true,
    selectionRequired: enrollment.selection_required === true,
    createdAt: enrollment.created_at ?? enrollment.enrolled_at ?? null,
    stripeCustomerId: enrollment.stripe_customer_id ?? null,
    tuitionSubscriptionId: enrollment.tuition_subscription_id ?? null,
    feeSubscriptionId: enrollment.fee_subscription_id ?? null,
    billingDataAvailable: hasBillingData(enrollment, [
      "tuition_subscription_id", "fee_subscription_id", "subscription_status", "payment_status",
    ]),
    subscriptionStatus: enrollment.subscription_status ?? null,
    paymentStatus: enrollment.payment_status ?? null,
    currentPeriodStart: enrollment.current_period_start ?? null,
    currentPeriodEnd: enrollment.current_period_end ?? null,
  }
}

async function fetchEnrollments() {
  const supabase = createAdminClient()

  try {
    return await fetchAllRows<EnrollmentRecord>((from, to) =>
      supabase
        .from("Enrollments")
        .select(enrollmentSelectWithPayments, { count: from === 0 ? "exact" : undefined })
        .order("enrollment_id", { ascending: false })
        .range(from, to)
    )
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) {
      throw error
    }

    return fetchAllRows<EnrollmentRecord>((from, to) =>
      supabase
        .from("Enrollments")
        .select(enrollmentSelectBase, { count: from === 0 ? "exact" : undefined })
        .order("enrollment_id", { ascending: false })
        .range(from, to)
    )
  }
}

async function fetchCheerEnrollments() {
  const supabase = createAdminClient()
  return fetchAllRows<CheerEnrollmentRecord>((from, to) =>
      supabase
        .from("CheerEnrollments")
        .select(cheerEnrollmentSelect, { count: from === 0 ? "exact" : undefined })
        .order("created_at", { ascending: false })
        .order("enrollment_id", { ascending: false })
        .range(from, to)
    )
}

async function fetchParentAthletes(userId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("Athletes")
    .select(
      "athlete_id,user_id,parent_id,first_name,last_name,dob,phone,shirt_size,Parents(parent_id,user_id,first_name,last_name,phone,email)"
    )
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

async function fetchBlockedClassEnrollmentAthleteIds(athleteIds: string[]) {
  if (!athleteIds.length) {
    return []
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("Enrollments")
    .select("athlete_id")
    .in("athlete_id", athleteIds)
    .in("status", ["pending", "approved", "active"])

  if (error) {
    throw new Error(error.message)
  }

  return Array.from(
    new Set(
      (data ?? []).flatMap((enrollment) =>
        enrollment.athlete_id === null || enrollment.athlete_id === undefined
          ? []
          : [String(enrollment.athlete_id)]
      )
    )
  )
}

async function fetchBlockedCheerEnrollments(athleteIds: string[]) {
  if (!athleteIds.length) {
    return []
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("CheerEnrollments")
    .select("athlete_id,team_id")
    .in("athlete_id", athleteIds)
    .in("status", ["pending", "approved", "active"])

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

async function fetchParentCheerEnrollments(athleteIds: string[]) {
  if (!athleteIds.length) {
    return []
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("CheerEnrollments")
    .select(cheerEnrollmentSelect)
    .in("athlete_id", athleteIds)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as CheerEnrollmentRecord[]
}

async function fetchParents() {
  const supabase = createAdminClient()

  try {
    return await fetchAllRows<ParentRecord>((from, to) =>
      supabase
        .from("Parents")
        .select("parent_id,user_id,first_name,last_name,phone,email,address,city,state,zip_code,balance,stripe_customer_id", { count: from === 0 ? "exact" : undefined })
        .order("parent_id", { ascending: true })
        .range(from, to)
    )
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) {
      throw error
    }

    return fetchAllRows<ParentRecord>((from, to) =>
      supabase
        .from("Parents")
        .select("parent_id,user_id,first_name,last_name,phone,email,balance", { count: from === 0 ? "exact" : undefined })
        .order("parent_id", { ascending: true })
        .range(from, to)
    )
  }
}

async function fetchAthletes() {
  const supabase = createAdminClient()

  try {
    return await fetchAllRows<AthleteRecord>((from, to) =>
      supabase
        .from("Athletes")
        .select("athlete_id,user_id,parent_id,first_name,last_name,dob,phone,shirt_size,Parents(parent_id,first_name,last_name,phone,email)", { count: from === 0 ? "exact" : undefined })
        .order("athlete_id", { ascending: true })
        .range(from, to)
    )
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) {
      throw error
    }

    return fetchAllRows<AthleteRecord>((from, to) =>
      supabase
        .from("Athletes")
        .select("athlete_id,user_id,parent_id,first_name,last_name", { count: from === 0 ? "exact" : undefined })
        .order("athlete_id", { ascending: true })
        .range(from, to)
    )
  }
}

function buildReportingParents(
  parents: ParentRecord[]
): AdminReportingParent[] {
  return parents
    .map((parent) => {
      const balance = Number(parent.balance)

      return {
        parentId: String(parent.parent_id),
        parentName:
          [parent.first_name, parent.last_name].filter(Boolean).join(" ") ||
          `Parent #${parent.parent_id}`,
        email: parent.email ?? null,
        phone: parent.phone ?? null,
        address: parent.address ?? null,
        city: parent.city ?? null,
        state: parent.state ?? null,
        zipCode: parent.zip_code ?? null,
        balance:
          parent.balance !== null &&
          parent.balance !== undefined &&
          Number.isFinite(balance)
            ? balance
            : null,
        stripeCustomerId: parent.stripe_customer_id ?? null,
      }
    })
    .sort((first, second) => first.parentName.localeCompare(second.parentName))
}

function buildReportingAthletes(
  athletes: AthleteRecord[],
  parentById: Map<string, ParentRecord>
): AdminReportingAthlete[] {
  return athletes
    .map((athlete) => {
      const relatedParent = firstRelation(athlete.Parents)
      const parentId = toId(athlete.parent_id ?? relatedParent?.parent_id)
      const parent =
        (parentId ? parentById.get(parentId) : null) ?? relatedParent ?? null

      return {
        athleteId: String(athlete.athlete_id),
        athleteName:
          [athlete.first_name, athlete.last_name]
            .filter(Boolean)
            .join(" ") || `Athlete #${athlete.athlete_id}`,
        dateOfBirth: athlete.dob ?? null,
        phone: athlete.phone ?? null,
        shirtSize: athlete.shirt_size ?? null,
        parentId,
        parentName:
          [parent?.first_name, parent?.last_name]
            .filter(Boolean)
            .join(" ") || "No parent linked",
        parentEmail: parent?.email ?? null,
        parentPhone: parent?.phone ?? null,
      }
    })
    .sort((first, second) => first.athleteName.localeCompare(second.athleteName))
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

  try {
    return await fetchAllRows<ClassRecord>((from, to) =>
      supabase
        .from("Classes")
        .select("class_id,class_name,class_description,type,program_type,billing_day,stripe_price_id,created_at", { count: from === 0 ? "exact" : undefined })
        .order("class_id", { ascending: true })
        .range(from, to)
    )
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) {
      throw error
    }

    return fetchAllRows<ClassRecord>((from, to) =>
      supabase
        .from("Classes")
        .select("class_id,class_name,type,created_at", { count: from === 0 ? "exact" : undefined })
        .order("class_id", { ascending: true })
        .range(from, to)
    )
  }
}

async function fetchCheerTeams() {
  const supabase = createAdminClient()

  try {
    return await fetchAllRows<CheerTeamRecord>((from, to) =>
      supabase
        .from("CheerTeams")
        .select("team_id,team_name,type,description,program_type,billing_day,tuition_price_id,fee_price_id,created_at", { count: from === 0 ? "exact" : undefined })
        .order("team_id", { ascending: true })
        .range(from, to)
    )
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) {
      throw error
    }

    return fetchAllRows<CheerTeamRecord>((from, to) =>
      supabase
        .from("CheerTeams")
        .select("team_id,team_name,type,description,created_at", { count: from === 0 ? "exact" : undefined })
        .order("team_id", { ascending: true })
        .range(from, to)
    )
  }
}

async function fetchClassScheduleRows() {
  const supabase = createAdminClient()
  return fetchAllRows<ClassScheduleRow>((from, to) =>
      supabase
        .from("ClassSchedules")
        .select("schedule_id,class_id,season_id,day_of_week,start_time,end_time,is_active,created_at", { count: from === 0 ? "exact" : undefined })
        .is("archived_at", null)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true })
        .order("schedule_id", { ascending: true })
        .range(from, to)
    )
}

async function fetchScheduleSeasons() {
  const supabase = createAdminClient()
  return fetchAllRows<ScheduleSeasonRow>((from, to) =>
      supabase
        .from("ScheduleSeasons")
        .select("season_id,season,is_active", { count: from === 0 ? "exact" : undefined })
        .order("season_id", { ascending: true })
        .range(from, to)
    )
}

async function fetchCheerScheduleRows() {
  const supabase = createAdminClient()

  try {
    return await fetchAllRows<CheerScheduleRow>((from, to) =>
      supabase
        .from("CheerSchedules")
        .select("schedule_id,team_id,day_of_week,start_time,end_time,is_active,created_at,archived_at", { count: from === 0 ? "exact" : undefined })
        .is("archived_at", null)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true })
        .order("schedule_id", { ascending: true })
        .range(from, to)
    )
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) {
      throw error
    }

    return fetchAllRows<CheerScheduleRow>((from, to) =>
      supabase
        .from("CheerSchedules")
        .select("schedule_id,team_id,day_of_week,start_time,end_time", { count: from === 0 ? "exact" : undefined })
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true })
        .order("schedule_id", { ascending: true })
        .range(from, to)
    )
  }
}

async function fetchClassSessionRows() {
  const supabase = createAdminClient()
  return fetchAllRows<ClassSessionRow>((from, to) =>
      supabase
        .from("ClassSessions")
        .select("session_id,class_id,schedule_id,date,starts_at,ends_at,status,type", { count: from === 0 ? "exact" : undefined })
        .order("date", { ascending: false })
        .order("starts_at", { ascending: true })
        .order("session_id", { ascending: true })
        .range(from, to)
    )
}

async function fetchCheerSessionRows() {
  const supabase = createAdminClient()
  return fetchAllRows<CheerSessionRow>((from, to) =>
      supabase
        .from("CheerSessions")
        .select("session_id,team_id,schedule_id,date,starts_at,ends_at,status,type", { count: from === 0 ? "exact" : undefined })
        .order("date", { ascending: false })
        .order("starts_at", { ascending: true })
        .order("session_id", { ascending: true })
        .range(from, to)
    )
}

export async function getDeadPeriods(): Promise<DeadPeriodRecord[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("DeadPeriods")
    .select("period_id,starts_at,ends_at")
    .order("starts_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as DeadPeriodRow[]).map((row) => ({
    periodId: String(row.period_id),
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
  }))
}

function isMissingAttendanceTableError(error: { code?: string; message?: string }) {
  return ["42P01", "42703", "PGRST205", "PGRST204"].includes(error.code ?? "")
}

async function fetchClassSessionAttendanceRows() {
  const supabase = createAdminClient()

  try {
    return await fetchAllRows<ClassSessionAttendanceRow>((from, to) =>
      supabase
        .from("ClassSessionAttendance")
        .select("attendance_id,session_id,enrollment_id,athlete_id,is_makeup,attendance_status,notes,reviewed_at,reviewed_by", { count: from === 0 ? "exact" : undefined })
        .order("reviewed_at", { ascending: false })
        .order("attendance_id", { ascending: true })
        .range(from, to)
    )
  } catch (error) {
    if (error instanceof Error && isMissingAttendanceTableError(error)) {
      return [] as ClassSessionAttendanceRow[]
    }

    throw error
  }
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
          coachPhone: null,
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
      const phone = getMetadataText(metadata, "phone") ?? data.user.phone ?? null

      profiles.set(userId, {
        coachName:
          fullName ||
          (email ? email.split("@")[0] : null) ||
          getFallbackCoachName(userId),
        coachPhone: phone,
      })
    })
  )

  return profiles
}

export async function getAdminTimeClockReviewData(): Promise<AdminTimeClockReviewData> {
  const now = new Date()
  const { periodStart, periodEnd } = getCurrentPayPeriod(now)
  const supabase = createAdminClient()
  let rows: CoachTimeClockRow[]

  try {
    rows = await fetchAllRows<CoachTimeClockRow>((from, to) =>
      supabase
        .from("CoachTimeClockEntries")
        .select(timeClockSelectColumns, { count: from === 0 ? "exact" : undefined })
        .order("clock_in_at", { ascending: false })
        .order("time_clock_id", { ascending: true })
        .range(from, to)
    )
  } catch (error) {
    return {
      periodStart,
      periodEnd,
      coaches: [],
      tableReady: false,
      message: error instanceof Error ? error.message : "Time entries are unavailable.",
    }
  }

  const historyEntries = rows.map(toCoachTimeClockEntry)
  const profiles = await fetchCoachProfiles(
    historyEntries.map((entry) => entry.coachUserId)
  )
  const groupsByCoach = new Map<string, AdminCoachTimeClockGroup>()

  historyEntries.forEach((entry) => {
    const coachUserId = entry.coachUserId || "unknown"
    const profile = profiles.get(coachUserId) ?? {
      coachName: getFallbackCoachName(coachUserId),
      coachPhone: null,
    }
    const group =
      groupsByCoach.get(coachUserId) ??
      ({
        coachUserId,
        coachName: profile.coachName,
        coachPhone: profile.coachPhone,
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
      classDescription: classRecord.class_description ?? null,
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
      teamDescription: teamRecord.description ?? null,
      programType,
      billingDay: "1/15",
      tuitionPriceId: teamRecord.tuition_price_id ?? null,
      feePriceId: teamRecord.fee_price_id ?? null,
      createdAt: teamRecord.created_at ?? null,
    }
  })
}

function buildClassOptions(
  classes: ClassRecord[],
  scheduleRows: ClassScheduleRow[]
): ClassOption[] {
  return buildClassBillingRows(classes).map<ClassOption>((classRecord) => {
    const classScheduleRows = scheduleRows.filter(
      (row) =>
        toId(row.class_id) === classRecord.classId && (row.is_active ?? true)
    )

    return {
      classId: classRecord.classId,
      className: classRecord.className,
      classType: classRecord.classType,
      programType: classRecord.programType,
      billingDay: classRecord.billingDay,
      scheduleSummary: getScheduleSummary(classRecord.classId, scheduleRows),
      schedules: classScheduleRows.map((row) => ({
        scheduleId: String(row.schedule_id),
        scheduleLabel: formatScheduleLabel(
          row.day_of_week,
          row.start_time,
          row.end_time
        ),
      })),
      stripePriceId: classRecord.stripePriceId,
    }
  })
}

function buildClassNameById(classBilling: ClassBillingRecord[]) {
  return new Map(classBilling.map((classRecord) => [
    classRecord.classId,
    classRecord.className,
  ]))
}

function buildScheduleSeasonRows(
  seasonRows: ScheduleSeasonRow[]
): ScheduleSeasonRecord[] {
  return seasonRows
    .map<ScheduleSeasonRecord>((row) => ({
      seasonId: String(row.season_id),
      season: formatSeason(row.season),
      isActive: row.is_active ?? false,
    }))
    .sort((first, second) => {
      const firstOrder = seasonOrder.indexOf(normalizeSeason(first.season))
      const secondOrder = seasonOrder.indexOf(normalizeSeason(second.season))
      const seasonComparison =
        (firstOrder === -1 ? seasonOrder.length : firstOrder) -
        (secondOrder === -1 ? seasonOrder.length : secondOrder)

      if (seasonComparison !== 0) {
        return seasonComparison
      }

      return first.season.localeCompare(second.season)
    })
}

function filterActiveSeasonScheduleRows(
  scheduleRows: ClassScheduleRow[],
  scheduleSeasons: ScheduleSeasonRecord[]
) {
  const activeSeasonIds = new Set(
    scheduleSeasons
      .filter((scheduleSeason) => scheduleSeason.isActive)
      .map((scheduleSeason) => scheduleSeason.seasonId)
  )

  if (!activeSeasonIds.size) {
    return []
  }

  return scheduleRows.filter((row) => {
    const seasonId = toId(row.season_id)

    return Boolean(seasonId && activeSeasonIds.has(seasonId))
  })
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

function buildAthleteNamesBySchedule(
  enrollments: EnrollmentDisplayRecord[]
) {
  const athletesBySchedule = new Map<string, Map<string, string>>()

  enrollments.forEach((enrollment) => {
    const scheduleId = enrollment.scheduleId

    if (
      !scheduleId ||
      !rosterEnrollmentStatuses.has(enrollment.status.toLowerCase())
    ) {
      return
    }

    const athletes =
      athletesBySchedule.get(scheduleId) ?? new Map<string, string>()
    athletes.set(
      enrollment.athleteId ?? enrollment.enrollmentId,
      enrollment.athleteName
    )
    athletesBySchedule.set(scheduleId, athletes)
  })

  return new Map(
    Array.from(athletesBySchedule.entries()).map(([scheduleId, athletes]) => [
      scheduleId,
      Array.from(athletes.values()).sort((first, second) =>
        first.localeCompare(second)
      ),
    ])
  )
}

function buildClassScheduleRows(
  scheduleRows: ClassScheduleRow[],
  classNameById: Map<string, string>,
  scheduleSeasonById: Map<string, ScheduleSeasonRecord>,
  enrollmentCountBySchedule: Map<string, number>,
  athleteNamesBySchedule: Map<string, string[]>
): ClassScheduleDisplayRecord[] {
  return scheduleRows
    .map((row) => {
      const classId = toId(row.class_id)
      const seasonId = toId(row.season_id)
      const scheduleSeason = seasonId ? scheduleSeasonById.get(seasonId) : null
      const dayOfWeek = normalizeDay(row.day_of_week)
      const scheduleId = String(row.schedule_id)

      return {
        scheduleId,
        classId,
        className:
          (classId ? classNameById.get(classId) : null) ??
          getClassFallbackName(classId),
        seasonId,
        season: scheduleSeason?.season ?? null,
        seasonIsActive: scheduleSeason?.isActive ?? false,
        dayOfWeek,
        startTime: row.start_time ?? null,
        endTime: row.end_time ?? null,
        isActive: row.is_active ?? true,
        enrollmentCount: enrollmentCountBySchedule.get(scheduleId) ?? 0,
        athleteNames: athleteNamesBySchedule.get(scheduleId) ?? [],
        createdAt: row.created_at ?? null,
        scheduleLabel: formatScheduleLabel(
          dayOfWeek,
          row.start_time,
          row.end_time
        ),
      }
    })
    .sort((first, second) => {
      const dayComparison =
        getWeekdaySortIndex(first.dayOfWeek) -
        getWeekdaySortIndex(second.dayOfWeek)

      if (dayComparison !== 0) {
        return dayComparison
      }

      return (first.startTime ?? "").localeCompare(second.startTime ?? "")
    })
}

function buildCheerScheduleRows(
  scheduleRows: CheerScheduleRow[],
  teamNameById: Map<string, string>,
  enrollmentCountBySchedule: Map<string, number> = new Map()
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
      const dayComparison =
        getWeekdaySortIndex(first.dayOfWeek) -
        getWeekdaySortIndex(second.dayOfWeek)

      if (dayComparison !== 0) {
        return dayComparison
      }

      return (first.startTime ?? "").localeCompare(second.startTime ?? "")
    })
}

function sortSessionAthletes(athletes: ClassSessionExpectedAthlete[]) {
  return athletes.sort((first, second) => {
    const nameComparison = first.athleteName.localeCompare(second.athleteName)

    if (nameComparison !== 0) {
      return nameComparison
    }

    const scheduleComparison = (first.scheduleLabel ?? "").localeCompare(
      second.scheduleLabel ?? ""
    )

    if (scheduleComparison !== 0) {
      return scheduleComparison
    }

    return first.enrollmentId.localeCompare(second.enrollmentId)
  })
}

function getAthleteCreatedDateKey(value: string | null) {
  if (!value) {
    return ""
  }

  if (parseDateKeyParts(value)) {
    return value
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? "" : getDateKeyInTimeZone(date)
}

function buildClassSessionRosterIndexes(enrollments: EnrollmentDisplayRecord[]) {
  const expectedByScheduleId = new Map<string, ClassSessionExpectedAthlete[]>()
  const rosterByClassId = new Map<string, ClassSessionExpectedAthlete[]>()
  const athleteCreatedDateByEnrollmentId = new Map<string, string>()

  enrollments.forEach((enrollment) => {
    const scheduleId = enrollment.scheduleId
    const classId = enrollment.classId

    if (
      !classId ||
      !rosterEnrollmentStatuses.has(enrollment.status.toLowerCase())
    ) {
      return
    }

    const athlete: ClassSessionExpectedAthlete = {
      athleteId: enrollment.athleteId ?? "unknown",
      athleteName: enrollment.athleteName,
      enrollmentId: enrollment.enrollmentId,
      enrollmentStatus: enrollment.status,
      scheduleId,
      scheduleLabel: enrollment.scheduleLabel,
      parentName: enrollment.parentName,
      parentPhone: enrollment.parentPhone,
      parentEmail: enrollment.parentEmail,
      isMakeup: false,
      attendanceStatus: null,
      attendanceNotes: null,
      attendanceReviewedAt: null,
      attendanceReviewedBy: null,
    }

    athleteCreatedDateByEnrollmentId.set(
      enrollment.enrollmentId,
      getAthleteCreatedDateKey(enrollment.athleteCreatedAt)
    )
    const classRoster = rosterByClassId.get(classId) ?? []
    classRoster.push(athlete)
    rosterByClassId.set(classId, classRoster)

    if (scheduleId) {
      const scheduleRoster = expectedByScheduleId.get(scheduleId) ?? []
      scheduleRoster.push(athlete)
      expectedByScheduleId.set(scheduleId, scheduleRoster)
    }
  })

  expectedByScheduleId.forEach((athletes) => sortSessionAthletes(athletes))
  rosterByClassId.forEach((athletes) => sortSessionAthletes(athletes))

  return {
    expectedByScheduleId,
    rosterByClassId,
    athleteCreatedDateByEnrollmentId,
  }
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

function applyAttendanceToSessionAthlete(
  athlete: ClassSessionExpectedAthlete,
  attendance: ClassSessionAttendanceRow | undefined,
  isMakeup = false
): ClassSessionExpectedAthlete {
  return {
    ...athlete,
    isMakeup: isMakeup || attendance?.is_makeup === true,
    attendanceStatus: attendance?.attendance_status ?? null,
    attendanceNotes: attendance?.notes ?? null,
    attendanceReviewedAt: attendance?.reviewed_at ?? null,
    attendanceReviewedBy: attendance?.reviewed_by ?? null,
  }
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
  const { expectedByScheduleId, rosterByClassId, athleteCreatedDateByEnrollmentId } =
    buildClassSessionRosterIndexes(enrollments)
  const attendanceByKey = buildAttendanceBySessionEnrollment(attendanceRows)

  return sessionRows.map((row) => {
    const scheduleId = toId(row.schedule_id)
    const classSchedule = scheduleId ? scheduleById.get(scheduleId) : null
    const classId = toId(row.class_id) ?? classSchedule?.classId ?? null
    const sessionId = String(row.session_id)
    const sessionDate = getDateKey(row.date)
    const isEligibleForSession = (athlete: ClassSessionExpectedAthlete) => {
      const createdDate = athleteCreatedDateByEnrollmentId.get(
        athlete.enrollmentId
      )

      // Compare calendar dates so athletes created on the session day are eligible.
      return !sessionDate || !createdDate || createdDate <= sessionDate
    }
    const scheduledAthletes = (
      scheduleId ? expectedByScheduleId.get(scheduleId) ?? [] : []
    ).filter(isEligibleForSession)
    const scheduledEnrollmentIds = new Set(
      scheduledAthletes.map((athlete) => athlete.enrollmentId)
    )
    const expectedAthletes = scheduledAthletes.map((athlete) =>
      applyAttendanceToSessionAthlete(
        athlete,
        attendanceByKey.get(getAttendanceKey(sessionId, athlete.enrollmentId))
      )
    )
    const displayedEnrollmentIds = new Set(
      expectedAthletes.map((athlete) => athlete.enrollmentId)
    )
    const classRoster = (
      classId ? rosterByClassId.get(classId) ?? [] : []
    ).filter(isEligibleForSession)
    const makeupAthletes = classRoster.flatMap((athlete) => {
      if (scheduledEnrollmentIds.has(athlete.enrollmentId)) {
        return []
      }

      const attendance = attendanceByKey.get(
        getAttendanceKey(sessionId, athlete.enrollmentId)
      )

      if (!attendance) {
        return []
      }

      displayedEnrollmentIds.add(athlete.enrollmentId)

      return [applyAttendanceToSessionAthlete(athlete, attendance, true)]
    })
    const makeupAthleteOptions = classRoster
      .filter((athlete) => !displayedEnrollmentIds.has(athlete.enrollmentId))
      .map((athlete) => ({
        ...athlete,
        isMakeup: true,
      }))

    return {
      sessionId,
      classId,
      className:
        (classId ? classNameById.get(classId) : null) ??
        classSchedule?.className ??
        getClassFallbackName(classId),
      scheduleId,
      scheduleLabel: classSchedule?.scheduleLabel ?? null,
      sessionDate: row.date ?? null,
      startsAt: row.starts_at ?? null,
      endsAt: row.ends_at ?? null,
      status: row.status ?? "scheduled",
      type: row.type ?? null,
      expectedAthletes: [...expectedAthletes, ...makeupAthletes],
      makeupAthleteOptions,
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
      sessionDate: row.date ?? null,
      startsAt: row.starts_at ?? cheerSchedule?.startTime ?? null,
      endsAt: row.ends_at ?? cheerSchedule?.endTime ?? null,
      status: row.status ?? "scheduled",
      type: row.type ?? null,
    }
  })
}

type EnrollmentStatusRecord = {
  status: string
}

function buildStatusBreakdown(enrollments: EnrollmentStatusRecord[]) {
  const statusOrder = ["pending", "approved", "active", "denied", "canceled"]
  const statusColors: Record<string, string> = {
    pending: "#f59e0b",
    approved: "#7c3aed",
    active: "#16a34a",
    denied: "#dc2626",
    canceled: "#64748b",
  }
  const counts = new Map<string, number>()

  enrollments.forEach((enrollment) => {
    const status = enrollment.status.toLowerCase()
    counts.set(status, (counts.get(status) ?? 0) + 1)
  })

  return Array.from(counts.entries())
    .sort(
      ([left], [right]) =>
        (statusOrder.indexOf(left) === -1
          ? statusOrder.length
          : statusOrder.indexOf(left)) -
        (statusOrder.indexOf(right) === -1
          ? statusOrder.length
          : statusOrder.indexOf(right))
    )
    .map<ChartDatum>(([status, value]) => ({
      name: status,
      label: status
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase()),
      value,
      fill: statusColors[status] ?? "#0891b2",
    }))
}

function buildEnrollmentTrend(
  enrollments: EnrollmentDisplayRecord[],
  cheerEnrollments: CheerEnrollmentDisplayRecord[]
) {
  const dailyCounts = new Map<
    string,
    Pick<TrendDatum, "classes" | "cheer">
  >()
  const now = new Date()
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )

  for (let index = 89; index >= 0; index -= 1) {
    const date = new Date(today)
    date.setUTCDate(today.getUTCDate() - index)
    dailyCounts.set(date.toISOString().slice(0, 10), {
      classes: 0,
      cheer: 0,
    })
  }

  const addEnrollment = (
    enrollment: Pick<EnrollmentDisplayRecord, "createdAt">,
    series: "classes" | "cheer"
  ) => {
    if (!enrollment.createdAt) {
      return
    }

    const date = new Date(enrollment.createdAt)
    if (Number.isNaN(date.getTime())) {
      return
    }

    const key = date.toISOString().slice(0, 10)
    const current = dailyCounts.get(key)

    if (current) {
      dailyCounts.set(key, {
        ...current,
        [series]: current[series] + 1,
      })
    }
  }

  enrollments.forEach((enrollment) => addEnrollment(enrollment, "classes"))
  cheerEnrollments.forEach((enrollment) =>
    addEnrollment(enrollment, "cheer")
  )

  return Array.from(dailyCounts.entries()).map<TrendDatum>(
    ([date, counts]) => ({
      date,
      ...counts,
    })
  )
}

function buildProgramBreakdown(
  enrollments: EnrollmentDisplayRecord[],
  cheerEnrollments: CheerEnrollmentDisplayRecord[]
) {
  const counts = new Map<string, ProgramEnrollmentDatum>()

  const addEnrollment = (
    key: string,
    program: string,
    programType: ProgramEnrollmentDatum["programType"],
    statusValue: string
  ) => {
    const status = statusValue.toLowerCase()
    if (!["active", "approved", "pending"].includes(status)) {
      return
    }

    const current = counts.get(key) ?? {
      program,
      programType,
      pending: 0,
      approved: 0,
      active: 0,
    }

    current[status as "pending" | "approved" | "active"] += 1

    counts.set(key, current)
  }

  enrollments.forEach((enrollment) =>
    addEnrollment(
      `class:${enrollment.classId ?? enrollment.className}`,
      enrollment.className,
      "Class",
      enrollment.status
    )
  )
  cheerEnrollments.forEach((enrollment) =>
    addEnrollment(
      `cheer:${enrollment.teamId ?? enrollment.teamName}`,
      enrollment.teamName,
      "Cheer",
      enrollment.status
    )
  )

  return Array.from(counts.values())
    .sort(
      (left, right) =>
        right.active +
        right.approved +
        right.pending -
        (left.active + left.approved + left.pending) ||
        left.program.localeCompare(right.program)
    )
    .slice(0, 8)
}

const STRIPE_PROCESSING_RATE = 0.029
const STRIPE_PROCESSING_FIXED_FEE_CENTS = 30
const STRIPE_SUBSCRIPTION_RATE = 0.007
const PLATFORM_FEE_RATE = 0.015

function deductEstimatedRecurringRevenueFees(
  grossCents: number,
  monthlyChargeCount: number
) {
  const stripeProcessingFeeCents =
    Math.round(grossCents * STRIPE_PROCESSING_RATE) +
    monthlyChargeCount * STRIPE_PROCESSING_FIXED_FEE_CENTS
  const stripeSubscriptionFeeCents = Math.round(
    grossCents * STRIPE_SUBSCRIPTION_RATE
  )
  const platformFeeCents = Math.round(grossCents * PLATFORM_FEE_RATE)

  return Math.max(
    0,
    grossCents -
      stripeProcessingFeeCents -
      stripeSubscriptionFeeCents -
      platformFeeCents
  )
}

async function estimateMonthlyRecurringRevenue(
  enrollments: EnrollmentDisplayRecord[],
  cheerEnrollments: CheerEnrollmentDisplayRecord[],
  cheerBilling: CheerBillingRecord[]
) {
  const coverage = [
    ...enrollments.map((enrollment) => ({
      ...enrollment,
      subscriptionIds: [enrollment.stripeSubscriptionId],
    })),
    ...cheerEnrollments.map((enrollment) => ({
      ...enrollment,
      subscriptionIds: [enrollment.tuitionSubscriptionId, enrollment.feeSubscriptionId],
    })),
  ]

  const coverageUnverified = coverage.some((enrollment) => {
    const state = getCoverageState(enrollment)
    const status = enrollment.subscriptionStatus?.trim().toLowerCase() ?? ""
    return state === "unknown" ||
      (["active", "trialing"].includes(status) && state !== "subscribed")
  })

  if (coverageUnverified) {
    return null
  }

  const activeEnrollments = enrollments.filter((enrollment) =>
    ["active", "trialing"].includes(enrollment.subscriptionStatus?.trim().toLowerCase() ?? "")
  )
  const activeCheerEnrollments = cheerEnrollments.filter((enrollment) =>
    ["active", "trialing"].includes(enrollment.subscriptionStatus?.trim().toLowerCase() ?? "")
  )
  const cheerBillingByTeamId = new Map(
    cheerBilling.map((team) => [team.teamId, team])
  )
  const recurringPriceIds = [
    ...activeEnrollments.map((enrollment) => enrollment.stripePriceId),
    ...activeCheerEnrollments.flatMap((enrollment) => {
      const team = enrollment.teamId
        ? cheerBillingByTeamId.get(enrollment.teamId)
        : null

      return [team?.tuitionPriceId ?? null, team?.feePriceId ?? null]
    }),
  ]

  if (!recurringPriceIds.length) {
    return 0
  }

  if (
    recurringPriceIds.some((priceId) => !priceId) ||
    !process.env.STRIPE_SECRET_KEY
  ) {
    return null
  }

  try {
    const stripe = getStripe()
    const validRecurringPriceIds = recurringPriceIds.filter(
      (priceId): priceId is string => Boolean(priceId)
    )
    const priceIds = Array.from(new Set(validRecurringPriceIds))
    const prices = await Promise.all(
      priceIds.map((priceId) => stripe.prices.retrieve(priceId))
    )
    const monthlyAmountByPriceId = new Map(
      prices.map((price) => [
        price.id,
        price.recurring?.interval === "month" ? price.unit_amount ?? 0 : 0,
      ])
    )
    const monthlyChargeAmounts = validRecurringPriceIds
      .map((priceId) => monthlyAmountByPriceId.get(priceId) ?? 0)
      .filter((amount) => amount > 0)
    const grossCents = monthlyChargeAmounts.reduce(
      (total, amount) => total + amount,
      0
    )

    return deductEstimatedRecurringRevenueFees(
      grossCents,
      monthlyChargeAmounts.length
    )
  } catch (error) {
    console.error("Unable to estimate Stripe monthly recurring revenue.", error)
    return null
  }
}

function buildMetrics(
  parents: ParentRecord[],
  enrollments: EnrollmentDisplayRecord[],
  mrrCents: number | null
) {
  const statusCount = (statuses: string[]) =>
    enrollments.filter((enrollment) =>
      statuses.includes(enrollment.status.toLowerCase())
    ).length
  return {
    parentAccounts: {
      label: "Parent accounts",
      value: String(parents.length),
      detail: "Total parent records",
    },
    approvedActive: {
      label: "Approved / active",
      value: String(statusCount(["approved", "active"])),
      detail: "Ready for payment or currently active",
    },
    deniedCanceled: {
      label: "Denied / canceled",
      value: String(statusCount(["denied", "canceled"])),
      detail: "Not moving forward",
    },
    monthlyRecurringRevenue: buildRecurringRevenueMetric(mrrCents),
  } satisfies AdminDashboardMetrics
}

function buildReviewQueueAction(enrollments: EnrollmentStatusRecord[]) {
  const pending = enrollments.filter(
    (enrollment) => enrollment.status.toLowerCase() === "pending"
  ).length

  return {
    label: "Review queue",
    value: String(pending),
    detail: pending
      ? "Enrollment requests need a decision"
      : "No requests waiting",
    tone: pending ? "warning" : "success",
  } satisfies OperationsActionItem
}

function buildActionItems(
  enrollments: EnrollmentDisplayRecord[],
  classBilling: ClassBillingRecord[],
  cheerBilling: CheerBillingRecord[]
) {
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
      (!teamRecord.tuitionPriceId ||
        !teamRecord.feePriceId ||
        !teamRecord.billingDay ||
        !teamRecord.programType)
  ).length

  return [
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

// Reuse the same builders across focused pages and the complete dashboard.
async function fetchClassWorkspaceData() {
  const [enrollmentRows, classes, classScheduleRows, scheduleSeasonRows] =
    await Promise.all([
      fetchEnrollments(),
      fetchClasses(),
      fetchClassScheduleRows(),
      fetchScheduleSeasons(),
    ])
  const enrollments = enrollmentRows.map(toDisplayEnrollment)
  const classBilling = buildClassBillingRows(classes)
  const classNameById = buildClassNameById(classBilling)
  const scheduleSeasons = buildScheduleSeasonRows(scheduleSeasonRows)
  const scheduleSeasonById = new Map(
    scheduleSeasons.map((scheduleSeason) => [
      scheduleSeason.seasonId,
      scheduleSeason,
    ])
  )
  const enrollmentCountBySchedule = buildEnrollmentCountBySchedule(enrollments)
  const athleteNamesBySchedule = buildAthleteNamesBySchedule(enrollments)
  const classSchedules = buildClassScheduleRows(
    classScheduleRows,
    classNameById,
    scheduleSeasonById,
    enrollmentCountBySchedule,
    athleteNamesBySchedule
  )

  return { enrollments, classBilling, classNameById, scheduleSeasons, classSchedules }
}

async function fetchCheerWorkspaceData() {
  const [cheerEnrollmentRows, cheerTeams, cheerScheduleRows] = await Promise.all([
    fetchCheerEnrollments(),
    fetchCheerTeams(),
    fetchCheerScheduleRows(),
  ])
  const cheerBilling = buildCheerBillingRows(cheerTeams)
  const cheerTeamNameById = buildCheerTeamNameById(cheerBilling)
  const cheerSchedules = buildCheerScheduleRows(
    cheerScheduleRows,
    cheerTeamNameById,
    buildCheerScheduleRosterCounts(cheerEnrollmentRows, cheerScheduleRows)
  )

  return { cheerEnrollmentRows, cheerBilling, cheerTeamNameById, cheerSchedules }
}

function buildCheerEnrollments(
  enrollmentRows: CheerEnrollmentRecord[],
  athletes: AthleteRecord[],
  parentById: Map<string, ParentRecord>,
  teamNameById: Map<string, string>,
  schedules: CheerScheduleDisplayRecord[]
) {
  const athleteById = new Map(
    athletes.map((athlete) => [String(athlete.athlete_id), athlete])
  )
  const scheduleById = new Map(
    schedules.map((schedule) => [schedule.scheduleId, schedule])
  )

  return enrollmentRows.map((enrollment) =>
    toDisplayCheerEnrollment(enrollment, {
      athleteById,
      parentById,
      teamNameById,
      scheduleById,
    })
  )
}

export async function getAdminBillingData(): Promise<
  Pick<AdminDashboardData, "classBilling" | "cheerBilling">
> {
  const [classes, teams] = await Promise.all([fetchClasses(), fetchCheerTeams()])

  return {
    classBilling: buildClassBillingRows(classes),
    cheerBilling: buildCheerBillingRows(teams),
  }
}

export async function getAdminSchedulesData(): Promise<
  Pick<AdminDashboardData,
    "classBilling" | "cheerBilling" | "scheduleSeasons" | "classSchedules" | "cheerSchedules"
  >
> {
  const [classData, cheerData] = await Promise.all([
    fetchClassWorkspaceData(),
    fetchCheerWorkspaceData(),
  ])

  return {
    classBilling: classData.classBilling,
    cheerBilling: cheerData.cheerBilling,
    scheduleSeasons: classData.scheduleSeasons,
    classSchedules: classData.classSchedules,
    cheerSchedules: cheerData.cheerSchedules,
  }
}

export async function getAdminEnrollmentsData(): Promise<
  Pick<AdminDashboardData,
    "allEnrollments" | "cheerEnrollments" | "enrollmentAthletes" | "classSchedules" | "cheerBilling"
  >
> {
  const [parents, athletes, classData, cheerData] = await Promise.all([
    fetchParents(),
    fetchAthletes(),
    fetchClassWorkspaceData(),
    fetchCheerWorkspaceData(),
  ])

  return {
    allEnrollments: classData.enrollments,
    cheerEnrollments: buildCheerEnrollments(
      cheerData.cheerEnrollmentRows,
      athletes,
      new Map(parents.map((parent) => [String(parent.parent_id), parent])),
      cheerData.cheerTeamNameById,
      cheerData.cheerSchedules
    ),
    enrollmentAthletes: buildAdminEnrollmentAthleteOptions(athletes),
    classSchedules: classData.classSchedules,
    cheerBilling: cheerData.cheerBilling,
  }
}

export async function getClassSessionReviewData(): Promise<ClassSessionDisplayRecord[]> {
  const [classData, sessionRows, attendanceRows] = await Promise.all([
    fetchClassWorkspaceData(),
    fetchClassSessionRows(),
    fetchClassSessionAttendanceRows(),
  ])

  return buildClassSessionRows({
    sessionRows,
    schedules: classData.classSchedules,
    classNameById: classData.classNameById,
    enrollments: classData.enrollments,
    attendanceRows,
  })
}

export async function getAdminSessionsData(): Promise<
  Pick<AdminDashboardData, "classSessions" | "cheerSessions">
> {
  const [classSessions, teams, scheduleRows, sessionRows] = await Promise.all([
    getClassSessionReviewData(),
    fetchCheerTeams(),
    fetchCheerScheduleRows(),
    fetchCheerSessionRows(),
  ])
  const teamNameById = buildCheerTeamNameById(buildCheerBillingRows(teams))

  return {
    classSessions,
    cheerSessions: buildCheerSessionRows({
      sessionRows,
      schedules: buildCheerScheduleRows(scheduleRows, teamNameById),
      teamNameById,
    }),
  }
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [
    parents,
    athletes,
    classData,
    cheerData,
    classSessionRows,
    cheerSessionRows,
    classSessionAttendanceRows,
    timeClockReview,
  ] = await Promise.all([
    fetchParents(),
    fetchAthletes(),
    fetchClassWorkspaceData(),
    fetchCheerWorkspaceData(),
    fetchClassSessionRows(),
    fetchCheerSessionRows(),
    fetchClassSessionAttendanceRows(),
    getAdminTimeClockReviewData(),
  ])
  const { enrollments, classBilling, classNameById, scheduleSeasons, classSchedules } = classData
  const { cheerEnrollmentRows, cheerBilling, cheerTeamNameById, cheerSchedules } = cheerData
  const parentById = new Map(
    parents.map((parent) => [String(parent.parent_id), parent])
  )
  const cheerEnrollments = buildCheerEnrollments(
    cheerEnrollmentRows,
    athletes,
    parentById,
    cheerTeamNameById,
    cheerSchedules
  )
  const enrollmentStatusRecords: EnrollmentStatusRecord[] = [
    ...enrollments,
    ...cheerEnrollments,
  ]
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
  const mrrCents = await estimateMonthlyRecurringRevenue(
    enrollments,
    cheerEnrollments,
    cheerBilling
  )

  return {
    reportingGeneratedAt: new Date().toISOString(),
    metrics: buildMetrics(parents, enrollments, mrrCents),
    reviewQueue: buildReviewQueueAction(enrollmentStatusRecords),
    actionItems: buildActionItems(enrollments, classBilling, cheerBilling),
    allEnrollments: enrollments,
    cheerEnrollments,
    enrollmentAthletes: buildAdminEnrollmentAthleteOptions(athletes),
    reportingParents: buildReportingParents(parents),
    reportingAthletes: buildReportingAthletes(athletes, parentById),
    classBilling,
    cheerBilling,
    scheduleSeasons,
    classSchedules,
    cheerSchedules,
    classSessions,
    cheerSessions,
    timeClockReview,
    statusBreakdown: buildStatusBreakdown(enrollmentStatusRecords),
    enrollmentTrend: buildEnrollmentTrend(enrollments, cheerEnrollments),
    programBreakdown: buildProgramBreakdown(enrollments, cheerEnrollments),
  }
}

export async function getAdminReportingData(): Promise<AdminReportingData> {
  requireAdminSession(await getAccountSession())
  const data = await getAdminDashboardData()

  return {
    reportingGeneratedAt: data.reportingGeneratedAt,
    metrics: data.metrics,
    allEnrollments: data.allEnrollments,
    cheerEnrollments: data.cheerEnrollments,
    reportingParents: data.reportingParents,
    reportingAthletes: data.reportingAthletes,
    classBilling: data.classBilling,
    cheerBilling: data.cheerBilling,
    scheduleSeasons: data.scheduleSeasons,
    classSchedules: data.classSchedules,
    cheerSchedules: data.cheerSchedules,
    classSessions: data.classSessions,
    cheerSessions: data.cheerSessions,
    timeClockReview: data.timeClockReview,
    statusBreakdown: data.statusBreakdown,
    enrollmentTrend: data.enrollmentTrend,
    programBreakdown: data.programBreakdown,
  }
}

export async function getCheerTryoutRequestData(userId: string) {
  const [athletes, teams] = await Promise.all([
    fetchParentAthletes(userId),
    fetchCheerTeams(),
  ])
  const blockedCheerEnrollments = await fetchBlockedCheerEnrollments(
    athletes.map((athlete) => String(athlete.athlete_id))
  )
  const blockedTeamIdsByAthleteId = blockedCheerEnrollments.reduce(
    (teamIdsByAthleteId, enrollment) => {
      if (
        enrollment.athlete_id === null ||
        enrollment.athlete_id === undefined ||
        enrollment.team_id === null ||
        enrollment.team_id === undefined
      ) {
        return teamIdsByAthleteId
      }

      const athleteId = String(enrollment.athlete_id)
      const teamIds = teamIdsByAthleteId.get(athleteId) ?? new Set<string>()
      teamIds.add(String(enrollment.team_id))
      teamIdsByAthleteId.set(athleteId, teamIds)

      return teamIdsByAthleteId
    },
    new Map<string, Set<string>>()
  )

  return {
    athletes: athletes.map((athlete) => ({
      athleteId: String(athlete.athlete_id),
      athleteName:
        [athlete.first_name, athlete.last_name].filter(Boolean).join(" ") ||
        `Athlete #${athlete.athlete_id}`,
      blockedCheerTeamIds: Array.from(
        blockedTeamIdsByAthleteId.get(String(athlete.athlete_id)) ?? []
      ),
    })),
    teams: teams.map((team) => ({
      teamId: String(team.team_id),
      teamName: team.team_name?.trim() || `Team #${team.team_id}`,
    })),
  }
}

export async function getClassRegistrationRequestData(userId: string) {
  const athletes = await fetchParentAthletes(userId)

  return {
    blockedEnrollmentAthleteIds: await fetchBlockedClassEnrollmentAthleteIds(
      athletes.map((athlete) => String(athlete.athlete_id))
    ),
  }
}

export async function getCoachDashboardData(
  userId: string
): Promise<CoachDashboardData> {
  const [classSessions, timeClock] = await Promise.all([
    getClassSessionReviewData(),
    getCoachTimeClockData(userId),
  ])

  return { classSessions, timeClock }
}

export async function getParentAthleteEnrollments(
  userId: string
): Promise<{
  athletes: ParentAthleteEnrollment[]
  classOptions: ClassOption[]
}> {
  const [
    athletes,
    classes,
    classScheduleRows,
    scheduleSeasonRows,
    cheerTeams,
    cheerScheduleRows,
  ] =
    await Promise.all([
      fetchParentAthletes(userId),
      fetchClasses(),
      fetchClassScheduleRows(),
      fetchScheduleSeasons(),
      fetchCheerTeams(),
      fetchCheerScheduleRows(),
    ])
  const athleteIds = athletes.map((athlete) => String(athlete.athlete_id))
  const [parentEnrollmentRows, parentCheerEnrollmentRows] = await Promise.all([
    fetchParentEnrollments(athleteIds),
    fetchParentCheerEnrollments(athleteIds),
  ])
  const enrollments = parentEnrollmentRows.map(toDisplayEnrollment)
  const cheerBilling = buildCheerBillingRows(cheerTeams)
  const cheerTeamNameById = buildCheerTeamNameById(cheerBilling)
  const cheerSchedules = buildCheerScheduleRows(
    cheerScheduleRows,
    cheerTeamNameById
  )
  const athleteById = new Map(
    athletes.map((athlete) => [String(athlete.athlete_id), athlete])
  )
  const cheerScheduleById = new Map(
    cheerSchedules.map((schedule) => [schedule.scheduleId, schedule])
  )
  const cheerEnrollments = parentCheerEnrollmentRows.map((enrollment) =>
    toDisplayCheerEnrollment(enrollment, {
      athleteById,
      parentById: new Map(),
      teamNameById: cheerTeamNameById,
      scheduleById: cheerScheduleById,
    })
  )
  const scheduleSeasons = buildScheduleSeasonRows(scheduleSeasonRows)
  const activeSeasonScheduleRows = filterActiveSeasonScheduleRows(
    classScheduleRows,
    scheduleSeasons
  )

  return {
    athletes: athletes.map((athlete) => {
      const athleteId = String(athlete.athlete_id)
      const athleteName = [athlete.first_name, athlete.last_name]
        .filter(Boolean)
        .join(" ")
      const athleteCheerEnrollments = cheerEnrollments.filter(
        (enrollment) => enrollment.athleteId === athleteId
      )
      const classPaymentWaived = athleteCheerEnrollments.some(
        isClassPaymentWaiverCheerEnrollment
      )

      return {
        athleteId,
        athleteName: athleteName || "Unnamed athlete",
        enrollments: enrollments
          .filter((enrollment) => enrollment.athleteId === athleteId)
          .map((enrollment) => classPaymentWaived
            ? { ...enrollment, paymentStatus: "payment_not_required" }
            : enrollment),
        cheerEnrollments: athleteCheerEnrollments,
      }
    }),
    classOptions: buildClassOptions(classes, activeSeasonScheduleRows),
  }
}
