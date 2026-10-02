import type {
  AdminDashboardData,
  AdminDashboardMetrics,
  CheerEnrollmentRecord,
} from "@/lib/account/types"

export type CsvValue = string | number | boolean | null | undefined
export type CsvRow = Record<string, CsvValue>
export type CoverageState = "subscribed" | "payment-not-required" | "attention" | "not-subscribed" | "unknown"

const activeStatuses = new Set(["active", "trialing"])
const endedStatuses = new Set(["canceled", "cancelled", "incomplete_expired"])
const attentionStatuses = new Set(["past_due", "unpaid", "incomplete", "paused"])
const paymentAttentionStatuses = new Set(["payment_failed", "past_due", "unpaid", "incomplete"])
const paymentNotRequiredStatuses = new Set(["payment_not_required", "no_payment_required"])
const endedEnrollmentStatuses = new Set(["denied", "canceled", "cancelled"])

export const coverageLabels: Record<CoverageState, string> = {
  subscribed: "Subscribed",
  "payment-not-required": "Payment not required",
  attention: "Needs attention",
  "not-subscribed": "Not subscribed",
  unknown: "Unknown",
}

export type SubscriptionRow = CsvRow & {
  Parent: string
  Athlete: string
  Program: string
  Offering: string
  "Enrollment status": string
  "Coverage state": string
  "Subscription status": string
  "Payment status": string
  "Subscription IDs": string
}

export type SubscriptionAuditRecord = {
  key: string
  coverageState: CoverageState
  exportRow: SubscriptionRow
}

export function buildSubscriptionAuditRecords(
  data: Pick<AdminDashboardData, "allEnrollments" | "cheerEnrollments">
): SubscriptionAuditRecord[] {
  // Class payments are waived only for the athlete with a current cheer enrollment.
  const cheerAthleteIds = new Set(data.cheerEnrollments
    .filter((enrollment) => !endedEnrollmentStatuses.has(enrollment.status?.trim().toLowerCase() ?? ""))
    .map((enrollment) => enrollment.athleteId)
    .filter(Boolean))

  return [
    ...data.allEnrollments.map((enrollment) => {
      const ids = [enrollment.stripeSubscriptionId]
      const paymentStatus = enrollment.athleteId &&
        cheerAthleteIds.has(enrollment.athleteId) &&
        !endedEnrollmentStatuses.has(enrollment.status?.trim().toLowerCase() ?? "")
        ? "payment_not_required"
        : enrollment.paymentStatus
      const coverageState = getCoverageState({ ...enrollment, paymentStatus, subscriptionIds: ids })

      return {
        key: `class:${enrollment.enrollmentId}`,
        coverageState,
        exportRow: {
          "Program type": "Class",
          "Enrollment ID": enrollment.enrollmentId,
          Parent: enrollment.parentName,
          "Parent email": enrollment.parentEmail,
          "Parent phone": enrollment.parentPhone,
          Athlete: enrollment.athleteName,
          Program: enrollment.programType ?? "",
          Offering: enrollment.className,
          Schedule: enrollment.scheduleLabel,
          "Enrollment status": enrollment.status,
          "Coverage state": coverageLabels[coverageState],
          "Billing data available": enrollment.billingDataAvailable,
          "Subscription status": enrollment.subscriptionStatus ?? "",
          "Payment status": paymentStatus ?? "",
          "Stripe customer ID": enrollment.stripeCustomerId,
          "Subscription IDs": ids.filter(Boolean).join("; "),
          "Billing day": enrollment.billingDay,
          "Current period start": enrollment.currentPeriodStart,
          "Current period end": enrollment.currentPeriodEnd,
          "Created at": enrollment.createdAt,
        },
      }
    }),
    ...data.cheerEnrollments.map((enrollment) => {
      const ids = [enrollment.tuitionSubscriptionId, enrollment.feeSubscriptionId]
      const coverageState = getCoverageState({ ...enrollment, subscriptionIds: ids })

      return {
        key: `cheer:${enrollment.enrollmentId}`,
        coverageState,
        exportRow: {
          "Program type": "Cheer",
          "Enrollment ID": enrollment.enrollmentId,
          Parent: enrollment.parentName,
          "Parent email": enrollment.parentEmail,
          "Parent phone": enrollment.parentPhone,
          Athlete: enrollment.athleteName,
          Program: "Competitive cheer",
          Offering: enrollment.teamName,
          Schedule: enrollment.scheduleLabel,
          "Enrollment status": enrollment.status,
          "Coverage state": coverageLabels[coverageState],
          "Billing data available": enrollment.billingDataAvailable,
          "Subscription status": enrollment.subscriptionStatus ?? "",
          "Payment status": enrollment.paymentStatus ?? "",
          "Stripe customer ID": enrollment.stripeCustomerId,
          "Subscription IDs": ids.filter(Boolean).join("; "),
          "Billing day": "1st & 15th",
          "Current period start": enrollment.currentPeriodStart,
          "Current period end": enrollment.currentPeriodEnd,
          "Created at": enrollment.createdAt,
        },
      }
    }),
  ]
}

