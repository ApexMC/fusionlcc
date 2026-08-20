import type { CoachTimeClockEntry } from "@/lib/account/types"

export function parseTimeClockDate(value: string | null) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

export function formatTimeClockDate(value: string | null) {
  const date = parseTimeClockDate(value)

  if (!date) {
    return "Date TBD"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

export function formatTimeClockTime(value: string | null) {
  const date = parseTimeClockDate(value)

  if (!date) {
    return "Time TBD"
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export function formatTimeClockDateTime(value: string | null) {
  const date = parseTimeClockDate(value)

  if (!date) {
    return "Time TBD"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export function getTimeClockEntryDurationMinutes(
  entry: CoachTimeClockEntry,
  now = new Date()
) {
  const start = parseTimeClockDate(entry.clockInAt)
  const end = parseTimeClockDate(entry.clockOutAt) ?? now

  if (!start) {
    return 0
  }

  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60_000))
}

export function formatTimeClockDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`
}

export function getTimeClockEntryNote(entry: CoachTimeClockEntry) {
  return [entry.clockInNote, entry.clockOutNote].filter(Boolean).join(" / ")
}

export function isPendingTimeClockStatus(status: string) {
  return status.trim().toLowerCase() === "pending"
}

export function getTimeClockStatusVariant(status: string) {
  const normalized = status.toLowerCase()

  if (normalized === "approved") {
    return "success" as const
  }

  if (normalized === "denied") {
    return "destructive" as const
  }

  if (normalized === "pending") {
    return "warning" as const
  }

  return "outline" as const
}

export function getTimeClockEntryStatusVariant(
  entry: CoachTimeClockEntry,
  status: string
) {
  return entry.clockOutAt ? getTimeClockStatusVariant(status) : ("purple" as const)
}

export function formatTimeClockStatus(status: string) {
  return status.replace(/_/g, " ")
}

export function getTimeClockEntryStatusLabel(
  entry: CoachTimeClockEntry,
  status: string
) {
  return entry.clockOutAt ? formatTimeClockStatus(status) : "on the clock"
}
