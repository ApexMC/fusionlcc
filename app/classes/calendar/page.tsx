import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import MonthlyCalendar from "@/components/classes/monthly_calendar"
import { getPublicClassCalendarData } from "@/lib/classes/data"
import { getDateKeyInTimeZone } from "@/lib/date_keys"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Class Calendar | Limitless Cheer & Gymnastics",
  description: "View the current monthly class calendar and scheduled closures.",
}

export default async function ClassCalendarPage() {
  const { schedules, deadPeriods } = await getPublicClassCalendarData()
  const todayDateKey = getDateKeyInTimeZone()

  return (
    <div className="flex flex-1 flex-col bg-zinc-100 font-sans dark:bg-zinc-900">
      <main className="mx-auto flex min-h-[50vh] w-full max-w-375 flex-1 flex-col px-4 py-10 sm:px-8 sm:py-14 lg:px-12">
        <Button asChild variant="outline" className="max-w-40 mb-6">
          <Link href={"/classes"} className="flex items-center gap-2">
            <ArrowLeft />
            Back to classes
          </Link>
        </Button>

        <div className="mb-10 text-center">
          <span className="text-sm font-bold tracking-[0.2em] text-purple-600 uppercase dark:text-purple-400">
            Plan your month
          </span>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-5xl">
            Class Calendar
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-zinc-600 dark:text-zinc-400">
            Browse every active weekly class time and see scheduled closures at
            a glance.
          </p>
        </div>

        <MonthlyCalendar
          schedules={schedules}
          deadPeriods={deadPeriods}
          todayDateKey={todayDateKey}
        />
      </main>
    </div>
  )
}
