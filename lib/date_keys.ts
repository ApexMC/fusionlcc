export const organizationTimeZone = "America/Indiana/Tell_City"

export type DateKeyParts = {
  year: number
  month: number
  day: number
}

export function parseDateKeyParts(value: string): DateKeyParts | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

export function getDateKeyInTimeZone(
  date = new Date(),
  timeZone = organizationTimeZone
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const dateParts = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  )

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`
}

export function getDateKey(value: string | null | undefined) {
  if (!value) {
    return ""
  }

  const directDate = value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]

  if (directDate) {
    return directDate
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? "" : getDateKeyInTimeZone(date)
}

export function dateKeyToLocalDate(dateKey: string) {
  const parts = parseDateKeyParts(dateKey)

  return parts ? new Date(parts.year, parts.month - 1, parts.day) : null
}

export function shiftDateKey(dateKey: string, days: number) {
  const parts = parseDateKeyParts(dateKey)

  if (!parts) {
    return dateKey
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}
