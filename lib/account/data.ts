import "server-only"

import { schedule } from "@/components/classes/class_schedules"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe/server"
import type {
  AdminDashboardData,
  AthleteRecord,
  ChartDatum,
  ClassRecord,
  EnrollmentDisplayRecord,
  EnrollmentMetric,
  EnrollmentRecord,
  ParentAthleteEnrollment,
  ParentRecord,
  TrendDatum,
} from "@/lib/account/types"

const enrollmentSelectWithPayments = `
  enrollment_id,
  class_id,
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
  Classes(class_id, class_name, type, program_type, billing_day, stripe_price_id)
`

const enrollmentSelectBase = `
  enrollment_id,
  class_id,
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
  Classes(class_id, class_name, type)
`

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function toId(value: string | number | null | undefined) {
  return value === null || value === undefined ? null : String(value)
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
  const classRecord = firstRelation(enrollment.Classes)
  const athleteName = [athlete?.first_name, athlete?.last_name]
    .filter(Boolean)
    .join(" ")
  const parentName = [parent?.first_name, parent?.last_name]
    .filter(Boolean)
    .join(" ")
  const className =
    classRecord?.class_name ?? getLocalClassName(enrollment.class_id)
  const programType = normalizeProgramType(
    classRecord?.program_type ?? classRecord?.type ?? null
  )

  return {
    enrollmentId: String(enrollment.enrollment_id),
    athleteId: toId(enrollment.athlete_id ?? athlete?.athlete_id),
    athleteName: athleteName || "Unknown athlete",
    parentName: parentName || "Unknown parent",
    parentEmail: parent?.email ?? null,
    classId: toId(enrollment.class_id ?? classRecord?.class_id),
    className,
    classType: classRecord?.type ?? null,
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
    .select("athlete_id,user_id,parent_id,first_name,last_name")

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as AthleteRecord[]
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
      label: "Active athletes",
      value: String(activeAthleteIds.size || athletes.length),
      detail: "Approved or active enrollment roster",
    },
    {
      label: "Parent accounts",
      value: String(parents.length),
      detail: "Total parent records",
    },
    {
      label: "Total enrollments",
      value: String(enrollments.length),
      detail: "All enrollment requests",
    },
    {
      label: "Pending enrollments",
      value: String(statusCount(["pending"])),
      detail: "Awaiting admin review",
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
    {
      label: "Active subscriptions",
      value: String(activeSubscriptions),
      detail: "Stripe subscription records on enrollments",
    },
    {
      label: "Monthly recurring revenue",
      value: mrrCents === null ? "Needs price IDs" : centsToCurrency(mrrCents),
      detail: "Estimated from active monthly Stripe prices",
    },
  ] satisfies EnrollmentMetric[]
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [parents, athletes, enrollmentRows] = await Promise.all([
    fetchParents(),
    fetchAthletes(),
    fetchEnrollments(),
  ])
  const enrollments = enrollmentRows.map(toDisplayEnrollment)
  const mrrCents = await estimateMonthlyRecurringRevenue(enrollments)

  return {
    metrics: buildMetrics(parents, athletes, enrollments, mrrCents),
    pendingEnrollments: enrollments.filter(
      (enrollment) => enrollment.status.toLowerCase() === "pending"
    ),
    statusBreakdown: buildStatusBreakdown(enrollments),
    monthlyTrend: buildMonthlyTrend(enrollments),
  }
}

export async function getParentAthleteEnrollments(
  userId: string
): Promise<ParentAthleteEnrollment[]> {
  const athletes = await fetchParentAthletes(userId)
  const athleteIds = athletes.map((athlete) => String(athlete.athlete_id))
  const enrollments = (await fetchParentEnrollments(athleteIds)).map(
    toDisplayEnrollment
  )

  return athletes.map((athlete) => {
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
  })
}
