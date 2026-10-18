import { shiftDateKey } from "@/lib/date_keys"
import { formatLocalTime } from "@/lib/local_time"

export type CalendarSession = {
  sessionId: string
  classId: string
  className: string
  sessionDate: string
  startsAt: string | null
  endsAt: string | null
  status: string
  type: string | null
  timeLabel: string
  athleteNames?: string[]
}

export function getCalendarDateRange(todayDateKey: string) {
  return {
    startsOn: `${todayDateKey.slice(0, 7)}-01`,
    endsOn: shiftDateKey(todayDateKey, 30),
  }
}

export function formatSessionTimeLabel(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined
) {
  const startTime = startsAt ? formatLocalTime(startsAt) : null
  const endTime = endsAt ? formatLocalTime(endsAt) : null

  if (startTime && endTime) {
    return `${startTime} - ${endTime}`
  }

  return startTime ?? endTime ?? "Time TBD"
}
