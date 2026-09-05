import "server-only"

import Stripe from "stripe"

import { getAccountSession, getParentForUser } from "@/lib/account/auth"
import type {
  AthleteRecord,
  CheerEnrollmentRecord,
  CheerTeamRecord,
  ParentRecord,
} from "@/lib/account/types"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  getNextBillingAnchorUnix,
  getPeriodDate,
  getStripe,
} from "@/lib/stripe/server"
import { normalizeEnrollmentPaymentStatus } from "@/lib/account/payments"

type CheerSubscriptionRole = "tuition" | "fee"

type CheerEnrollmentBillingRow = CheerEnrollmentRecord & {
  payment_status?: string | null
}

export type ParentCheerEnrollmentPaymentContext = {
  userId: string
  enrollment: CheerEnrollmentRecord
  athlete: AthleteRecord
  parent: ParentRecord
  team: CheerTeamRecord
}

const activeSubscriptionStatuses = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
])

function getStripeId(value: string | { id: string } | null | undefined) {
  if (!value) {
    return null
  }

  return typeof value === "string" ? value : value.id
}

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
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

  return {
    currentPeriodStart: getPeriodDate(
      subscriptionWithPeriod.current_period_start ??
        firstItem?.current_period_start
    ),
    currentPeriodEnd: getPeriodDate(
      subscriptionWithPeriod.current_period_end ?? firstItem?.current_period_end
    ),
  }
}

function getCombinedSubscriptionStatus(
  tuitionSubscription: Stripe.Subscription,
  feeSubscription: Stripe.Subscription
) {
  const statuses = [tuitionSubscription.status, feeSubscription.status]

  if (statuses.every((status) => activeSubscriptionStatuses.has(status))) {
    return statuses.includes("trialing") ? "trialing" : "active"
  }

  const problemStatus = [
    "past_due",
    "unpaid",
    "incomplete",
    "paused",
  ].find((status) => statuses.includes(status as Stripe.Subscription.Status))

  if (problemStatus) {
    return problemStatus
  }

  if (statuses.every((status) => status === "canceled")) {
    return "canceled"
  }

  return statuses.find((status) => !activeSubscriptionStatuses.has(status)) ?? "inactive"
}

function getEnrollmentLifecycleStatus(
  tuitionSubscription: Stripe.Subscription,
  feeSubscription: Stripe.Subscription
) {
  if (
    activeSubscriptionStatuses.has(tuitionSubscription.status) &&
    activeSubscriptionStatuses.has(feeSubscription.status)
  ) {
    return "active"
  }

  if (
    tuitionSubscription.status === "canceled" &&
    feeSubscription.status === "canceled"
  ) {
    return "canceled"
  }

  return "inactive"
}

function getCheerSubscriptionRole(
  subscription: Stripe.Subscription
): CheerSubscriptionRole | null {
  const role = subscription.metadata?.subscription_role
  return role === "tuition" || role === "fee" ? role : null
}

