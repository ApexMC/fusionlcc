import { NextResponse } from "next/server"

import {
  ensureApprovedEnrollment,
  ensureNoActiveSubscription,
  getClassBillingConfig,
  getParentEnrollmentPaymentContext,
  saveStripeCustomerId,
} from "@/lib/account/payments"
import { getStripe, getNextBillingAnchorUnix } from "@/lib/stripe/server"
import { getStripeIdempotencyKey } from "@/lib/stripe/idempotency"

function getOrigin(request: Request) {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  return new URL(request.url).origin
}

export async function POST(
  request: Request,
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
    const stripe = getStripe()
    let stripeCustomerId =
      context.parent.stripe_customer_id ??
      context.enrollment.stripe_customer_id ??
      null

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create(
        {
          email: context.parent.email ?? undefined,
          name: [context.parent.first_name, context.parent.last_name]
            .filter(Boolean)
            .join(" "),
          metadata: {
            user_id: context.userId,
            parent_id: String(context.parent.parent_id),
          },
        },
        {
          idempotencyKey: getStripeIdempotencyKey(
            "customer",
            context.parent.parent_id
          ),
        }
      )
      stripeCustomerId = customer.id
    }

    await saveStripeCustomerId({
      enrollmentId: context.enrollment.enrollment_id,
      parentId: context.parent.parent_id,
      stripeCustomerId,
    })

    const origin = getOrigin(request)
    const metadata = {
      user_id: context.userId,
      parent_id: String(context.parent.parent_id),
      athlete_id: String(context.athlete.athlete_id),
      schedule_id: context.scheduleId,
      class_id: String(context.classRecord.class_id),
      enrollment_id: String(context.enrollment.enrollment_id),
      program_type: programType,
    }
    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: stripeCustomerId,
        line_items: [
          {
            price: stripePriceId,
            quantity: 1,
          },
        ],
        success_url: `${origin}/account?checkout=success&enrollment=${context.enrollment.enrollment_id}`,
        cancel_url: `${origin}/account?checkout=canceled&enrollment=${context.enrollment.enrollment_id}`,
        client_reference_id: String(context.enrollment.enrollment_id),
        metadata,
        subscription_data: {
          billing_cycle_anchor: getNextBillingAnchorUnix(billingDay),
          metadata,
          proration_behavior: "none",
        },
      },
      {
        idempotencyKey: getStripeIdempotencyKey(
          "checkout-session",
          context.enrollment.enrollment_id
        ),
      }
    )

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start checkout."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
