"use client"

import * as React from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import type {
  PublicClassSchedule,
  PublicDeadPeriod,
} from "@/lib/classes/data"
import { cn } from "@/lib/utils"

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const weekdayKeys = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]

const classColors = [
  {
    chip: "border-fuchsia-200 bg-fuchsia-100 text-fuchsia-950 dark:border-fuchsia-800 dark:bg-fuchsia-950/70 dark:text-fuchsia-100",
    dot: "bg-fuchsia-500",
  },
  {
    chip: "border-violet-200 bg-violet-100 text-violet-950 dark:border-violet-800 dark:bg-violet-950/70 dark:text-violet-100",
    dot: "bg-violet-500",
  },
  {
    chip: "border-sky-200 bg-sky-100 text-sky-950 dark:border-sky-800 dark:bg-sky-950/70 dark:text-sky-100",
    dot: "bg-sky-500",
  },
  {
    chip: "border-teal-200 bg-teal-100 text-teal-950 dark:border-teal-800 dark:bg-teal-950/70 dark:text-teal-100",
    dot: "bg-teal-500",
  },
  {
    chip: "border-amber-200 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-100",
    dot: "bg-amber-500",
  },
  {
    chip: "border-emerald-200 bg-emerald-100 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-100",
    dot: "bg-emerald-500",
  },
]

function stableColorIndex(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash % classColors.length
}

function getScheduleColor(schedule: PublicClassSchedule) {
  return classColors[stableColorIndex(schedule.classId ?? schedule.scheduleId)]
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function getMonthDate(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number)

  return new Date(Date.UTC(year, month - 1, 1))
}

function shiftMonth(monthKey: string, amount: number) {
  const date = getMonthDate(monthKey)
  date.setUTCMonth(date.getUTCMonth() + amount)

  return toDateKey(date).slice(0, 7)
}

function shiftDate(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)

  return toDateKey(date)
}

function getCalendarDates(monthKey: string) {
  const firstOfMonth = getMonthDate(monthKey)
  const firstVisibleDate = new Date(firstOfMonth)
  firstVisibleDate.setUTCDate(1 - firstOfMonth.getUTCDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisibleDate)
    date.setUTCDate(firstVisibleDate.getUTCDate() + index)
    return date
  })
}

function formatMonth(monthKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(getMonthDate(monthKey))
}

