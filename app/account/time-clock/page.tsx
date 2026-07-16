import { ArrowLeft, Clock } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { CoachTimeClock } from "@/components/account/coach/time_clock"
import { Button } from "@/components/ui/button"
import { getAccountSession } from "@/lib/account/auth"
import { getCoachTimeClockData } from "@/lib/account/data"

export default async function TimeClockPage() {
  const session = await getAccountSession()

  if (!session) {
    redirect("/login")
  }

  if (!session.isOwner && !session.isAdmin && !session.isCoach) {
    redirect("/account")
  }

  const timeClock = await getCoachTimeClockData(session.userId)

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-100 font-sans dark:bg-zinc-900">
      <main className="flex min-h-[50vh] w-full flex-1 flex-col items-center justify-start gap-6 bg-zinc-100 px-4 py-12 dark:bg-zinc-900 sm:px-8">
        <div className="flex w-full max-w-6xl flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-3xl font-bold text-zinc-800 dark:text-zinc-200">
                <Clock className="size-6" />
                Time Clock
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Clock in and out for coaching shifts.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/account">
                <ArrowLeft />
                Account
              </Link>
            </Button>
          </div>
          <CoachTimeClock timeClock={timeClock} />
        </div>
      </main>
    </div>
  )
}