export async function getParentCheerEnrollmentPaymentContext(
  enrollmentId: string
): Promise<ParentCheerEnrollmentPaymentContext> {
  const session = await getAccountSession()

  if (!session?.userId) {
    throw new Error("You must be signed in.")
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("CheerEnrollments")
    .select(
      "enrollment_id,athlete_id,team_id,parent_id,status,stripe_customer_id,tuition_subscription_id,fee_subscription_id,subscription_status,current_period_start,current_period_end,payment_status"
    )
    .eq("enrollment_id", enrollmentId)
    .maybeSingle()

  if (error) {
    throw new Error(
      "Cheer enrollment billing columns are missing. Apply the cheer billing migration before creating Stripe sessions."
    )
  }

  const enrollment = data as CheerEnrollmentRecord | null

  if (!enrollment) {
    throw new Error("Cheer enrollment was not found.")
  }

  if (!enrollment.athlete_id || !enrollment.team_id) {
    throw new Error("Cheer enrollment is missing its athlete or team record.")
  }

  const [{ data: athleteData, error: athleteError }, { data: teamData, error: teamError }, parent] =
    await Promise.all([
      supabase
        .from("Athletes")
        .select("athlete_id,user_id,parent_id,first_name,last_name")
        .eq("athlete_id", enrollment.athlete_id)
        .maybeSingle(),
      supabase
        .from("CheerTeams")
        .select(
          "team_id,team_name,type,program_type,tuition_price_id,fee_price_id"
        )
        .eq("team_id", enrollment.team_id)
        .maybeSingle(),
      getParentForUser(session.userId),
    ])

  if (athleteError || !athleteData) {
    throw new Error(athleteError?.message ?? "Athlete was not found.")
  }

  if (teamError || !teamData) {
    throw new Error(teamError?.message ?? "Cheer team was not found.")
  }

  if (!parent) {
    throw new Error("Parent account was not found.")
  }

  const athlete = athleteData as AthleteRecord
  const team = teamData as CheerTeamRecord
  const parentId = String(parent.parent_id)
  const enrollmentParentId = enrollment.parent_id
    ? String(enrollment.parent_id)
    : null
  const athleteParentId = athlete.parent_id ? String(athlete.parent_id) : null
  const athleteBelongsToUser =
    athlete.user_id === session.userId || athleteParentId === parentId

  if (
    !athleteBelongsToUser ||
    (enrollmentParentId !== null && enrollmentParentId !== parentId)
  ) {
    throw new Error("This cheer enrollment does not belong to your account.")
  }

  return {
    userId: session.userId,
    enrollment,
    athlete,
    parent,
    team,
  }
}

export function ensureApprovedCheerEnrollment(
  enrollment: CheerEnrollmentRecord
) {
  if (enrollment.status !== "approved") {
    throw new Error("Only approved cheer enrollments can start subscriptions.")
  }
}

export function ensureNoCheerSubscriptions(enrollment: CheerEnrollmentRecord) {
  if (
    enrollment.tuition_subscription_id ||
    enrollment.fee_subscription_id
  ) {
    throw new Error(
      "This cheer enrollment already has Stripe billing attached. Refresh the page or manage the existing subscriptions."
    )
  }
}

export function getCheerBillingConfig(team: CheerTeamRecord) {
  const tuitionPriceId = team.tuition_price_id?.trim()
  const feePriceId = team.fee_price_id?.trim()

  if (!tuitionPriceId || !feePriceId) {
    throw new Error(
      "This cheer team needs both tuition and cheer fee Stripe price IDs before payments can start."
    )
  }

  if (tuitionPriceId === feePriceId) {
    throw new Error(
      "The tuition and cheer fee must use different Stripe price IDs."
    )
  }

  return { tuitionPriceId, feePriceId }
}

export async function saveCheerStripeCustomerId({
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
    .from("CheerEnrollments")
    .update({ stripe_customer_id: stripeCustomerId })
    .eq("enrollment_id", enrollmentId)

  if (error) {
    throw new Error(error.message)
  }
}

async function persistCheerSubscriptions({
  enrollmentId,
  customerId,
  tuitionSubscription,
  feeSubscription,
  paymentStatus,
}: {
  enrollmentId: string | number
  customerId?: string | null
  tuitionSubscription: Stripe.Subscription
  feeSubscription: Stripe.Subscription
  paymentStatus?: string | null
}) {
  const supabase = createAdminClient()
  const combinedStatus = getCombinedSubscriptionStatus(
    tuitionSubscription,
    feeSubscription
  )
  const period = getSubscriptionPeriod(tuitionSubscription)
  const normalizedPaymentStatus =
    combinedStatus === "past_due" || combinedStatus === "unpaid"
      ? "payment_failed"
      : normalizeEnrollmentPaymentStatus(paymentStatus)
  const update = {
    stripe_customer_id:
      customerId ??
      getStripeId(tuitionSubscription.customer) ??
      getStripeId(feeSubscription.customer),
    tuition_subscription_id: tuitionSubscription.id,
    fee_subscription_id: feeSubscription.id,
    subscription_status: combinedStatus,
    current_period_start: period.currentPeriodStart,
    current_period_end: period.currentPeriodEnd,
    status: getEnrollmentLifecycleStatus(
      tuitionSubscription,
      feeSubscription
    ),
    ...(normalizedPaymentStatus
      ? { payment_status: normalizedPaymentStatus }
      : {}),
  }
  const { data, error } = await supabase
    .from("CheerEnrollments")
    .update(update)
    .eq("enrollment_id", enrollmentId)
    .select("enrollment_id")
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error(`Cheer enrollment ${enrollmentId} was not found.`)
  }
}

export async function finalizeCheerCheckout({
  enrollmentId,
  customerId,
  tuitionSubscription,
  feeSubscription,
  paymentStatus,
}: {
  enrollmentId: string | number
  customerId?: string | null
  tuitionSubscription: Stripe.Subscription
  feeSubscription: Stripe.Subscription
  paymentStatus?: string | null
}) {
  await persistCheerSubscriptions({
    enrollmentId,
    customerId,
    tuitionSubscription,
    feeSubscription,
    paymentStatus,
  })
}

async function getCheckoutPaymentMethodId({
  stripe,
  session,
  subscription,
  customerId,
}: {
  stripe: Stripe
  session: Stripe.Checkout.Session
  subscription: Stripe.Subscription
  customerId: string
}) {
  const subscriptionPaymentMethodId = getStripeId(
    subscription.default_payment_method
  )

  if (subscriptionPaymentMethodId) {
    return subscriptionPaymentMethodId
  }

  const setupIntentId = getStripeId(session.setup_intent)

  if (setupIntentId) {
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId)
    const setupPaymentMethodId = getStripeId(setupIntent.payment_method)

    if (setupPaymentMethodId) {
      return setupPaymentMethodId
    }
  }

  const customer = await stripe.customers.retrieve(customerId)

  if (!("deleted" in customer && customer.deleted)) {
    return getStripeId(customer.invoice_settings.default_payment_method)
  }

  return null
}

