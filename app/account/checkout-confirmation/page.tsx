import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, CircleCheck, Clock3 } from "lucide-react"

import { AccountDashboardFrame } from "@/components/account/dashboard_navigation"
import { CheckoutConfirmationRetry } from "@/components/account/checkout_confirmation_retry"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  getCheckoutConfirmation,
  getCheckoutConfirmationPath,
  type CheckoutConfirmation,
} from "@/lib/account/checkout-confirmation"

export const metadata = {
  title: "Enrollment confirmation | Limitless Cheer & Gymnastics",
  robots: { index: false, follow: false },
}

export default async function CheckoutConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const query = await searchParams
  const kind = query.kind
  const enrollmentId = query.enrollment
  const sessionId = query.session_id

  if (
    (kind !== "class" && kind !== "cheer") ||
    typeof enrollmentId !== "string" || !enrollmentId ||
    typeof sessionId !== "string" || !sessionId
  ) {
    redirect("/account")
  }

  let confirmation: CheckoutConfirmation | null = null
  try {
    confirmation = await getCheckoutConfirmation({ kind, enrollmentId, sessionId })
  } catch (error) {
    console.error("[checkoutConfirmation]", JSON.stringify({
      kind,
      enrollmentId,
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    }))
  }

  const Icon = confirmation ? CircleCheck : Clock3

  return (
    <AccountDashboardFrame className="max-w-2xl">
      <Card className="gap-6 py-8 sm:py-10">
        <CardHeader className="gap-4 px-6 text-center sm:px-10">
          <div className={`mx-auto flex size-16 items-center justify-center rounded-full ${confirmation ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}>
            <Icon className="size-8" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold">
            {confirmation ? "Your enrollment is confirmed!" : "We're confirming your checkout"}
          </h1>
          <p className="text-base leading-7 text-muted-foreground">
            {confirmation
              ? confirmation.classPaymentWaived
                ? "Your class enrollment is confirmed and included with your cheer enrollment."
                : "Thank you! Your subscription has been set up successfully."
              : "We haven't finished confirming your subscription yet. Check again shortly or view the latest status in your account."}
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-6 sm:px-10">
          {!confirmation ? <CheckoutConfirmationRetry /> : null}
          {confirmation ? (
            <>
              <dl className="space-y-3 rounded-lg bg-muted/50 p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted-foreground">Athlete</dt>
                  <dd className="font-medium">{confirmation.athleteName || "Your athlete"}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted-foreground">{kind === "cheer" ? "Cheer team" : "Class"}</dt>
                  <dd className="font-medium">{confirmation.programName}</dd>
                </div>
              </dl>
              {confirmation.classSubscriptionsCanceled ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <h2 className="font-semibold">Class subscription automatically cancelled</h2>
                  <p className="mt-2 leading-6 text-muted-foreground">
                    Your athlete&apos;s existing class subscription has been automatically cancelled now that their cheer enrollment is confirmed. Their class enrollments remain active and are included at no additional class subscription charge.
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            {!confirmation ? (
              <Button asChild variant="outline" size="lg">
                <a href={getCheckoutConfirmationPath({ kind, enrollmentId, sessionId })}>Check again</a>
              </Button>
            ) : null}
            <Button asChild size="lg">
              <Link href="/account">Back to my account <ArrowRight aria-hidden="true" /></Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </AccountDashboardFrame>
  )
}
