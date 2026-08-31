type LocalTimeParts = {
  hour: number
  minute: number
}

function parseLocalTime(
  value: string | null | undefined
): LocalTimeParts | null {
  const match = value
    ?.trim()
    .match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/)

  if (!match) {
    return null
  }

  const hour = Number(match[1])
  const minute = Number(match[2])

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null
  }

  return { hour, minute }
}

export function normalizeLocalTime(value: string | null | undefined) {
  const parts = parseLocalTime(value)

  if (!parts) {
    return null
  }

  return `${String(parts.hour).padStart(2, "0")}:${String(
    parts.minute
  ).padStart(2, "0")}`
}

export function formatLocalTime(
  value: string | null | undefined,
  missingLabel = "Time TBD"
) {
  const parts = parseLocalTime(value)

  if (!parts) {
    return value?.trim() || missingLabel
  }

  const period = parts.hour >= 12 ? "PM" : "AM"
  const displayHour = parts.hour % 12 || 12

  return `${displayHour}:${String(parts.minute).padStart(2, "0")} ${period}`
}

export function addMinutesToLocalTime(
  value: string | null | undefined,
  minutes: number
) {
  const parts = parseLocalTime(value)

  if (!parts || !Number.isInteger(minutes)) {
    return null
  }

  const minutesPerDay = 24 * 60
  const totalMinutes =
    (parts.hour * 60 + parts.minute + minutes) % minutesPerDay
  const normalizedMinutes =
    totalMinutes < 0 ? totalMinutes + minutesPerDay : totalMinutes
  const hour = Math.floor(normalizedMinutes / 60)
  const minute = normalizedMinutes % 60

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}
