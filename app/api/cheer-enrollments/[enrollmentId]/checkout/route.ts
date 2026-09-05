import { headers } from "next/headers"
import { NextResponse } from "next/server"

import {
  ensureApprovedCheerEnrollment,
  ensureNoCheerSubscriptions,
  getCheerBillingConfig,
  getParentCheerEnrollmentPaymentContext,
  recoverCompletedCheerCheckout,
  saveCheerStripeCustomerId,
} from "@/lib/account/cheer-payments"
import { getNextBillingAnchorUnix, getStripe } from "@/lib/stripe/server"

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
    const context = await getParentCheerEnrollmentPaymentContext(enrollmentId)
    ensureApprovedCheerEnrollment(context.enrollment)

    const { tuitionPriceId, feePriceId } = getCheerBillingConfig(context.team)
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

    await saveCheerStripeCustomerId({
      enrollmentId: context.enrollment.enrollment_id,
      parentId: context.parent.parent_id,
      stripeCustomerId,
    })

    const origin = await getOrigin()
    const recoveredCheckout = await recoverCompletedCheerCheckout({
      enrollmentId: String(context.enrollment.enrollment_id),
      customerId: stripeCustomerId,
    })

    if (recoveredCheckout) {
      return NextResponse.json({
        url: `${origin}/account?checkout=success&cheerEnrollment=${context.enrollment.enrollment_id}`,
      })
    }

    ensureNoCheerSubscriptions(context.enrollment)

    const metadata = {
      user_id: context.userId,
      parent_id: String(context.parent.parent_id),
      athlete_id: String(context.athlete.athlete_id),
      team_id: String(context.team.team_id),
      cheer_enrollment_id: String(context.enrollment.enrollment_id),
      enrollment_kind: "cheer",
      subscription_role: "tuition",
      tuition_price_id: tuitionPriceId,
      fee_price_id: feePriceId,
      program_type: "competitive_cheer",
    }
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: stripeCustomerId,
        payment_method_collection: "always",
        line_items: [
          { price: tuitionPriceId, quantity: 1 },
          { price: feePriceId, quantity: 1 },
        ],
        success_url: `${origin}/api/cheer-enrollments/${context.enrollment.enrollment_id}/complete?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/account?checkout=canceled&cheerEnrollment=${context.enrollment.enrollment_id}`,
        client_reference_id: String(context.enrollment.enrollment_id),
        metadata,
        custom_text: {
          submit: {
            message:
              "Tuition renews on the 1st and cheer fees renew on the 15th. No prorated amount is charged when billing is started.",
          },
        },
        subscription_data: {
          billing_cycle_anchor: getNextBillingAnchorUnix(1),
          metadata,
          proration_behavior: "none",
        },
      },
      {
        idempotencyKey: `cheer-checkout:${context.enrollment.enrollment_id}:${tuitionPriceId}:${feePriceId}`,
      }
    )

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to start cheer checkout."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
