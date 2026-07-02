import "server-only"

import Stripe from "stripe"

import { getAccountSession, getParentForUser } from "@/lib/account/auth"
import { resolveBillingDay } from "@/lib/account/data"
import type {
  AthleteRecord,
  ClassRecord,
  EnrollmentRecord,
  ParentRecord,
} from "@/lib/account/types"
import { createAdminClient } from "@/lib/supabase/admin"
import { getPeriodDate } from "@/lib/stripe/server"

const paymentEnrollmentSelect = `
  enrollment_id,
  class_id,
  athlete_id,
  status,
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
    Parents(parent_id, user_id, first_name, last_name, email, stripe_customer_id)
  ),
  Classes(class_id, class_name, type, program_type, billing_day, stripe_price_id)
`

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
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

export type ParentEnrollmentPaymentContext = {
  userId: string
  enrollment: EnrollmentRecord
  athlete: AthleteRecord
  parent: ParentRecord
  classRecord: ClassRecord
}

export async function getParentEnrollmentPaymentContext(
  enrollmentId: string
): Promise<ParentEnrollmentPaymentContext> {
  const session = await getAccountSession()

  if (!session?.userId) {
    throw new Error("You must be signed in.")
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("Enrollments")
    .select(paymentEnrollmentSelect)
    .eq("enrollment_id", enrollmentId)
    .maybeSingle()

  if (error) {
    throw new Error(
      "Enrollment billing columns are missing. Apply the enrollment billing migration before creating Stripe sessions."
    )
  }

  const enrollment = data as EnrollmentRecord | null

  if (!enrollment) {
    throw new Error("Enrollment was not found.")
  }

  const athlete = firstRelation(enrollment.Athletes)
  const classRecord = firstRelation(enrollment.Classes)

  if (!athlete) {
    throw new Error("Enrollment is missing its athlete record.")
  }

  if (!classRecord) {
    throw new Error("Enrollment is missing its class record.")
  }

  const parentFromRelationship = firstRelation(athlete.Parents)
  const parent =
    parentFromRelationship ?? (await getParentForUser(session.userId))

  if (!parent) {
    throw new Error("Parent account was not found.")
  }

  const athleteBelongsToUser =
    athlete.user_id === session.userId || parent.user_id === session.userId

  if (!athleteBelongsToUser) {
    throw new Error("This enrollment does not belong to your account.")
  }

  return {
    userId: session.userId,
    enrollment,
    athlete,
    parent,
    classRecord,
  }
}

export function ensureApprovedEnrollment(enrollment: EnrollmentRecord) {
  if (enrollment.status !== "approved") {
    throw new Error("Only approved enrollments can start a subscription.")
  }
}

export function ensureNoActiveSubscription(enrollment: EnrollmentRecord) {
  const activeStatuses = ["active", "trialing"]

  if (
    enrollment.stripe_subscription_id &&
    activeStatuses.includes(enrollment.subscription_status ?? "")
  ) {
    throw new Error("This enrollment already has an active subscription.")
  }
}

export function getClassBillingConfig(classRecord: ClassRecord) {
  const billingDay = resolveBillingDay(classRecord)
  const programType = normalizeProgramType(
    classRecord.program_type ?? classRecord.type ?? null
  )

  if (!classRecord.stripe_price_id) {
    throw new Error(
      "This class needs a Stripe monthly price ID before payments can start."
    )
  }

  if (billingDay !== 1 && billingDay !== 15) {
    throw new Error(
      "This class needs a program type or billing day before payments can start."
    )
  }

  const monthlyBillingDay: 1 | 15 = billingDay

  if (!programType) {
    throw new Error("This class needs a program type before payments can start.")
  }

  return {
    stripePriceId: classRecord.stripe_price_id,
    billingDay: monthlyBillingDay,
    programType,
  }
}

export async function saveStripeCustomerId({
  enrollmentId,
  parentId,
  stripeCustomerId,
}: {
  enrollmentId: string | number
  parentId: string | number
  stripeCustomerId: string
}) {
  const supabase = createAdminClient()

  const { error: parentError } = await supabase
    .from("Parents")
    .update({ stripe_customer_id: stripeCustomerId })
    .eq("parent_id", parentId)

  if (parentError) {
    throw new Error(parentError.message)
  }

  const { error } = await supabase
    .from("Enrollments")
    .update({ stripe_customer_id: stripeCustomerId })
    .eq("enrollment_id", enrollmentId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function updateEnrollmentFromSubscription({
  enrollmentId,
  customerId,
  subscription,
  paymentStatus,
}: {
  enrollmentId: string | number
  customerId?: string | null
  subscription: Stripe.Subscription
  paymentStatus?: string | null
}) {
  const supabase = createAdminClient()
  const period = {
    currentPeriodStart: null as string | null,
    currentPeriodEnd: null as string | null,
  }
  const subscriptionWithPeriod = subscription as Stripe.Subscription & {
    current_period_start?: number | null
    current_period_end?: number | null
  }
  const firstItem = subscription.items.data[0] as
    | (Stripe.SubscriptionItem & {
        current_period_start?: number | null
        current_period_end?: number | null
      })
    | undefined

  period.currentPeriodStart = getPeriodDate(
    subscriptionWithPeriod.current_period_start ??
      firstItem?.current_period_start
  )
  period.currentPeriodEnd = getPeriodDate(
    subscriptionWithPeriod.current_period_end ?? firstItem?.current_period_end
  )

  const { error } = await supabase
    .from("Enrollments")
    .update({
      stripe_customer_id:
        customerId ??
        (typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id),
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      current_period_start: period.currentPeriodStart,
      current_period_end: period.currentPeriodEnd,
      payment_status: paymentStatus ?? null,
    })
    .eq("enrollment_id", enrollmentId)

  if (error) {
    throw new Error(error.message)
  }
}
