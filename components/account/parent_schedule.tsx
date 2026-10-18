import { CalendarDays } from "lucide-react"

import MonthlyCalendar from "@/components/classes/monthly_calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CalendarSession } from "@/lib/calendar"
import type { DeadPeriodRecord } from "@/lib/account/types"

export function ParentSchedule({
  sessions,
  deadPeriods,
  todayDateKey,
}: {
  sessions: CalendarSession[]
  deadPeriods: DeadPeriodRecord[]
  todayDateKey: string
}) {
  return (
    <Card id="schedule" className="min-w-0 scroll-mt-24 rounded-lg bg-white dark:bg-black" aria-labelledby="personal-schedule-heading">
      <CardHeader>
        <CardTitle>
          <h2 id="personal-schedule-heading" className="flex items-center gap-2 text-xl font-semibold">
            <CalendarDays className="size-5" aria-hidden="true" />
            Personal schedule
          </h2>
        </CardTitle>
        <CardDescription>
          Class sessions and cheer practices for your athletes’ approved and active enrollments, through the next 30 days.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        <MonthlyCalendar sessions={sessions} deadPeriods={deadPeriods} todayDateKey={todayDateKey} personal />
      </CardContent>
    </Card>
  )
}
