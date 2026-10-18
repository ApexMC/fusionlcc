"use client"

import * as React from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PublicDeadPeriod } from "@/lib/classes/data"
import { getCalendarDateRange, type CalendarSession } from "@/lib/calendar"
import { getDateKeyInTimeZone } from "@/lib/date_keys"
import { cn } from "@/lib/utils"

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const programChipClassName =
  "border-[hsl(var(--program-hue)_65%_80%)] bg-[hsl(var(--program-hue)_75%_94%)] text-[hsl(var(--program-hue)_65%_16%)] dark:border-[hsl(var(--program-hue)_45%_30%)] dark:bg-[hsl(var(--program-hue)_50%_14%/0.7)] dark:text-[hsl(var(--program-hue)_75%_90%)]"
const programDotClassName = "bg-[hsl(var(--program-hue)_70%_50%)]"

function isCanceledSession(session: CalendarSession) {
  return ["canceled", "cancelled"].includes(session.status.toLowerCase())
}

function isMakeupSession(session: CalendarSession) {
  return session.type?.toLowerCase() === "makeup"
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
  sessions,
  deadPeriods,
  todayDateKey,
  personal = false,
}: {
  sessions: CalendarSession[]
  deadPeriods: PublicDeadPeriod[]
  todayDateKey: string
  personal?: boolean
}) {
  const [currentTodayDateKey, setCurrentTodayDateKey] =
    React.useState(todayDateKey)
  const todayDateKeyRef = React.useRef(todayDateKey)
  const firstMonth = currentTodayDateKey.slice(0, 7)
  const { startsOn: rangeStartDateKey, endsOn: rangeEndDateKey } =
    getCalendarDateRange(currentTodayDateKey)
  const lastMonth = rangeEndDateKey.slice(0, 7)
  const [visibleMonth, setVisibleMonth] = React.useState(firstMonth)
  React.useEffect(() => {
    function syncTodayDateKey() {
      const nextTodayDateKey = getDateKeyInTimeZone()
      const previousTodayDateKey = todayDateKeyRef.current

      if (nextTodayDateKey === previousTodayDateKey) {
        return
      }

      todayDateKeyRef.current = nextTodayDateKey
      setCurrentTodayDateKey(nextTodayDateKey)

      const previousMonth = previousTodayDateKey.slice(0, 7)
      const nextMonth = nextTodayDateKey.slice(0, 7)

      if (previousMonth !== nextMonth) {
        setVisibleMonth((month) =>
          month === previousMonth ? nextMonth : month
        )
      }
    }

    syncTodayDateKey()
    const intervalId = window.setInterval(syncTodayDateKey, 60_000)

    return () => window.clearInterval(intervalId)
  }, [])
  const calendarDates = React.useMemo(
    () => getCalendarDates(visibleMonth),
    [visibleMonth]
  )
  const classKey = React.useMemo(() => {
    const classes = new Map<string, CalendarSession>()

    sessions.forEach((session) => {
      const key = session.classId

      if (!classes.has(key)) {
        classes.set(key, session)
      }
    })

    return Array.from(classes.values()).sort((first, second) =>
      first.className.localeCompare(second.className) ||
      first.classId.localeCompare(second.classId)
    )
  }, [sessions])
  const programColors = React.useMemo(() => new Map(
    classKey.map((session, index) => [
      session.classId,
      // Space program hues across the calendar, keeping red for dead periods.
      { "--program-hue": 25 + ((185 + index * 300 / classKey.length) % 300) } as React.CSSProperties,
    ])
  ), [classKey])
  const sessionsByDate = React.useMemo(() => {
    const result = new Map<string, CalendarSession[]>()

    sessions.forEach((session) => {
      result.set(session.sessionDate, [
        ...(result.get(session.sessionDate) ?? []),
        session,
      ])
    })

    return result
  }, [sessions])

  return (
    <section className="min-w-0 w-full" aria-label={personal ? "Personal schedule calendar" : "Class calendar"}>
      <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="shrink-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <CalendarDays className="size-4 text-purple-500" aria-hidden="true" />
              {personal ? "Program key" : "Class key"}
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
              classKey.map((session) => {
                const color = programColors.get(session.classId)

                return (
                  <span
                    key={session.classId}
                    style={color}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                      programChipClassName
                    )}
                  >
                    <span
                      className={cn("size-2 rounded-full", programDotClassName)}
                      aria-hidden="true"
                    />
                    {session.className}
                  </span>
                )
              })
            ) : (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {personal
                  ? "No sessions are scheduled for your athletes in this window."
                  : "No class sessions are scheduled in this window."}
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
                const daySessions = isAvailableDate
                  ? sessionsByDate.get(dateKey) ?? []
                  : []
                const dateDeadPeriods = isAvailableDate
                  ? deadPeriods.filter((period) => includesDate(period, dateKey))
                  : []
                const isToday = dateKey === currentTodayDateKey
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
                                <span className="truncate">{personal ? "No programs" : "No classes"}</span>
                              </div>
                            )
                          })}

                          {daySessions.map((session) => {
                            const color = programColors.get(session.classId)
                            const isCanceled = isCanceledSession(session)
                            const isMakeup = isMakeupSession(session)
                            const sessionDetails = [
                              session.athleteNames?.join(", "),
                              session.timeLabel,
                              isMakeup ? "Makeup" : null,
                              isCanceled ? "Canceled" : null,
                            ]
                              .filter(Boolean)
                              .join(" • ")

                            return (
                              <div
                                key={session.sessionId}
                                style={color}
                                title={`${session.className}, ${sessionDetails}`}
                                aria-label={`${session.className}, ${sessionDetails}`}
                                className={cn(
                                  "rounded-md border px-2 py-1.5 text-xs leading-tight shadow-xs",
                                  programChipClassName,
                                  isCanceled && "border-dashed opacity-70"
                                )}
                              >
                                <div
                                  className={cn(
                                    "truncate font-bold",
                                    isCanceled && "line-through"
                                  )}
                                >
                                  {session.className}
                                </div>
                                {session.athleteNames?.length ? (
                                  <div className="mt-1 break-words text-[11px] font-medium">
                                    {session.athleteNames.join(", ")}
                                  </div>
                                ) : null}
                                <div
                                  className={cn(
                                    "mt-0.5 truncate text-[11px] opacity-80",
                                    isCanceled && "line-through"
                                  )}
                                >
                                  {session.timeLabel}
                                </div>
                                {isMakeup || isCanceled ? (
                                  <div className="mt-1 flex flex-wrap gap-1 text-[9px] font-bold tracking-wide uppercase no-underline">
                                    {isMakeup ? <span>Makeup</span> : null}
                                    {isCanceled ? (
                                      <span className="text-rose-700 dark:text-rose-300">
                                        Canceled
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
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
        Dead periods appear as connected “{personal ? "No programs" : "No classes"}” bands across every
        affected day. Canceled sessions and their makeup sessions remain visible.
        <span className="md:hidden"> Scroll horizontally to see the full week on smaller screens.</span> 
      </p>
    </section>
  )
}
