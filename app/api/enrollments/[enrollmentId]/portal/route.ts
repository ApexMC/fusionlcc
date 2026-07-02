import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getParentEnrollmentPaymentContext } from "@/lib/account/payments"
import { getStripe } from "@/lib/stripe/server"

async function getOrigin() {
  const headerList = await headers()
  const originHeader = headerList.get("origin")

  if (originHeader) {
    return originHeader
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  return "http://localhost:3000"
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params
    const context = await getParentEnrollmentPaymentContext(enrollmentId)
    const stripeCustomerId =
      context.enrollment.stripe_customer_id ?? context.parent.stripe_customer_id

    if (!stripeCustomerId) {
      throw new Error("This enrollment does not have a Stripe customer yet.")
    }

    if (
      context.parent.stripe_customer_id &&
      context.parent.stripe_customer_id !== stripeCustomerId
    ) {
      throw new Error("This Stripe customer does not belong to your account.")
    }

    if (!context.enrollment.stripe_subscription_id) {
      throw new Error("This enrollment does not have a subscription yet.")
    }

    const stripe = getStripe()
    const origin = await getOrigin()
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/account`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to open the billing portal."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
