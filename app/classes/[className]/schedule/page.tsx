import { notFound } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getPublicClassBySlug,
  type PublicClassSchedule,
} from "@/lib/classes/data"
import { sundayFirstWeekdayOptions as days } from "@/lib/scheduling"

function buildWeeklyRows(schedules: PublicClassSchedule[]) {
  const timesByDay = new Map<string, string[]>(
    days.map((day) => [day.value, []])
  )

  schedules.forEach((schedule) => {
    const times = timesByDay.get(schedule.dayOfWeek)

    if (!times) {
      return
    }

    times.push(schedule.timeLabel)
  })

  const rowCount = Math.max(
    1,
    ...Array.from(timesByDay.values()).map((times) => times.length)
  )

  return Array.from({ length: rowCount }, (_, index) =>
    days.map((day) => timesByDay.get(day.value)?.[index] ?? "—")
  )
}

export default async function ClassSchedule({
  params,
}: {
  params: Promise<{ className: string }>
}) {
  const { className } = await params
  const classData = await getPublicClassBySlug(className)

  if (!classData) {
    return notFound()
  }

  const weeklyRows = buildWeeklyRows(classData.schedules)

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-100 font-sans dark:bg-zinc-900">
      <main className="flex min-h-[50vh] w-full flex-1 flex-col items-center justify-center bg-zinc-100 px-8 py-16 dark:bg-zinc-900 md:px-16">
        <h1 className="mx-auto text-center text-4xl font-bold text-zinc-800 dark:text-zinc-200">
          {classData.classRecord.className}
          <br />
          Weekly Schedule
        </h1>
        <p className="mt-4 mb-12 max-w-2xl text-center text-zinc-600 dark:text-zinc-400">
          Find the best time to join us.
        </p>
        <Card className="mb-8 w-full max-w-4xl px-4">
          <CardContent className="px-2 py-4">
            <div className="mb-4 flex items-center justify-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <span>Schedule Status:</span>
              <span className="inline-flex items-center justify-center gap-1 rounded-full bg-green-100 px-2 pt-0.5 font-semibold text-green-800">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-label="Status: Current"
                >
                  <title>Current</title>
                  <circle cx="6" cy="6" r="5" fill="#22C55E" />
                </svg>
                Current
              </span>
            </div>
            {classData.schedules.length ? (
              <Table className="mx-auto w-full max-w-4xl px-4">
                <TableHeader>
                  <TableRow>
                    {days.map((day) => (
                      <TableHead key={day.value} className="text-center">
                        {day.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklyRows.map((row, rowIndex) => (
                    <TableRow key={rowIndex} className="text-center">
                      {row.map((time, columnIndex) => (
                        <TableCell key={`${rowIndex}-${columnIndex}`}>
                          {time}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
                No active times are available for this class right now.
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