async function findExistingFeeSubscription({
  stripe,
  customerId,
  enrollmentId,
  checkoutSessionId,
}: {
  stripe: Stripe
  customerId: string
  enrollmentId: string
  checkoutSessionId: string
}) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  })

  return (
    subscriptions.data.find(
      (subscription) =>
        subscription.metadata?.enrollment_kind === "cheer" &&
        subscription.metadata?.cheer_enrollment_id === enrollmentId &&
        subscription.metadata?.subscription_role === "fee" &&
        subscription.metadata?.checkout_session_id === checkoutSessionId
    ) ?? null
  )
}

export async function splitAndFinalizeCheerCheckout({
  session,
  enrollmentId,
  tuitionPriceId,
  feePriceId,
}: {
  session: Stripe.Checkout.Session
  enrollmentId: string
  tuitionPriceId: string
  feePriceId: string
}) {
  const subscriptionId = getStripeId(session.subscription)
  const customerId = getStripeId(session.customer)

  if (!subscriptionId || !customerId) {
    throw new Error(
      "Completed cheer Checkout session is missing its subscription or customer."
    )
  }

  const stripe = getStripe()
  let tuitionSubscription = await stripe.subscriptions.retrieve(subscriptionId)
  const tuitionItems = tuitionSubscription.items.data.filter(
    (item) => item.price.id === tuitionPriceId
  )
  const feeItems = tuitionSubscription.items.data.filter(
    (item) => item.price.id === feePriceId
  )

  if (!tuitionItems.length) {
    throw new Error("The cheer Checkout subscription is missing tuition.")
  }

  await Promise.all(
    feeItems.map((item) =>
      stripe.subscriptionItems.del(
        item.id,
        {
          proration_behavior: "none",
        },
        {
          idempotencyKey: `cheer-remove-fee:${enrollmentId}:${item.id}`,
        }
      )
    )
  )

  if (feeItems.length) {
    tuitionSubscription = await stripe.subscriptions.retrieve(subscriptionId)
  }

  const paymentMethodId = await getCheckoutPaymentMethodId({
    stripe,
    session,
    subscription: tuitionSubscription,
    customerId,
  })

  if (paymentMethodId) {
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })
  }

  const existingFeeSubscription = await findExistingFeeSubscription({
    stripe,
    customerId,
    enrollmentId,
    checkoutSessionId: session.id,
  })
  const feeMetadata = {
    ...tuitionSubscription.metadata,
    enrollment_kind: "cheer",
    cheer_enrollment_id: enrollmentId,
    subscription_role: "fee",
    checkout_session_id: session.id,
  }
  const feeSubscription =
    existingFeeSubscription ??
    (await stripe.subscriptions.create(
      {
        customer: customerId,
        items: [{ price: feePriceId, quantity: 1 }],
        billing_cycle_anchor: getNextBillingAnchorUnix(15),
        proration_behavior: "none",
        ...(paymentMethodId
          ? { default_payment_method: paymentMethodId }
          : {}),
        metadata: feeMetadata,
      },
      {
        idempotencyKey: `cheer-fee-subscription:${enrollmentId}:${session.id}`,
      }
    ))

  await finalizeCheerCheckout({
    enrollmentId,
    customerId,
    tuitionSubscription,
    feeSubscription,
    paymentStatus: session.payment_status ?? null,
  })
}

