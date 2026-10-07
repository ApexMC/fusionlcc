import { NextResponse } from "next/server"

import { getCheckoutConfirmationPath } from "@/lib/account/checkout-confirmation"

// Keep the return URL used by previously created Checkout sessions working.
// The confirmation page verifies account ownership and completes billing.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  const { enrollmentId } = await params
  const sessionId = new URL(request.url).searchParams.get("session_id")

  const path = sessionId
    ? getCheckoutConfirmationPath({ kind: "cheer", enrollmentId, sessionId })
    : "/account"

  return NextResponse.redirect(new URL(path, request.url))
}