export function getCoverageState({
  billingDataAvailable,
  paymentStatus,
  subscriptionStatus,
  subscriptionIds,
}: {
  billingDataAvailable: boolean
  paymentStatus?: string | null
  subscriptionStatus: string | null
  subscriptionIds: Array<string | null>
}): CoverageState {
  const payment = paymentStatus?.trim().toLowerCase() ?? ""
  if (paymentNotRequiredStatuses.has(payment)) {
    return "payment-not-required"
  }

  if (!billingDataAvailable) {
    return "unknown"
  }

  const status = subscriptionStatus?.trim().toLowerCase() ?? ""
  const hasAnySubscription = subscriptionIds.some((id) => Boolean(id?.trim()))
  const hasEverySubscription =
    subscriptionIds.length > 0 && subscriptionIds.every((id) => Boolean(id?.trim()))

  if (paymentAttentionStatuses.has(payment)) {
    return "attention"
  }

  if (endedStatuses.has(status)) {
    return "not-subscribed"
  }

  if (activeStatuses.has(status)) {
    return hasEverySubscription ? "subscribed" : "attention"
  }

  if (attentionStatuses.has(status) || (status === "inactive" && hasAnySubscription)) {
    return "attention"
  }

  if (!status && !hasAnySubscription) {
    return "not-subscribed"
  }

  return "unknown"
}

export function hasBillingData(
  record: object,
  requiredFields: readonly string[]
) {
  return requiredFields.every((field) =>
    Object.prototype.hasOwnProperty.call(record, field)
  )
}

export function buildRecurringRevenueMetric(
  amountCents: number | null
): AdminDashboardMetrics["monthlyRecurringRevenue"] {
  return {
    label: "Monthly recurring revenue",
    amountCents,
    available: amountCents !== null,
    value: amountCents === null
      ? "Unavailable"
      : new Intl.NumberFormat("en-US", {
          minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        }).format(amountCents / 100),
    detail: amountCents === null
      ? "Monthly revenue is unavailable because billing data or Stripe pricing could not be verified"
      : "After 3.6% Stripe, 1.5% platform, and $0.30/charge fees",
  }
}

export function escapeCsvValue(value: CsvValue) {
  if (value === null || value === undefined) {
    return ""
  }

  // Numeric credits stay numeric; only untrusted text needs formula protection.
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : ""
  }

  let text = String(value)
  if (typeof value === "string" && /^[=+\-@]/.test(text.trimStart())) {
    text = `'${text}`
  }

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function serializeCsv(rows: CsvRow[]) {
  // Explicit union preserves fields even when a report combines different row types.
  const columnNames = new Set<string>()
  for (const row of rows) {
    for (const column of Object.keys(row)) {
      columnNames.add(column)
    }
  }
  const columns = Array.from(columnNames)
  return [
    columns.map(escapeCsvValue).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(",")),
  ].join("\r\n")
}

export function buildCheerScheduleRosterCounts(
  enrollments: Pick<CheerEnrollmentRecord,
    "enrollment_id" | "athlete_id" | "schedule_id" | "team_id" | "status"
  >[],
  schedules: { schedule_id: string | number; team_id?: string | number | null }[]
) {
  const bySchedule = new Map<string, Set<string>>()
  const byTeam = new Map<string, Set<string>>()

  for (const enrollment of enrollments) {
    if (!["approved", "active"].includes(enrollment.status?.trim().toLowerCase() ?? "")) {
      continue
    }

    const key = enrollment.schedule_id ?? enrollment.team_id
    if (key === null || key === undefined) {
      continue
    }

    // Enrollments with no selected practice attend their team's practice schedule.
    const index = enrollment.schedule_id == null ? byTeam : bySchedule
    const athletes = index.get(String(key)) ?? new Set<string>()
    const athleteKey = enrollment.athlete_id == null
      ? `enrollment:${enrollment.enrollment_id}`
      : `athlete:${enrollment.athlete_id}`
    athletes.add(athleteKey)
    index.set(String(key), athletes)
  }

  return new Map(schedules.map((schedule) => {
    const scheduleId = String(schedule.schedule_id)
    const teamAthletes = schedule.team_id == null
      ? []
      : byTeam.get(String(schedule.team_id)) ?? []

    return [scheduleId, new Set([
      ...(bySchedule.get(scheduleId) ?? []),
      ...teamAthletes,
    ]).size]
  }))
}