function assertCompletedCheerCheckoutSession({
  session,
  enrollmentId,
  customerId,
}: {
  session: Stripe.Checkout.Session
  enrollmentId: string
  customerId: string
}) {
  if (session.status !== "complete") {
    throw new Error("The cheer Checkout session is not complete yet.")
  }

  if (
    session.metadata?.enrollment_kind !== "cheer" ||
    session.metadata.cheer_enrollment_id !== enrollmentId
  ) {
    throw new Error("The cheer Checkout session does not match this enrollment.")
  }

  if (getStripeId(session.customer) !== customerId) {
    throw new Error("The cheer Checkout session does not match this customer.")
  }

  if (
    !session.metadata.tuition_price_id ||
    !session.metadata.fee_price_id
  ) {
    throw new Error("The cheer Checkout session is missing billing metadata.")
  }
}

export async function finalizeCompletedCheerCheckoutSession({
  sessionId,
  enrollmentId,
  customerId,
}: {
  sessionId: string
  enrollmentId: string
  customerId: string
}) {
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.retrieve(sessionId)

  assertCompletedCheerCheckoutSession({
    session,
    enrollmentId,
    customerId,
  })

  await splitAndFinalizeCheerCheckout({
    session,
    enrollmentId,
    tuitionPriceId: session.metadata!.tuition_price_id!,
    feePriceId: session.metadata!.fee_price_id!,
  })
}

export async function recoverCompletedCheerCheckout({
  enrollmentId,
  customerId,
}: {
  enrollmentId: string
  customerId: string
}) {
  const stripe = getStripe()
  const sessions = await stripe.checkout.sessions.list({
    customer: customerId,
    status: "complete",
    limit: 100,
  })
  const session = sessions.data.find(
    (candidate) =>
      candidate.metadata?.enrollment_kind === "cheer" &&
      candidate.metadata.cheer_enrollment_id === enrollmentId &&
      Boolean(candidate.subscription)
  )

  if (!session) {
    return false
  }

  assertCompletedCheerCheckoutSession({
    session,
    enrollmentId,
    customerId,
  })

  await splitAndFinalizeCheerCheckout({
    session,
    enrollmentId,
    tuitionPriceId: session.metadata!.tuition_price_id!,
    feePriceId: session.metadata!.fee_price_id!,
  })

  return true
}

export async function findCheerEnrollmentIdBySubscription(
  subscriptionId: string
) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("CheerEnrollments")
    .select("enrollment_id")
    .or(
      `tuition_subscription_id.eq.${subscriptionId},fee_subscription_id.eq.${subscriptionId}`
    )
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data?.enrollment_id ? String(data.enrollment_id) : null
}

export async function updateCheerEnrollmentFromSubscription({
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
  const { data, error } = await supabase
    .from("CheerEnrollments")
    .select(
      "enrollment_id,tuition_subscription_id,fee_subscription_id,payment_status"
    )
    .eq("enrollment_id", enrollmentId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const enrollment = data as CheerEnrollmentBillingRow | null

  if (!enrollment) {
    throw new Error(`Cheer enrollment ${enrollmentId} was not found.`)
  }

  const role =
    getCheerSubscriptionRole(subscription) ??
    (enrollment.tuition_subscription_id === subscription.id
      ? "tuition"
      : enrollment.fee_subscription_id === subscription.id
        ? "fee"
        : null)

  if (!role) {
    return
  }

  const tuitionSubscriptionId =
    role === "tuition"
      ? subscription.id
      : enrollment.tuition_subscription_id ?? null
  const feeSubscriptionId =
    role === "fee" ? subscription.id : enrollment.fee_subscription_id ?? null

  if (!tuitionSubscriptionId || !feeSubscriptionId) {
    const { error: partialUpdateError } = await supabase
      .from("CheerEnrollments")
      .update({
        stripe_customer_id: customerId ?? getStripeId(subscription.customer),
        ...(role === "tuition"
          ? { tuition_subscription_id: subscription.id }
          : { fee_subscription_id: subscription.id }),
      })
      .eq("enrollment_id", enrollmentId)

    if (partialUpdateError) {
      throw new Error(partialUpdateError.message)
    }

    return
  }

  const stripe = getStripe()
  const [tuitionSubscription, feeSubscription] = await Promise.all([
    role === "tuition"
      ? subscription
      : stripe.subscriptions.retrieve(tuitionSubscriptionId),
    role === "fee"
      ? subscription
      : stripe.subscriptions.retrieve(feeSubscriptionId),
  ])

  await persistCheerSubscriptions({
    enrollmentId,
    customerId,
    tuitionSubscription,
    feeSubscription,
    paymentStatus: paymentStatus ?? enrollment.payment_status ?? null,
  })
}
