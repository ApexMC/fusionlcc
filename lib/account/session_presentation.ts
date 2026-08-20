import {
  dateKeyToLocalDate,
  getDateKey,
  organizationTimeZone,
} from "@/lib/date_keys"

type SessionSchedule = {
  scheduleId: string | null
  scheduleLabel: string | null
}

export function formatSessionDate(value: string | null) {
  if (!value) {
    return "Date TBD"
  }

  const dateKey = getDateKey(value)
  const date = dateKey ? dateKeyToLocalDate(dateKey) : null

  if (!date || Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

export function formatSessionTime(value: string | null) {
  if (!value) {
    return "Time TBD"
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value)

    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: organizationTimeZone,
      }).format(date)
    }
  }

  const timeMatch = value.match(/(\d{1,2}):(\d{2})(?::\d{2})?/)
  const hour = Number(timeMatch?.[1])
  const minute = Number(timeMatch?.[2] ?? "00")

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return value
  }

  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 || 12

  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`
}

export function getSessionScheduleDisplay(session: SessionSchedule) {
  return (
    session.scheduleLabel ??
    (session.scheduleId ? `Schedule #${session.scheduleId}` : "Unscheduled")
  )
}

export function formatSessionStatus(status: string | null | undefined) {
  return (status || "unknown").replace(/_/g, " ")
}

export function getSessionStatusVariant(
  status: string | null | undefined
) {
  const normalized = (status ?? "").toLowerCase()

  if (["complete", "completed", "reviewed"].includes(normalized)) {
    return "success" as const
  }

  if (["cancelled", "canceled"].includes(normalized)) {
    return "destructive" as const
  }

  if (["pending", "in progress"].includes(normalized)) {
    return "warning" as const
  }

  return "outline" as const
}

export function normalizeDateRange(dateFrom: string, dateTo: string) {
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return {
      startDate: dateTo,
      endDate: dateFrom,
    }
  }

  return {
    startDate: dateFrom,
    endDate: dateTo,
  }
}
