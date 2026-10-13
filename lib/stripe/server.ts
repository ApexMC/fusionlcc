import "server-only"

import Stripe from "stripe"

let stripe: Stripe | null = null

export function getStripe() {
  if (stripe) {
    return stripe
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.")
  }

  const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID?.trim()

  if (!connectedAccountId) {
    throw new Error("STRIPE_CONNECTED_ACCOUNT_ID is not configured.")
  }

  // Keep customers, prices, subscriptions, and billing operations in the gym's
  // account while the platform collects application fees.
  stripe = new Stripe(secretKey, { stripeAccount: connectedAccountId })
  return stripe
}

export function getNextBillingAnchorUnix(
  billingDay: 1 | 15,
  now = new Date()
): number {
  let anchor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), billingDay, 12, 0, 0)
  )

  if (anchor.getTime() <= now.getTime()) {
    anchor = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        billingDay,
        12,
        0,
        0
      )
    )
  }

  return Math.floor(anchor.getTime() / 1000)
}

export function getPeriodDate(value: number | null | undefined) {
  if (!value) {
    return null
  }

  return new Date(value * 1000).toISOString()
}

export function getSubscriptionPeriod(subscription: Stripe.Subscription) {
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