function formatDate(dateKey: string, includeYear = true) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00Z`))
}

function formatRange(period: PublicDeadPeriod) {
  if (!period.startsAt || !period.endsAt) {
    return "Dead period"
  }

  return `Dead period: ${formatDate(period.startsAt)}–${formatDate(period.endsAt)}`
}

function includesDate(period: PublicDeadPeriod, dateKey: string) {
  return Boolean(
    period.startsAt &&
      period.endsAt &&
      period.startsAt <= dateKey &&
      period.endsAt >= dateKey
  )
}

export default function MonthlyCalendar({
  schedules,
  deadPeriods,
  todayDateKey,
}: {
  schedules: PublicClassSchedule[]
  deadPeriods: PublicDeadPeriod[]
  todayDateKey: string
}) {
  const firstMonth = todayDateKey.slice(0, 7)
  const rangeStartDateKey = `${firstMonth}-01`
  const rangeEndDateKey = shiftDate(todayDateKey, 30)
  const lastMonth = rangeEndDateKey.slice(0, 7)
  const [visibleMonth, setVisibleMonth] = React.useState(firstMonth)
  const calendarDates = React.useMemo(
    () => getCalendarDates(visibleMonth),
    [visibleMonth]
  )
  const classKey = React.useMemo(() => {
    const classes = new Map<string, PublicClassSchedule>()

    schedules.forEach((schedule) => {
      const key = schedule.classId ?? schedule.className

      if (!classes.has(key)) {
        classes.set(key, schedule)
      }
    })

    return Array.from(classes.values()).sort((first, second) =>
      first.className.localeCompare(second.className)
    )
  }, [schedules])
  const schedulesByDay = React.useMemo(() => {
    const result = new Map<string, PublicClassSchedule[]>()

    weekdayKeys.forEach((day) => result.set(day, []))
    schedules.forEach((schedule) => {
      const daySchedules = result.get(schedule.dayOfWeek)

      if (daySchedules) {
        daySchedules.push(schedule)
      }
    })

    return result
  }, [schedules])

  return (
    <section className="w-full" aria-label="Class calendar">
      <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="shrink-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <CalendarDays className="size-4 text-purple-500" aria-hidden="true" />
              Class key
            </div>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {formatDate(rangeStartDateKey)}–{formatDate(rangeEndDateKey)}
            </p>
          </div>
          <div className="flex max-w-5xl flex-wrap gap-2 items-center justify-center lg:justify-end">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                "border-red-500 text-red-500 bg-accent dark:border-red-900 dark:bg-red-950/70 dark:text-red-100"
              )}
            >
              <span
                className={cn("size-2 rounded-full", "bg-red-500")}
                aria-hidden="true"
              />
              Dead Period
            </span>
            {classKey.length ? (
              classKey.map((schedule) => {
                const color = getScheduleColor(schedule)

                return (
                  <span
                    key={schedule.classId ?? schedule.className}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                      color.chip
                    )}
                  >
                    <span
                      className={cn("size-2 rounded-full", color.dot)}
                      aria-hidden="true"
                    />
                    {schedule.className}
                  </span>
                )
              })
            ) : (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                No active classes are available.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/60 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/20">
        <div className="flex flex-col gap-4 border-b border-zinc-200 px-4 py-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="order-2 flex items-center gap-2 sm:order-1">
            <Button
              variant="outline"
              size="icon"
              disabled={visibleMonth <= firstMonth}
              onClick={() => setVisibleMonth((month) => shiftMonth(month, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setVisibleMonth(firstMonth)}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={visibleMonth >= lastMonth}
              onClick={() => setVisibleMonth((month) => shiftMonth(month, 1))}
              aria-label="Next month"
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
          <h2 className="order-1 text-center text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:order-2 sm:text-2xl">
            {formatMonth(visibleMonth)}
          </h2>
          <div className="order-3 hidden w-[120px] sm:block" aria-hidden="true" />
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[840px]">
            <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/80">
              {weekdayLabels.map((day) => (
                <div
                  key={day}
                  className="px-3 py-3 text-center text-xs font-bold tracking-[0.14em] text-zinc-500 uppercase dark:text-zinc-400"
                >
                  {day}
                </div>
              ))}
            </div>

            <div
              className="grid grid-cols-7"
              role="grid"
              aria-label={formatMonth(visibleMonth)}
            >
              {calendarDates.map((date, index) => {
                const dateKey = toDateKey(date)
                const dayOfWeek = date.getUTCDay()
                const isCurrentMonth = dateKey.slice(0, 7) === visibleMonth
                const isInRange =
                  dateKey >= rangeStartDateKey && dateKey <= rangeEndDateKey
                const isAvailableDate = isCurrentMonth && isInRange
                const daySchedules = isAvailableDate
                  ? schedulesByDay.get(weekdayKeys[dayOfWeek]) ?? []
                  : []
                const dateDeadPeriods = isAvailableDate
                  ? deadPeriods.filter((period) => includesDate(period, dateKey))
                  : []
                const isToday = dateKey === todayDateKey
                const isClosed = dateDeadPeriods.length > 0
                const accessibleDate = new Intl.DateTimeFormat("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(date)

                return (
                  <div
                    key={dateKey}
                    role="gridcell"
                    aria-label={
                      isAvailableDate
                        ? accessibleDate
                        : `${accessibleDate}, outside schedule window`
                    }
                    aria-disabled={!isAvailableDate}
                    className={cn(
                      "min-h-36 border-r border-b border-zinc-200 p-2 align-top dark:border-zinc-800",
                      !isAvailableDate &&
                        "bg-zinc-100/70 text-zinc-300 dark:bg-zinc-900/50 dark:text-zinc-700",
                      index % 7 === 6 && "border-r-0"
                    )}
                  >
                    {isAvailableDate ? (
                      <>
                        <div className="mb-2 flex h-7 items-center justify-between">
                          <span
                            className={cn(
                              "flex size-7 items-center justify-center rounded-full text-sm font-semibold text-zinc-800 dark:text-zinc-200",
                              isToday &&
                                "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                            )}
                          >
                            {date.getUTCDate()}
                          </span>
                          {isToday ? (
                            <span className="text-[10px] font-bold tracking-wide text-purple-600 uppercase dark:text-purple-400">
                              Today
                            </span>
                          ) : null}
                        </div>

                        <div className="space-y-1.5">
                          {dateDeadPeriods.map((period) => {
                            const visiblePeriodStart =
                              period.startsAt && period.startsAt > rangeStartDateKey
                                ? period.startsAt
                                : rangeStartDateKey
                            const visiblePeriodEnd =
                              period.endsAt && period.endsAt < rangeEndDateKey
                                ? period.endsAt
                                : rangeEndDateKey
                            const startsSegment =
                              dateKey === visiblePeriodStart ||
                              dayOfWeek === 0 ||
                              date.getUTCDate() === 1
                            const endsSegment =
                              dateKey === visiblePeriodEnd ||
                              dayOfWeek === 6 ||
                              shiftDate(dateKey, 1).slice(0, 7) !== visibleMonth

                            return (
                              <div
                                key={period.periodId}
                                title={formatRange(period)}
                                className={cn(
                                  "-mx-2 flex h-6 items-center border-y border-rose-300 bg-rose-100 px-2 text-[11px] font-bold text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100",
                                  startsSegment && "ml-0 rounded-l-md border-l",
                                  endsSegment && "mr-0 rounded-r-md border-r"
                                )}
                              >
                                <span className="truncate">No classes</span>
                              </div>
                            )
                          })}

                          {daySchedules.map((schedule) => {
                            const color = getScheduleColor(schedule)

                            return (
                              <div
                                key={schedule.scheduleId}
                                title={schedule.scheduleLabel}
                                aria-label={`${schedule.className}, ${schedule.scheduleLabel}${isClosed ? ", canceled during dead period" : ""}`}
                                className={cn(
                                  "rounded-md border px-2 py-1.5 text-xs leading-tight shadow-xs",
                                  color.chip,
                                  isClosed && "opacity-45 line-through"
                                )}
                              >
                                <div className="truncate font-bold">
                                  {schedule.className}
                                </div>
                                <div className="mt-0.5 truncate text-[11px] opacity-80">
                                  {schedule.timeLabel}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
        Dead periods appear as connected “No classes” bands across every
        affected day. Recurring class times are dimmed during those closures.
        Scroll horizontally to see the full week on smaller screens.
      </p>
    </section>
  )
}
