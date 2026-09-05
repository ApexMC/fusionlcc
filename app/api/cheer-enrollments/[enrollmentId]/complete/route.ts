import { NextResponse } from "next/server"

import {
  finalizeCompletedCheerCheckoutSession,
  getParentCheerEnrollmentPaymentContext,
} from "@/lib/account/cheer-payments"

function getAccountUrl(request: Request, enrollmentId: string, status: string) {
  const url = new URL("/account", request.url)
  url.searchParams.set("checkout", status)
  url.searchParams.set("cheerEnrollment", enrollmentId)
  return url
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  const { enrollmentId } = await params
  const sessionId = new URL(request.url).searchParams.get("session_id")

  if (!sessionId) {
    return NextResponse.redirect(
      getAccountUrl(request, enrollmentId, "processing")
    )
  }

  try {
    const context = await getParentCheerEnrollmentPaymentContext(enrollmentId)
    const customerId =
      context.enrollment.stripe_customer_id ??
      context.parent.stripe_customer_id

    if (!customerId) {
      throw new Error("The cheer enrollment is missing its Stripe customer.")
    }

    await finalizeCompletedCheerCheckoutSession({
      sessionId,
      enrollmentId: String(context.enrollment.enrollment_id),
      customerId,
    })

    return NextResponse.redirect(
      getAccountUrl(request, enrollmentId, "success")
    )
  } catch (error) {
    console.error("[completeCheerCheckout]", {
      enrollmentId,
      sessionId,
      error,
    })

    return NextResponse.redirect(
      getAccountUrl(request, enrollmentId, "processing")
    )
  }
}
