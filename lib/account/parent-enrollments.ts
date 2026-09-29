export type ParentEnrollmentPaymentRow = {
  status?: string | null
  payment_status?: string | null
  subscription_status?: string | null
  stripe_subscription_id?: string | null
  tuition_subscription_id?: string | null
  fee_subscription_id?: string | null
}

export type ParentAthleteEnrollment = {
  enrollmentId: string
  scheduleId: string | null
  classId: string | null
  className: string
  classType: string | null
  scheduleLabel: string | null
  status: string
  paymentStatus: string
}

export type ParentAthleteCheerEnrollment = {
  enrollmentId: string
  teamId: string | null
  teamName: string
  scheduleId: string | null
  scheduleLabel: string | null
  status: string
  paymentStatus: string
}

export type ParentAthleteSummary = {
  athleteId: string
  firstName: string | null
  lastName: string | null
  dob: string | null
  shirtSize: string | null
  enrollments: ParentAthleteEnrollment[]
  cheerEnrollments: ParentAthleteCheerEnrollment[]
}

function normalizeStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase()
}

export function isCurrentParentEnrollment(enrollment: ParentEnrollmentPaymentRow) {
  return !["denied", "canceled", "cancelled"].includes(normalizeStatus(enrollment.status))
}

export function getEnrollmentPaymentStatus(
  enrollment: ParentEnrollmentPaymentRow,
  kind: "class" | "cheer",
  hasCheerEnrollment = false
) {
  if (kind === "class" && hasCheerEnrollment) {
    return "payment_not_required"
  }

  const billingStatuses = [enrollment.payment_status, enrollment.subscription_status]
    .map(normalizeStatus)

  if (billingStatuses.some((status) =>
    ["payment_failed", "past_due", "unpaid", "incomplete"].includes(status)
  )) {
    return "payment_failed"
  }

  const hasSubscriptions = kind === "cheer"
    ? Boolean(enrollment.tuition_subscription_id && enrollment.fee_subscription_id)
    : Boolean(enrollment.stripe_subscription_id)

  if (normalizeStatus(enrollment.status) === "approved" && !hasSubscriptions) {
    return "ready_to_pay"
  }

  if (billingStatuses.some((status) => ["paid", "active", "trialing"].includes(status))) {
    return "paid"
  }

  return normalizeStatus(enrollment.status) === "pending" ? "pending" : "not_started"
}

export function getParentPaymentStatus(athletes: ParentAthleteSummary[]) {
  const statuses = athletes.flatMap((athlete) => [
    ...athlete.enrollments.map((enrollment) => enrollment.paymentStatus),
    ...athlete.cheerEnrollments.map((enrollment) => enrollment.paymentStatus),
  ])

  if (!statuses.length) {
    return "no_enrollments"
  }

  for (const status of ["payment_failed", "ready_to_pay", "pending", "paid", "not_started"]) {
    if (statuses.includes(status)) {
      return status
    }
  }

  return "payment_not_required"
}
