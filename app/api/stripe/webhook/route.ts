import { NextResponse } from "next/server"
import Stripe from "stripe"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  normalizeEnrollmentPaymentStatus,
  updateEnrollmentFromSubscription,
} from "@/lib/account/payments"
import {
  findCheerEnrollmentIdBySubscription,
  splitAndFinalizeCheerCheckout,
  updateCheerEnrollmentFromSubscription,
} from "@/lib/account/cheer-payments"
import { getStripe } from "@/lib/stripe/server"

export const runtime = "nodejs"

function getStripeId(value: string | { id: string } | null | undefined) {
  if (!value) {
    return null
  }

  return typeof value === "string" ? value : value.id
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const invoiceWithSubscription = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null
  }

  return getStripeId(invoiceWithSubscription.subscription)
}

async function findEnrollmentIdBySubscription(subscriptionId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("Enrollments")
    .select("enrollment_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data?.enrollment_id ? String(data.enrollment_id) : null
}

async function updatePaymentStatusBySubscription({
  subscriptionId,
  paymentStatus,
}: {
  subscriptionId: string
  paymentStatus: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("Enrollments")
    .update({
      payment_status: normalizeEnrollmentPaymentStatus(paymentStatus),
    })
    .eq("stripe_subscription_id", subscriptionId)

  if (error) {
    throw new Error(error.message)
  }
}

async function updateParentBalance(customer: Stripe.Customer) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("Parents")
    .update({ balance: (customer.balance * -1) / 100 })
    .eq("stripe_customer_id", customer.id)

  if (error) {
    throw new Error(error.message)
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.metadata?.enrollment_kind === "cheer") {
    const enrollmentId =
      session.metadata.cheer_enrollment_id ?? session.client_reference_id
    const tuitionPriceId = session.metadata.tuition_price_id
    const feePriceId = session.metadata.fee_price_id

    if (!enrollmentId || !tuitionPriceId || !feePriceId) {
      throw new Error(
        "Completed cheer Checkout session is missing billing metadata."
      )
    }

    await splitAndFinalizeCheerCheckout({
      session,
      enrollmentId,
      tuitionPriceId,
      feePriceId,
    })
    return
  }

  const enrollmentId =
    session.metadata?.enrollment_id ?? session.client_reference_id
  const subscriptionId = getStripeId(session.subscription)

  console.log("[handleCheckoutCompleted]", {
    enrollmentId,
    subscriptionId,
    metadata: session.metadata,
    clientReferenceId: session.client_reference_id,
  })

  if (!enrollmentId || !subscriptionId) {
    return
  }

  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  await updateEnrollmentFromSubscription({
    enrollmentId,
    customerId: getStripeId(session.customer),
    subscription,
    paymentStatus: session.payment_status ?? null,
    eventType: "checkout.session.completed",
  })
}

async function handleSubscriptionEvent(
  subscription: Stripe.Subscription,
  type: Stripe.Event.Type
) {
  const cheerEnrollmentId =
    subscription.metadata?.cheer_enrollment_id ??
    (await findCheerEnrollmentIdBySubscription(subscription.id))

  if (cheerEnrollmentId) {
    await updateCheerEnrollmentFromSubscription({
      enrollmentId: cheerEnrollmentId,
      customerId: getStripeId(subscription.customer),
      subscription,
    })
    return
  }

  const enrollmentId =
    subscription.metadata?.enrollment_id ??
    (await findEnrollmentIdBySubscription(subscription.id))

  if (!enrollmentId) {
    return
  }

  await updateEnrollmentFromSubscription({
    enrollmentId,
    customerId: getStripeId(subscription.customer),
    subscription,
    eventType: type,
  })
}

async function handleInvoiceEvent(
  invoice: Stripe.Invoice,
  paymentStatus: "paid" | "payment_failed",
  eventType: Stripe.Event.Type
) {
  const subscriptionId = getInvoiceSubscriptionId(invoice)

  if (!subscriptionId) {
    return
  }

  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const cheerEnrollmentId =
    subscription.metadata?.cheer_enrollment_id ??
    (await findCheerEnrollmentIdBySubscription(subscription.id))

  if (cheerEnrollmentId) {
    await updateCheerEnrollmentFromSubscription({
      enrollmentId: cheerEnrollmentId,
      customerId: getStripeId(invoice.customer),
      subscription,
      paymentStatus,
    })
    return
  }

  const enrollmentId =
    subscription.metadata?.enrollment_id ??
    (await findEnrollmentIdBySubscription(subscription.id))

  if (enrollmentId) {
    await updateEnrollmentFromSubscription({
      enrollmentId,
      customerId: getStripeId(invoice.customer),
      subscription,
      paymentStatus,
      eventType,
    })
    return
  }

  await updatePaymentStatusBySubscription({
    subscriptionId,
    paymentStatus,
  })
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature")
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook signing is not configured." },
      { status: 400 }
    )
  }

  const stripe = getStripe()
  const body = await request.text()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid webhook signature."
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "customer.updated":
        await updateParentBalance(event.data.object as Stripe.Customer)
        break
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        )
        break
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionEvent(
          event.data.object as Stripe.Subscription,
          event.type
        )
        break
      case "invoice.payment_succeeded":
        await handleInvoiceEvent(
          event.data.object as Stripe.Invoice,
          "paid",
          event.type
        )
        break
      case "invoice.payment_failed":
        await handleInvoiceEvent(
          event.data.object as Stripe.Invoice,
          "payment_failed",
          event.type
        )
        break
      default:
        break
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to process webhook."
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
