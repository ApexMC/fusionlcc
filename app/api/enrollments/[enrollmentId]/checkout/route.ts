import { headers } from "next/headers"
import { NextResponse } from "next/server"

import {
  ensureApprovedEnrollment,
  ensureNoActiveSubscription,
  getClassBillingConfig,
  getMultiAthleteCouponId,
  getParentEnrollmentPaymentContext,
  saveStripeCustomerId,
} from "@/lib/account/payments"
import { getStripe, getNextBillingAnchorUnix } from "@/lib/stripe/server"

function getOrigin(fallbackPath = "/account") {
  return async function origin() {
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

    return `http://localhost:3000${fallbackPath}`.replace(fallbackPath, "")
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params
    const context = await getParentEnrollmentPaymentContext(enrollmentId)
    ensureApprovedEnrollment(context.enrollment)
    ensureNoActiveSubscription(context.enrollment)

    const { stripePriceId, billingDay, programType } = getClassBillingConfig(
      context.classRecord
    )
    const stripeCouponId = await getMultiAthleteCouponId({
      parentId: context.parent.parent_id,
      classId: context.enrollment.class_id ?? context.classRecord.class_id,
    })
    const stripe = getStripe()
    let stripeCustomerId =
      context.parent.stripe_customer_id ??
      context.enrollment.stripe_customer_id ??
      null

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: context.parent.email ?? undefined,
        name: [context.parent.first_name, context.parent.last_name]
          .filter(Boolean)
          .join(" "),
        metadata: {
          user_id: context.userId,
          parent_id: String(context.parent.parent_id),
        },
      })
      stripeCustomerId = customer.id
    }

    await saveStripeCustomerId({
      enrollmentId: context.enrollment.enrollment_id,
      parentId: context.parent.parent_id,
      stripeCustomerId,
    })

    const origin = await getOrigin()()
    const metadata = {
      user_id: context.userId,
      parent_id: String(context.parent.parent_id),
      athlete_id: String(context.athlete.athlete_id),
      schedule_id: context.scheduleId,
      class_id: String(context.classRecord.class_id),
      enrollment_id: String(context.enrollment.enrollment_id),
      program_type: programType,
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      discounts: stripeCouponId ? [{ coupon: stripeCouponId }] : undefined,
      success_url: `${origin}/account?checkout=success&enrollment=${context.enrollment.enrollment_id}`,
      cancel_url: `${origin}/account?checkout=canceled&enrollment=${context.enrollment.enrollment_id}`,
      client_reference_id: String(context.enrollment.enrollment_id),
      metadata,
      subscription_data: {
        billing_cycle_anchor: getNextBillingAnchorUnix(billingDay),
        metadata,
        proration_behavior: "none",
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start checkout."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
