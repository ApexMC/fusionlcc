import "server-only"

import {
  finalizeCompletedCheerCheckoutSession,
  getParentCheerEnrollmentPaymentContext,
} from "@/lib/account/cheer-payments"
import {
  getParentEnrollmentPaymentContext,
  updateEnrollmentFromSubscription,
} from "@/lib/account/payments"
import { getStripe } from "@/lib/stripe/server"

type CheckoutReference = {
  kind: "class" | "cheer"
  enrollmentId: string
  sessionId: string
}

export type CheckoutConfirmation = {
  athleteName: string
  programName: string
  kind: CheckoutReference["kind"]
  classSubscriptionsCanceled: boolean
  classPaymentWaived: boolean
}

export function getCheckoutConfirmationPath({
  kind,
  enrollmentId,
  sessionId,
}: CheckoutReference) {
  const params = new URLSearchParams({ kind, enrollment: enrollmentId, session_id: sessionId })
  // Stripe substitutes this literal placeholder when it redirects from Checkout.
  return `/account/checkout-confirmation?${params.toString().replace(
    "%7BCHECKOUT_SESSION_ID%7D",
    "{CHECKOUT_SESSION_ID}"
  )}`
}

function getStripeId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id
}

export async function getCheckoutConfirmation({
  kind,
  enrollmentId,
  sessionId,
}: CheckoutReference): Promise<CheckoutConfirmation> {
  if (kind === "cheer") {
    const context = await getParentCheerEnrollmentPaymentContext(enrollmentId)
    const customerId = context.enrollment.stripe_customer_id ?? context.parent.stripe_customer_id

    if (
      context.enrollment.status === "canceled" ||
      context.enrollment.subscription_status === "canceled"
    ) {
      throw new Error("This cheer subscription has been cancelled.")
    }

    if (!customerId) {
      throw new Error("The cheer enrollment is missing its Stripe customer.")
    }

    const result = await finalizeCompletedCheerCheckoutSession({ sessionId, enrollmentId, customerId })
    return {
      kind,
      athleteName: [context.athlete.first_name, context.athlete.last_name].filter(Boolean).join(" "),
      programName: context.team.team_name ?? "Competitive cheer",
      classSubscriptionsCanceled: result.classSubscriptionsCanceled,
      classPaymentWaived: false,
    }
  }

  // Resolve ownership before retrieving or changing any Stripe records.
  const context = await getParentEnrollmentPaymentContext(enrollmentId)
  const customerId = context.enrollment.stripe_customer_id ?? context.parent.stripe_customer_id
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  const subscriptionId = getStripeId(session.subscription)

  if (
    session.status !== "complete" ||
    !["paid", "no_payment_required"].includes(session.payment_status)
  ) {
    throw new Error("The Checkout session is not complete yet.")
  }

  if (
    session.metadata?.enrollment_kind === "cheer" ||
    session.metadata?.enrollment_id !== enrollmentId ||
    !customerId ||
    getStripeId(session.customer) !== customerId ||
    !subscriptionId
  ) {
    throw new Error("The Checkout session does not match this enrollment.")
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  if (getStripeId(subscription.customer) !== customerId) {
    throw new Error("The subscription does not match this customer.")
  }
  if (
    !["active", "trialing"].includes(subscription.status) &&
    !(context.enrollment.payment_status === "payment_not_required" && subscription.status === "canceled")
  ) {
    throw new Error("The subscription is not active.")
  }

  // Save the account update here as well as in the webhook so a fast redirect
  // cannot show confirmation before the enrollment is saved.
  await updateEnrollmentFromSubscription({
    enrollmentId,
    customerId,
    subscription,
    paymentStatus: session.payment_status,
    eventType: "checkout.session.completed",
  })
  const refreshed = await getParentEnrollmentPaymentContext(enrollmentId)
  const classPaymentWaived = refreshed.enrollment.payment_status === "payment_not_required"
  if (!classPaymentWaived && refreshed.enrollment.stripe_subscription_id !== subscriptionId) {
    throw new Error("The subscription has not been saved to this enrollment.")
  }

  return {
    kind,
    athleteName: [context.athlete.first_name, context.athlete.last_name].filter(Boolean).join(" "),
    programName: context.classRecord.class_name ?? "Class",
    classSubscriptionsCanceled: false,
    classPaymentWaived,
  }
}
